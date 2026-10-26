import { groupKey } from "./campaign-groups.js";
import { ioLines } from "./io-plan.js";

// Pacing on delivered value: a CPM or CPV line's spend is what it delivered at the rate the client pays (impressions ×
// CPM ÷ 1000, or completed views × CPV), the same dollars billing counts and the IO budget is written in. Lines billed
// on spend, or with no known rate, keep their reported spend. The reported spend stays as media spend, for margin.

const rateKind = text => /cpv/i.test(String(text ?? "")) ? "cpv" : /cpm/i.test(String(text ?? "")) ? "cpm" : null;

/** What a delivery is worth at a rate: impressions at a CPM, completed views at a CPV. */
export function valueAt(rate, metrics) {
  if (!rate || !(rate.rate > 0)) return null;
  if (rate.type === "cpm") return Number.isFinite(Number(metrics?.impressions)) && metrics.impressions !== null ? Number(metrics.impressions) * rate.rate / 1000 : null;
  if (rate.type === "cpv") return Number.isFinite(Number(metrics?.videoCompletions)) && metrics.videoCompletions !== null ? Number(metrics.videoCompletions) * rate.rate : null;
  return null;
}

/** A line's rate: the billing row it's in (what's actually billed), else its IO line's rate. Null when billed on spend. */
export function lineRate(record, { totals = {}, billing = {} } = {}) {
  const row = (billing[record.client]?.rows || []).find(item => (item.lines || []).includes(record.name));
  if (row) {
    const type = ["cpm", "cpv"].includes(row.rateType) ? row.rateType : null;
    return type && Number(row.rate) > 0 ? { type, rate: Number(row.rate), from: "billing" } : null;
  }
  const entry = totals[groupKey(record)];
  const line = entry && record.ioLine ? ioLines(entry).find(item => item.key === record.ioLine) : null;
  const type = rateKind(line?.rateType);
  return type && line.rate > 0 ? { type, rate: line.rate, from: "io" } : null;
}

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

/**
 * Margin on a line: delivered value against media spend, both as of its last report (DCM days added after a report
 * have impressions but no cost, so they'd overstate it).
 */
export function lineMargin(record) {
  if (!record.deliveredRate) return null;
  const base = record.reportBase || record;
  const value = valueAt(record.deliveredRate, base);
  const media = Number(base.firstPartySpend ?? base.spend);
  if (value === null || !Number.isFinite(media)) return null;
  return { value, media, margin: value - media };
}

/** Margin across lines, for a campaign or a client. */
export function marginOf(records) {
  const parts = records.map(lineMargin).filter(Boolean);
  if (!parts.length) return null;
  const value = parts.reduce((sum, part) => sum + part.value, 0);
  const media = parts.reduce((sum, part) => sum + part.media, 0);
  return { value, media, margin: value - media, percent: value > 0 ? (value - media) / value * 100 : null, lines: parts.length, of: records.length };
}
