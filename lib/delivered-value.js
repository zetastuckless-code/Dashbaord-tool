import { groupKey } from "./campaign-groups.js";
import { ioLines } from "./io-plan.js";

// Pacing on delivered value: a CPM or CPV line's spend is what it delivered at the rate the client pays (impressions ×
// CPM ÷ 1000, or completed views × CPV), the same dollars billing counts and the IO budget is written in. Lines billed
// on spend, or with no known rate, keep their reported spend. The reported spend stays as media spend.

const rateKind = text => /cpv/i.test(String(text ?? "")) ? "cpv" : /cpm/i.test(String(text ?? "")) ? "cpm" : null;

/** What a delivery is worth at a rate: impressions at a CPM, completed views at a CPV. */
export function valueAt(rate, metrics) {
  if (!rate || !(rate.rate >= 0)) return null;
  if (rate.type === "cpm") return Number.isFinite(Number(metrics?.impressions)) && metrics.impressions !== null ? Number(metrics.impressions) * rate.rate / 1000 : null;
  if (rate.type === "cpv") return Number.isFinite(Number(metrics?.videoCompletions)) && metrics.videoCompletions !== null ? Number(metrics.videoCompletions) * rate.rate : null;
  return null;
}

/**
 * A line's rate: the billing row it's in (what's actually billed), else its IO line's rate, else the IO's or the client's
 * one shared rate. Null when billed on spend or no rate is known.
 */
export function lineRate(record, { totals = {}, billing = {} } = {}) {
  const row = (billing[record.client]?.rows || []).find(item => (item.lines || []).includes(record.name));
  if (row) {
    const type = ["cpm", "cpv"].includes(row.rateType) ? row.rateType : null;
    return type && Number(row.rate) > 0 ? { type, rate: Number(row.rate), from: "billing" } : null;
  }
  const entry = totals[groupKey(record)];
  // Added value (a $0 IO) delivers at no cost, so it's worth nothing to billing whatever the client's other rates are.
  if (entry?.noCost) return { type: "cpm", rate: 0, from: "added value" };
  const lines = entry ? ioLines(entry) : [];
  const line = record.ioLine ? lines.find(item => item.key === record.ioLine) : null;
  const type = rateKind(line?.rateType);
  if (type && line.rate > 0) return { type, rate: line.rate, from: "io" };
  // A line not matched to one IO line takes the IO's rate when every line on it shares one.
  const single = onlyRate(lines.filter(item => item.rate > 0).map(item => ({ type: rateKind(item.rateType), rate: item.rate })));
  if (single) return { ...single, from: "io" };
  // An IO read before rates were saved: the client's billing rate, when all its CPM or CPV rows use the same one.
  const shared = onlyRate((billing[record.client]?.rows || []).filter(item => ["cpm", "cpv"].includes(item.rateType) && Number(item.rate) > 0).map(item => ({ type: item.rateType, rate: Number(item.rate) })));
  return shared ? { ...shared, from: "client billing" } : null;
}
const onlyRate = rates => rates.length && rates.every(rate => rate.type && rate.type === rates[0].type && rate.rate === rates[0].rate) ? { type: rates[0].type, rate: rates[0].rate } : null;

const round2 = value => Math.round(value * 100) / 100;

/**
 * Sets each line's `deliveredRate` and `deliveredValue` (or clears them for lines billed on spend). Returns the same
 * array when nothing changed, so callers can skip saving.
 */
export function applyDeliveredValue(records, context = {}) {
  let changed = false;
  const next = records.map(record => {
    const rate = lineRate(record, context);
    const value = rate ? valueAt(rate, record) : null;
    const deliveredValue = value === null ? null : round2(value);
    const same = JSON.stringify(record.deliveredRate || null) === JSON.stringify(rate && deliveredValue !== null ? rate : null) && (record.deliveredValue ?? null) === deliveredValue;
    if (same) return record;
    changed = true;
    const { deliveredRate: _rate, deliveredValue: _value, ...rest } = record;
    return deliveredValue === null ? rest : { ...rest, deliveredRate: rate, deliveredValue };
  });
  return changed ? next : records;
}
