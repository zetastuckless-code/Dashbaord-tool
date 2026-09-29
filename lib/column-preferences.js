export const OPTIONAL_CAMPAIGN_COLUMNS = Object.freeze(["status", "spend", "budget", "pacing", "kpi", "source", "updated"]);
export const DEFAULT_CAMPAIGN_COLUMNS = Object.freeze([...OPTIONAL_CAMPAIGN_COLUMNS]);

export function normalizeColumnPreferences(value) {
  if (!Array.isArray(value)) return [...DEFAULT_CAMPAIGN_COLUMNS];
  const selected = [...new Set(value)].filter(column => OPTIONAL_CAMPAIGN_COLUMNS.includes(column));
  return selected.length ? OPTIONAL_CAMPAIGN_COLUMNS.filter(column => selected.includes(column)) : [...DEFAULT_CAMPAIGN_COLUMNS];
}

export function readColumnPreferences(storage) {
  try {
    return normalizeColumnPreferences(JSON.parse(storage.getItem("northstar-campaign-columns")));
  } catch {
    return [...DEFAULT_CAMPAIGN_COLUMNS];
  }
}

export function writeColumnPreferences(storage, columns) {
  const normalized = normalizeColumnPreferences(columns);
  storage.setItem("northstar-campaign-columns", JSON.stringify(normalized));
  return normalized;
}
