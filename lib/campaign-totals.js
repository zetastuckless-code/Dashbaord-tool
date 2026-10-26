import { resolveSpend } from "./source-comparison.js";
import { calculatePortfolioPacing } from "./spend-pacing.js";
import { groupKey } from "./campaign-groups.js";

export const CAMPAIGN_TOTALS_KEY = "northstar-campaign-totals";

const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));

/** "O-ABC-R4" and "4240-Rev2" are revisions of orders "O-ABC" and "4240". */
export const orderBase = order => String(order ?? "").replace(/-(R|Rev)\d+$/i, "").trim().toLowerCase();

/** A placement's cost by month ("2026-10": 40000), from the IO's flighting details, when the IO has them. */
function monthAmounts(months) {
  if (!months || typeof months !== "object") return null;
  const kept = Object.entries(months).filter(([month, amount]) => /^\d{4}-\d{2}$/.test(month) && Number.isFinite(amount));
  return kept.length ? Object.fromEntries(kept) : null;
}

function normalizeOrder(order) {
  if (!order || !Number.isFinite(order.budget) || order.budget <= 0) return null;
  return {
    order: order.order || null,
    budget: order.budget,
    startDate: validDate(order.startDate) ? order.startDate : null,
    endDate: validDate(order.endDate) ? order.endDate : null,
    fileName: String(order.fileName ?? ""),
    appliedAt: order.appliedAt || null,
    placements: (Array.isArray(order.placements) ? order.placements : []).filter(placement => placement && validDate(placement.startDate) && validDate(placement.endDate)).map(placement => ({ id: String(placement.id ?? ""), name: String(placement.name ?? ""), startDate: placement.startDate, endDate: placement.endDate, budget: Number.isFinite(placement.budget) ? placement.budget : null, ...(monthAmounts(placement.months) ? { months: monthAmounts(placement.months) } : {}) }))
  };
}

/**
 * Changes typed in before the updated IO arrives: the campaign's budget and each IO line's budget, dates and monthly
 * amounts (keyed by the IO line). A new IO upload replaces them.
 */
function normalizeEdits(edits) {
  if (!edits || typeof edits !== "object") return null;
  const budget = Number.isFinite(edits.budget) && edits.budget > 0 ? edits.budget : null;
  const lines = Object.fromEntries(Object.entries(edits.lines && typeof edits.lines === "object" ? edits.lines : {}).map(([key, line]) => [key, {
    ...(Number.isFinite(line?.budget) && line.budget >= 0 ? { budget: line.budget } : {}),
    ...(validDate(line?.startDate) ? { startDate: line.startDate } : {}),
    ...(validDate(line?.endDate) ? { endDate: line.endDate } : {}),
    ...(monthAmounts(line?.months) ? { months: monthAmounts(line.months) } : {})
  }]).filter(([, line]) => Object.keys(line).length));
  return budget !== null || Object.keys(lines).length ? { ...(budget !== null ? { budget } : {}), lines, editedAt: edits.editedAt || null } : null;
}

/** Saves (or, with nothing in them, clears) the hand edits to a campaign's IO. */
export function setTotalsEdits(totals, key, edits) {
  const entry = normalizeTotals(totals)[key];
  if (!entry) return totals;
  const next = { orders: entry.orders, ...(entry.datesOverride ? { datesOverride: entry.datesOverride } : {}), ...(edits ? { edits: { ...edits, editedAt: new Date().toISOString() } } : {}) };
  return normalizeTotals({ ...totals, [key]: next });
}

/** A campaign's totals are the sum of its orders; a revision of an order already applied replaces that order. */
function aggregate(orders, datesOverride = null, edits = null) {
  const starts = orders.map(order => order.startDate).filter(Boolean).sort();
  const ends = orders.map(order => order.endDate).filter(Boolean).sort();
  return {
    budget: Number.isFinite(edits?.budget) ? edits.budget : orders.reduce((sum, order) => sum + order.budget, 0),
    ...(edits ? { edits } : {}),
    startDate: datesOverride ? datesOverride.startDate : starts[0] || null,
    endDate: datesOverride ? datesOverride.endDate : ends.at(-1) || null,
    ...(datesOverride ? { datesOverride } : {}),
    fileName: orders.at(-1).fileName,
    order: orders.map(order => order.order).filter(Boolean).join(" + ") || null,
    appliedAt: orders.map(order => order.appliedAt).filter(Boolean).sort().at(-1) || null,
    orders
  };
}

export function normalizeTotals(value) {
  const result = {};
  for (const [key, entry] of Object.entries(value && typeof value === "object" && !Array.isArray(value) ? value : {})) {
    if (!entry || typeof entry !== "object") continue;
    // Entries saved before several orders could be combined hold one order in the entry itself.
    const orders = (Array.isArray(entry.orders) && entry.orders.length ? entry.orders : [entry]).map(normalizeOrder).filter(Boolean);
    // A flight edited by hand wins over the orders' dates until the orders change.
    const override = entry.datesOverride && typeof entry.datesOverride === "object" ? { startDate: validDate(entry.datesOverride.startDate) ? entry.datesOverride.startDate : null, endDate: validDate(entry.datesOverride.endDate) ? entry.datesOverride.endDate : null } : null;
    if (orders.length) result[key] = aggregate(orders, override && (override.startDate || override.endDate) ? override : null, normalizeEdits(entry.edits));
  }
  return result;
}

