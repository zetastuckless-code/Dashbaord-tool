import { resolveSpend } from "./source-comparison.js";
import { calculatePortfolioPacing } from "./spend-pacing.js";
import { groupKey } from "./campaign-groups.js";

export const CAMPAIGN_TOTALS_KEY = "northstar-campaign-totals";

const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));

export function normalizeTotals(value) {
  const result = {};
  for (const [key, entry] of Object.entries(value && typeof value === "object" && !Array.isArray(value) ? value : {})) {
    if (!entry || !Number.isFinite(entry.budget) || entry.budget <= 0) continue;
    result[key] = {
      budget: entry.budget,
      startDate: validDate(entry.startDate) ? entry.startDate : null,
      endDate: validDate(entry.endDate) ? entry.endDate : null,
      fileName: String(entry.fileName ?? ""),
      order: entry.order || null,
      appliedAt: entry.appliedAt || null
    };
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

/** Records a campaign's insertion-order total (and flight) as the yardstick for pacing all of its lines together. */
export function setCampaignTotals(totals, key, io, fileName = "", now = new Date()) {
  return normalizeTotals({ ...totals, [key]: { budget: io.budget, startDate: io.startDate, endDate: io.endDate, fileName, order: [io.orderNumber, io.revision].filter(Boolean).join("-") || null, appliedAt: now.toISOString() } });
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

export const unitsBudget = units => units.reduce((sum, unit) => sum + (Number.isFinite(unit.budget) && unit.budget > 0 ? unit.budget : 0), 0);
export const unitsPacing = (units, asOf = new Date()) => calculatePortfolioPacing(units, asOf).pacing;
