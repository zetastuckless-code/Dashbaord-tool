import { resolveSpend } from "./source-comparison.js";
import { calculatePortfolioPacing, effectivePacing } from "./spend-pacing.js";
import { aggregateKpiView, resolveKpiView } from "./kpi-view.js";
import { dashboardFlightStatus } from "./campaign-filters.js";
import { periodMetrics, periodSpend } from "./performance-snapshots.js";

function clientKpi(live, kpiView) {
  const aggregate = aggregateKpiView(live, kpiView);
  // Without imported components a single campaign can still show its reported primary KPI.
  if (aggregate.formatted === "—" && live.length === 1 && kpiView === "primary" && live[0].value) return { ...aggregate, metric: live[0].kpi || aggregate.metric, formatted: live[0].value };
  return aggregate;
}

export function pacingBand(pacing, { underPacing = 85, overPacing = 105 } = {}) {
  if (pacing === null || pacing === undefined || !Number.isFinite(pacing)) return "unknown";
  if (pacing > overPacing) return "over";
  if (pacing < underPacing) return "under";
  return "on-track";
}

/**
 * Groups the filtered campaigns by client for the top-level dashboard view. Only live campaigns
 * contribute to totals, matching the portfolio cards; `alerts` is the unacknowledged alert queue.
 */
export function buildClientRollup(campaigns, { spendView = "billing", period = "current", kpiView = "primary", alerts = [], rules = {}, asOf = new Date() } = {}) {
  const clients = new Map();
  for (const campaign of campaigns) {
    if (dashboardFlightStatus(campaign, asOf) !== "live") continue;
    clients.set(campaign.client, [...(clients.get(campaign.client) || []), campaign]);
  }
  const rollups = [...clients.entries()].map(([client, live]) => {
    const spendValues = live.map(campaign => period === "current" ? resolveSpend(campaign, spendView) : periodSpend(campaign, period));
    const comparable = spendValues.filter(value => value !== null);
    const spend = comparable.reduce((sum, value) => sum + value, 0);
    const budget = live.reduce((sum, campaign) => sum + (Number(campaign.budget) || 0), 0);
    const pacing = calculatePortfolioPacing(live.map(campaign => ({ ...campaign, spend: resolveSpend(campaign, "billing") })), asOf).pacing;
    const clientAlerts = alerts.filter(alert => alert.campaign?.client === client);
    const dates = live.map(campaign => campaign.dataAsOf).filter(Boolean).sort();
    return {
      client,
      short: live[0].short,
      className: live[0].className,
      liveCount: live.length,
      spend,
      spendCoverage: comparable.length,
      budget,
      utilization: budget > 0 && period === "current" ? spend / budget * 100 : null,
      pacing,
      pacingBand: pacingBand(pacing, rules),
      kpi: clientKpi(live, kpiView),
      alertCount: clientAlerts.length,
      criticalCount: clientAlerts.filter(alert => alert.severity === "critical").length,
      latestDataAsOf: dates.at(-1) || null,
      campaigns: live.map(campaign => {
        const campaignPacing = effectivePacing({ ...campaign, spend: resolveSpend(campaign, "billing") }, asOf);
        const kpi = resolveKpiView(campaign, kpiView, period === "current" ? campaign : periodMetrics(campaign, period));
        return { name: campaign.name, pacing: campaignPacing, pacingBand: pacingBand(campaignPacing, rules), kpi: kpi?.formatted || null, kpiMetric: kpi?.metric || campaign.kpi };
      }).sort((a, b) => Math.abs((b.pacing ?? 100) - 100) - Math.abs((a.pacing ?? 100) - 100))
    };
  });
  return rollups.sort((a, b) => b.criticalCount - a.criticalCount || b.alertCount - a.alertCount || a.client.localeCompare(b.client));
}
