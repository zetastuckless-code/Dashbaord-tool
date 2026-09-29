export const DEFAULT_DASHBOARD_VIEW = Object.freeze({
  client: "all", period: "current", status: "all", owner: "all", channel: "all",
  attention: "all", sort: "portfolio", query: "", spendSource: "billing", kpiView: "primary"
});

const OPTIONS = Object.freeze({
  period: new Set(["current", "7", "30"]),
  status: new Set(["all", "live", "scheduled", "completed", "archived"]),
  attention: new Set(["all", "attention", "clear"]),
  sort: new Set(["portfolio", "pacing-risk", "spend", "freshness", "name"]),
  spendSource: new Set(["billing", "first", "third"]),
  kpiView: new Set(["primary", "CTR", "VCR", "CPA", "ROAS"])
});

export function normalizeDashboardView(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const view = { ...DEFAULT_DASHBOARD_VIEW };
  for (const key of ["client", "owner", "channel", "query"]) view[key] = String(input[key] ?? view[key]).trim() || view[key];
  for (const [key, choices] of Object.entries(OPTIONS)) if (choices.has(input[key])) view[key] = input[key];
  return view;
}

export function readDashboardView(storage) {
  try { return normalizeDashboardView(JSON.parse(storage.getItem("northstar-dashboard-view"))); }
  catch { return { ...DEFAULT_DASHBOARD_VIEW }; }
}

export function writeDashboardView(storage, view) {
  const normalized = normalizeDashboardView(view);
  storage.setItem("northstar-dashboard-view", JSON.stringify(normalized));
  return normalized;
}
