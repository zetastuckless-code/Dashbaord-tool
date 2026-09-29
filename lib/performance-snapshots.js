import { calculateKpi } from "./metric-calculations.js";
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
  const match = snapshots.findIndex(snapshot => key(snapshot) === key(next));
  if (match === -1) snapshots.push(next);
  else snapshots[match] = next;
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

export function periodSpend(campaign, period) {
  return periodMetrics(campaign, period)?.spend ?? null;
}

export function periodMetrics(campaign, period) {
  if (period === "current") return null;
  const days = Number(period);
  if (![7, 30].includes(days)) return null;
  return compareLatestSnapshots(campaign, days)?.changes ?? null;
}

export function periodKpi(campaign, period) {
  const metrics = periodMetrics(campaign, period);
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
