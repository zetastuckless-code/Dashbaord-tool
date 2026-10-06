import { DEFAULT_METRICS, normalizeMetricSelection } from "./metric-catalog.js";

export const METRIC_PREFS_KEY = "northstar-campaign-metrics";

export function normalizeMetricPrefs(value) {
  const base = value && typeof value === "object" ? value : {};
  const byCampaign = {};
  for (const [key, selection] of Object.entries(base.byCampaign && typeof base.byCampaign === "object" ? base.byCampaign : {})) {
    if (Array.isArray(selection)) byCampaign[key] = normalizeMetricSelection(selection);
  }
  return { defaults: normalizeMetricSelection(base.defaults), byCampaign };
}

export function readMetricPrefs(storage) {
  try {
    return normalizeMetricPrefs(JSON.parse(storage.getItem(METRIC_PREFS_KEY)));
  } catch {
    return normalizeMetricPrefs(null);
  }
}

export function writeMetricPrefs(storage, prefs) {
  const normalized = normalizeMetricPrefs(prefs);
  storage.setItem(METRIC_PREFS_KEY, JSON.stringify(normalized));
  return normalized;
}

export const metricsForCampaign = (prefs, key) => prefs.byCampaign[key] ?? prefs.defaults ?? [...DEFAULT_METRICS];

/** Sets one campaign's metrics, or every campaign's (and the default) when `key` is null. */
export function setCampaignMetrics(prefs, key, selection) {
  const metrics = normalizeMetricSelection(selection, prefs.defaults);
  if (key === null) return { defaults: metrics, byCampaign: {} };
  return { ...prefs, byCampaign: { ...prefs.byCampaign, [key]: metrics } };
}

export function resetCampaignMetrics(prefs, key) {
  const { [key]: _removed, ...rest } = prefs.byCampaign;
  return { ...prefs, byCampaign: rest };
}