export function readCampaignTotals(storage) {
  try {
    return normalizeTotals(JSON.parse(storage.getItem(CAMPAIGN_TOTALS_KEY)));
  } catch {
    return {};
  }
}

export function writeCampaignTotals(storage, totals) {
  const normalized = normalizeTotals(totals);
  storage.setItem(CAMPAIGN_TOTALS_KEY, JSON.stringify(normalized));
  return normalized;
}

/**
 * Adds an insertion order to a campaign's totals (its placements are kept so line flights can show their dates).
 * Different orders add up; a new revision of an order already applied replaces the earlier revision.
 */
export function setCampaignTotals(totals, key, io, fileName = "", now = new Date()) {
  const order = [io.orderNumber, io.revision].filter(Boolean).join("-") || null;
  const incoming = {
    order, budget: io.budget, startDate: io.startDate, endDate: io.endDate, fileName, appliedAt: now.toISOString(),
    placements: (io.lineItems || []).filter(item => !item.addedValue).map(item => ({ id: item.id, name: item.name, startDate: item.startDate, endDate: item.endDate, budget: item.budget, ...(item.months ? { months: item.months } : {}) }))
  };
  const existing = normalizeTotals(totals)[key]?.orders || [];
  const base = orderBase(order || fileName);
  const kept = existing.filter(current => !(base && orderBase(current.order || current.fileName) === base));
  return normalizeTotals({ ...totals, [key]: { orders: [...kept, incoming] } });
}

/** Sets (or, with no dates, clears) the flight a campaign is paced on, overriding what its orders say. */
export function setTotalsFlight(totals, key, startDate, endDate) {
  const entry = normalizeTotals(totals)[key];
  if (!entry) return totals;
  const next = { orders: entry.orders, ...(entry.edits ? { edits: entry.edits } : {}) };
  if (startDate || endDate) next.datesOverride = { startDate: startDate || null, endDate: endDate || null };
  return normalizeTotals({ ...totals, [key]: next });
}

/** Removes one order (by its label) from a campaign's totals, dropping the totals when it was the last. */
export function removeOrderFromTotals(totals, key, order) {
  const entry = normalizeTotals(totals)[key];
  if (!entry) return totals;
  const remaining = entry.orders.filter(current => current.order !== order);
  if (!remaining.length) return removeCampaignTotals(totals, key);
  return normalizeTotals({ ...totals, [key]: { orders: remaining, ...(entry.datesOverride ? { datesOverride: entry.datesOverride } : {}), ...(entry.edits ? { edits: entry.edits } : {}) } });
}

export function removeCampaignTotals(totals, key) {
  const { [key]: _removed, ...rest } = totals;
  return rest;
}

/**
 * Splits records into the units that budget and pacing are measured on: a campaign with insertion-order totals is
 * one unit (IO budget and flight against the combined spend of its lines); every other record stands alone.
 */
export function budgetUnits(records, totals = {}) {
  const units = [];
  const pooled = new Map();
  for (const record of records) {
    const key = groupKey(record);
    const entry = totals[key];
    if (!entry) {
      units.push({ key: null, records: [record], spend: resolveSpend(record, "billing"), budget: record.budget, startDate: record.startDate, endDate: record.endDate, pacing: record.pacing, hasTotals: false });
      continue;
    }
    if (!pooled.has(key)) {
      const unit = { key, records: [], spend: 0, budget: entry.budget, startDate: entry.startDate, endDate: entry.endDate, pacing: null, hasTotals: true };
      pooled.set(key, unit);
      units.push(unit);
    }
    const unit = pooled.get(key);
    unit.records.push(record);
    unit.spend += resolveSpend(record, "billing");
    unit.startDate = unit.startDate || record.startDate;
    unit.endDate = unit.endDate || record.endDate;
  }
  return units;
}

/**
 * Rows that count toward live totals: live rows, plus every other line of a campaign paced on insertion-order totals
 * while any of its lines is live (its spend to date still belongs to the campaign).
 */
export function activeRowsWithPooled(rows, totals, isLive) {
  const liveGroups = new Set(rows.filter(isLive).map(groupKey));
  return rows.filter(row => isLive(row) || (totals[groupKey(row)] && liveGroups.has(groupKey(row))));
}

export const unitsBudget = units => units.reduce((sum, unit) => sum + (Number.isFinite(unit.budget) && unit.budget > 0 ? unit.budget : 0), 0);
export const unitsPacing = (units, asOf = new Date()) => calculatePortfolioPacing(units, asOf).pacing;
