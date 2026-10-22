import { resolveSpend } from "./source-comparison.js";
import { effectivePacing } from "./spend-pacing.js";
import { aggregateKpiView, kpiBreakdown } from "./kpi-view.js";
import { campaignGroupName, groupKey } from "./campaign-groups.js";
import { dashboardFlightStatus } from "./campaign-filters.js";
import { periodSpend } from "./performance-snapshots.js";
import { activeRowsWithPooled, budgetUnits, unitsBudget, unitsPacing } from "./campaign-totals.js";

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
export function buildClientRollup(campaigns, { spendView = "billing", period = "current", kpiView = "primary", alerts = [], rules = {}, asOf = new Date(), totals = {} } = {}) {
  const clients = new Map();
  for (const campaign of activeRowsWithPooled(campaigns, totals, row => dashboardFlightStatus(row, asOf) === "live")) {
    clients.set(campaign.client, [...(clients.get(campaign.client) || []), campaign]);
  }
  const rollups = [...clients.entries()].map(([client, live]) => {
    const spendValues = live.map(campaign => period === "current" ? resolveSpend(campaign, spendView) : periodSpend(campaign, period, { today: asOf instanceof Date ? asOf.toISOString().slice(0, 10) : String(asOf).slice(0, 10), spendView }));
    const comparable = spendValues.filter(value => value !== null);
    const spend = comparable.reduce((sum, value) => sum + value, 0);
    const units = budgetUnits(live, totals);
    const budget = unitsBudget(units);
    const pacing = unitsPacing(units, asOf);
    const clientAlerts = alerts.filter(alert => alert.campaign?.client === client);
    const dates = live.map(campaign => campaign.dataAsOf).filter(Boolean).sort();
    // A campaign is all its lines together, paced on its insertion order when it has one.
    const groups = new Map();
    for (const record of live) groups.set(groupKey(record), [...(groups.get(groupKey(record)) || []), record]);
    return {
      client,
      short: live[0].short,
      className: live[0].className,
      liveCount: groups.size,
      lineCount: live.length,
      spend,
      spendCoverage: comparable.length,
      budget,
      utilization: budget > 0 && period === "current" ? spend / budget * 100 : null,
      pacing,
      pacingBand: pacingBand(pacing, rules),
      kpi: clientKpi(live, kpiView),
      kpiMix: kpiView === "primary" ? kpiBreakdown(live) : [],
      alerts: clientAlerts,
      alertCount: clientAlerts.length,
      criticalCount: clientAlerts.filter(alert => alert.severity === "critical").length,
      latestDataAsOf: dates.at(-1) || null,
      campaigns: [...groups.entries()].map(([key, records]) => {
        const groupPacing = totals[key] || records.length > 1 ? unitsPacing(budgetUnits(records, totals), asOf) : effectivePacing({ ...records[0], spend: resolveSpend(records[0], "billing") }, asOf);
        const mix = kpiView === "primary" ? kpiBreakdown(records) : [];
        const single = aggregateKpiView(records, kpiView);
        const kpis = mix.length ? mix.map(item => ({ metric: item.metric, formatted: item.formatted })) : single.formatted !== "—" ? [{ metric: single.metric, formatted: single.formatted }] : [];
        return { name: campaignGroupName(records[0]), lines: records.length, pacing: groupPacing, pacingBand: pacingBand(groupPacing, rules), kpis, alertCount: clientAlerts.filter(alert => groupKey(alert.campaign) === key).length };
      }).sort((a, b) => b.alertCount - a.alertCount || Math.abs((b.pacing ?? 100) - 100) - Math.abs((a.pacing ?? 100) - 100))
    };
  });
  return rollups.sort((a, b) => b.criticalCount - a.criticalCount || b.alertCount - a.alertCount || a.client.localeCompare(b.client));
}
