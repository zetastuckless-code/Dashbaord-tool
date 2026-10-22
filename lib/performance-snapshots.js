import { calculateKpi } from "./metric-calculations.js";
import { resolvePacingRange } from "./pacing-detail.js";
import { selectedSnapshots } from "./portfolio-trend.js";
import { rowsToCsv } from "./workbook-import.js";

const METRICS = ["spend", "impressions", "clicks", "conversions", "revenue", "videoStarts", "videoCompletions"];
export const MAX_SNAPSHOTS_PER_SOURCE = 90;

export function campaignSnapshot(campaign) {
  if (!campaign.dataAsOf) return null;
  return {
    date: campaign.dataAsOf,
    source: campaign.source || "Unknown",
    ...Object.fromEntries(METRICS.map(metric => [metric, Number.isFinite(campaign[metric]) ? campaign[metric] : null]))
  };
}

export function mergePerformanceSnapshots(existingCampaign, importedCampaign) {
  const next = campaignSnapshot(importedCampaign);
  const snapshots = [...(existingCampaign.performanceSnapshots || [])];
  if (!next) return snapshots;
  const key = snapshot => `${snapshot.date}::${String(snapshot.source).toLowerCase()}`;
  // A report with a monthly breakdown brings earlier dated totals too, so spend per day can be charted from it.
  const incoming = [...(importedCampaign.history || []).map(entry => ({ source: next.source, ...Object.fromEntries(METRICS.map(metric => [metric, null])), ...entry })), next];
  for (const snapshot of incoming) {
    const match = snapshots.findIndex(existing => key(existing) === key(snapshot));
    if (match === -1) snapshots.push(snapshot);
    else snapshots[match] = snapshot;
  }
  const sorted = snapshots.sort((a, b) => a.date.localeCompare(b.date));
  const retainedKeys = new Set();
  const bySource = new Map();
  sorted.forEach(snapshot => {
    const source = String(snapshot.source).trim().toLowerCase();
    bySource.set(source, [...(bySource.get(source) || []), snapshot]);
  });
  for (const sourceSnapshots of bySource.values()) {
    sourceSnapshots.slice(-MAX_SNAPSHOTS_PER_SOURCE).forEach(snapshot => retainedKeys.add(key(snapshot)));
  }
  return sorted.filter(snapshot => retainedKeys.has(key(snapshot)));
}

export function compareLatestSnapshots(campaign, windowDays = null) {
  const snapshots = campaign.performanceSnapshots || [];
  if (snapshots.length < 2) return null;
  const latest = snapshots.at(-1);
  const sameSource = snapshots.slice(0, -1).filter(snapshot => String(snapshot.source).toLowerCase() === String(latest.source).toLowerCase());
  let previous = sameSource.at(-1);
  if (Number.isFinite(windowDays) && windowDays > 0) {
    const cutoff = new Date(`${latest.date}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - windowDays);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    previous = sameSource.filter(snapshot => snapshot.date <= cutoffDate).at(-1) || sameSource.at(0);
  }
  if (!previous) return null;
  const changes = Object.fromEntries(METRICS.map(metric => {
    const before = previous[metric];
    const after = latest[metric];
    return [metric, Number.isFinite(before) && Number.isFinite(after) ? after - before : null];
  }));
  return { previous, latest, changes };
}

export function periodSpend(campaign, period, options) {
  return periodMetrics(campaign, period, options)?.spend ?? null;
}

const DAY_MS = 86_400_000;
const dayNumber = iso => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;
const dayBefore = iso => new Date(Date.parse(`${iso}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);

/** "custom:2026-01-01:2026-01-31" carries a custom range's dates; every other period is a preset id. */
export function parsePeriod(period) {
  const [preset, start = "", end = ""] = String(period ?? "current").split(":");
  return { preset, custom: { start, end } };
}

/**
 * One line's delivery inside a reporting period, from its dated reports. Totals between two reports fill in evenly
 * by day, and delivery starts from zero the day before the flight starts. Null when the reports cannot cover the
 * period (no report on or after its first day, or nothing known before it).
 */
export function periodMetrics(campaign, period, { today = new Date().toISOString().slice(0, 10), spendView = "billing" } = {}) {
  if (!period || period === "current") return null;
  const { preset, custom } = parsePeriod(period);
  const points = [...new Map(selectedSnapshots(campaign, spendView).map(snapshot => [snapshot.date, snapshot])).values()].sort((a, b) => a.date.localeCompare(b.date));
  if (!points.length) return null;
  const last = points.at(-1);
  if (preset === "all") return Object.fromEntries(METRICS.map(metric => [metric, Number.isFinite(last[metric]) ? last[metric] : null]));
  const range = resolvePacingRange(preset, { today, custom });
  if (range.error || range.start > last.date) return null;
  const flightStart = campaign.deliveryStart || campaign.startDate;
  const anchor = flightStart && dayBefore(flightStart) < points[0].date ? dayBefore(flightStart) : null;
  const end = range.end < last.date ? range.end : last.date;
  const before = dayBefore(range.start);
  const valueAt = (metric, date) => {
    const series = [...(anchor ? [{ date: anchor, value: 0 }] : []), ...points.filter(point => Number.isFinite(point[metric])).map(point => ({ date: point.date, value: point[metric] }))];
    if (!series.length) return null;
    // Before the first known total there was no delivery if that total is zero or the flight had not started.
    if (date < series[0].date) return series[0].value === 0 || (flightStart && date < flightStart) ? 0 : null;
    const nextIndex = series.findIndex(point => point.date >= date);
    if (nextIndex < 0) return series.at(-1).value;
    const next = series[nextIndex];
    if (next.date === date || nextIndex === 0) return next.value;
    const previous = series[nextIndex - 1];
    return previous.value + (next.value - previous.value) * (dayNumber(date) - dayNumber(previous.date)) / (dayNumber(next.date) - dayNumber(previous.date));
  };
  const metrics = Object.fromEntries(METRICS.map(metric => {
    const startValue = valueAt(metric, before);
    const endValue = valueAt(metric, end);
    return [metric, startValue === null || endValue === null ? null : Math.max(endValue - startValue, 0)];
  }));
  return Object.values(metrics).every(value => value === null) ? null : metrics;
}

export function periodKpi(campaign, period, options) {
  const metrics = periodMetrics(campaign, period, options);
  if (!metrics) return null;
  return calculateKpi(campaign.kpi, metrics);
}

export function campaignSnapshotHistory(campaign) {
  return [...(campaign.performanceSnapshots || [])].sort((left, right) => right.date.localeCompare(left.date) || String(left.source).localeCompare(String(right.source)));
}

export function exportPerformanceSnapshotsCsv(campaign) {
  const headers = ["client", "campaign", "campaign_id", "data_as_of", "source", ...METRICS.map(metric => metric.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`))];
  const rows = campaignSnapshotHistory(campaign).map(snapshot => [campaign.client, campaign.name, campaign.campaignId, snapshot.date, snapshot.source, ...METRICS.map(metric => snapshot[metric] ?? "")]);
  return rowsToCsv([headers, ...rows]);
}
