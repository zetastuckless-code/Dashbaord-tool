import { calculateKpi } from "./metric-calculations.js";
import { resolveSpend } from "./source-comparison.js";

export const KPI_VIEWS = Object.freeze(["primary", "CTR", "VCR", "CPA", "ROAS"]);

/** A value saved at import only stands for the KPI if it is written that way: CPA as money, CTR as a percent. */
function storedValueFits(kpi, value) {
  const text = String(value ?? "").trim();
  if (!text || text === "—") return false;
  const metric = String(kpi ?? "").toUpperCase();
  if (["CPA", "CPC", "CPM", "CPCV", "CPV", "CPL"].includes(metric)) return text.startsWith("$");
  if (["CTR", "VCR"].includes(metric)) return text.endsWith("%");
  if (metric === "ROAS") return /x$/i.test(text);
  return true;
}

export function resolveKpiView(campaign, view = "primary", metrics = campaign) {
  if (!metrics) return null;
  if (view === "primary" || !KPI_VIEWS.includes(view)) {
    if (metrics !== campaign) return { metric: campaign.kpi || "KPI", formatted: calculateKpi(campaign.kpi, metrics)?.formatted || null, target: campaign.target || "" };
    // Work the value out from the line's own numbers, so changing the primary KPI (CTR to CPA) changes the value too.
    const calculated = calculateKpi(campaign.kpi, { ...campaign, spend: resolveSpend(campaign, "billing") });
    return { metric: campaign.kpi || "KPI", formatted: calculated?.formatted || (storedValueFits(campaign.kpi, campaign.value) ? campaign.value : "—"), target: campaign.target || "" };
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

/** Each primary KPI in use with its value across the lines that use it, most-used first: [{ metric, formatted, lines }]. */
export function kpiBreakdown(campaigns) {
  const metrics = [...new Set(campaigns.map(campaign => campaign.kpi).filter(Boolean))];
  return metrics.map(metric => {
    const lines = campaigns.filter(campaign => campaign.kpi === metric);
    return { metric, formatted: aggregateKpiView(lines, metric).formatted, lines: lines.length };
  }).sort((a, b) => b.lines - a.lines || a.metric.localeCompare(b.metric));
}
