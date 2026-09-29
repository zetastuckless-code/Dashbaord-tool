import { calculateKpi } from "./metric-calculations.js";
import { resolveSpend } from "./source-comparison.js";

export const KPI_VIEWS = Object.freeze(["primary", "CTR", "VCR", "CPA", "ROAS"]);

export function resolveKpiView(campaign, view = "primary", metrics = campaign) {
  if (!metrics) return null;
  if (view === "primary" || !KPI_VIEWS.includes(view)) {
    return { metric: campaign.kpi || "KPI", formatted: metrics === campaign ? campaign.value : calculateKpi(campaign.kpi, metrics)?.formatted || null, target: campaign.target || "" };
  }
  const calculation = calculateKpi(view, { ...metrics, spend: metrics === campaign ? resolveSpend(campaign, "billing") : metrics?.spend });
  return calculation ? { metric: view, formatted: calculation.formatted, target: view === campaign.kpi ? campaign.target || "" : "Calculated from imported components" } : null;
}

export function aggregateKpiView(campaigns, view = "primary") {
  if (!campaigns.length) return { metric: view === "primary" ? "Primary KPI" : view, formatted: "—", coverage: 0, total: 0 };
  let metric = view;
  if (view === "primary") {
    const metrics = [...new Set(campaigns.map(campaign => campaign.kpi).filter(Boolean))];
    if (metrics.length !== 1) return { metric: "Primary KPI mix", formatted: `${metrics.length} KPIs`, coverage: campaigns.length, total: campaigns.length };
    [metric] = metrics;
  }
  const eligible = campaigns.filter(campaign => calculateKpi(metric, { ...campaign, spend: resolveSpend(campaign, "billing") }));
  const totals = eligible.reduce((result, campaign) => {
    for (const key of ["spend", "impressions", "clicks", "conversions", "revenue", "videoStarts", "videoCompletions"]) {
      const value = key === "spend" ? resolveSpend(campaign, "billing") : campaign[key];
      if (Number.isFinite(value)) result[key] = (result[key] || 0) + value;
    }
    return result;
  }, {});
  const calculation = calculateKpi(metric, totals);
  return { metric, formatted: calculation?.formatted || "—", coverage: eligible.length, total: campaigns.length };
}
