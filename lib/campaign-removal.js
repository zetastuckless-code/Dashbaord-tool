import { normalizeBillingSource } from "./source-comparison.js";
import { calculateKpi } from "./metric-calculations.js";
import { groupKey } from "./campaign-groups.js";

const same = (left, right) => String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();
const COMPONENT_KEYS = ["impressions", "clicks", "conversions", "revenue", "videoStarts", "videoCompletions"];

export const removeRecordAt = (campaigns, index) => campaigns.filter((_, position) => position !== index);
export const removeGroupRecords = (campaigns, key) => campaigns.filter(campaign => groupKey(campaign) !== key);

export function removeLineItem(record, lineId) {
  const lineItems = (record.lineItems || []).filter(item => !same(item.id, lineId));
  const lineItemFlights = (record.lineItemFlights || []).filter(flight => !same(flight.id, lineId));
  return { ...record, lineItems, lineItemFlights };
}

function latestDate(snapshots) {
  return snapshots.map(snapshot => snapshot.date).sort().at(-1) ?? null;
}

/**
 * Removes one dated report from a record's history. When it was the newest report from its source, the record's
 * current values fall back to that source's previous report (or are cleared when there is none).
 */
export function removeSnapshot(record, date, source) {
  const snapshots = record.performanceSnapshots || [];
  const target = snapshots.find(snapshot => snapshot.date === date && same(snapshot.source, source));
  if (!target) return record;
  const remaining = snapshots.filter(snapshot => snapshot !== target);
  const wasLatest = !snapshots.some(snapshot => same(snapshot.source, source) && snapshot.date > date);
  let next = { ...record, performanceSnapshots: remaining };
  if (wasLatest) {
    const previous = remaining.filter(snapshot => same(snapshot.source, source)).sort((a, b) => a.date.localeCompare(b.date)).at(-1) || null;
    const party = normalizeBillingSource(source);
    const spend = previous ? previous.spend : null;
    if (party === "first") next.firstPartySpend = spend;
    if (party === "third") next.thirdPartySpend = spend;
    // A report whose platform name does not say first/third party still set whichever field holds its spend.
    if (party === "reported" && same(source, record.source)) {
      if (record.firstPartySpend === target.spend) next.firstPartySpend = spend;
      if (record.thirdPartySpend === target.spend) next.thirdPartySpend = spend;
    }
    if (same(source, record.source)) {
      next.spend = spend ?? 0;
      for (const key of COMPONENT_KEYS) next[key] = previous && Number.isFinite(previous[key]) ? previous[key] : null;
      const recalculated = calculateKpi(record.kpi, { ...next, spend: next.spend });
      if (recalculated) next = { ...next, value: recalculated.formatted };
    }
    next.dataAsOf = latestDate(remaining);
  }
  return next;
}

function deliverySpend(record, days) {
  const values = Object.values(days);
  const spends = values.map(day => day.spend).filter(Number.isFinite);
  if (spends.length) return spends.reduce((sum, value) => sum + value, 0);
  const impressions = values.map(day => day.impressions).filter(Number.isFinite);
  return Number.isFinite(record.billingCpm) && impressions.length ? Math.round(impressions.reduce((sum, value) => sum + value, 0) / 1000 * record.billingCpm * 100) / 100 : null;
}

/** Removes all stored daily delivery (and its snapshots) from one source, e.g. CM360 or Flashtalking. */
export function removeDailySource(record, source) {
  const dailyDelivery = Object.fromEntries(Object.entries(record.dailyDelivery || {}).filter(([name]) => !same(name, source)));
  const snapshots = (record.performanceSnapshots || []).filter(snapshot => !same(snapshot.source, source));
  const remainingSource = ["CM360", "Flashtalking"].find(name => dailyDelivery[name] && Object.keys(dailyDelivery[name]).length) || Object.keys(dailyDelivery)[0];
  return {
    ...record,
    dailyDelivery,
    performanceSnapshots: snapshots,
    sources: (record.sources || []).filter(name => !same(name, source) || same(name, record.source)),
    thirdPartySpend: remainingSource ? deliverySpend(record, dailyDelivery[remainingSource]) : null,
    dataAsOf: latestDate(snapshots) ?? record.dataAsOf ?? null
  };
}
