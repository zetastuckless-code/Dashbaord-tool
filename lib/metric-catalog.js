import { resolveSpend } from "./source-comparison.js";
import { calculatePortfolioPacing } from "./spend-pacing.js";
import { aggregateKpiView, kpiBreakdown, resolveKpiView } from "./kpi-view.js";
import { periodMetrics } from "./performance-snapshots.js";
import { budgetUnits, unitsPacing } from "./campaign-totals.js";
import { groupKey } from "./campaign-groups.js";
import { deliveryComparison } from "./third-party-delivery.js";

/** Everything a campaign row can display. `kind` drives formatting; order is the picker order. */
export const METRIC_CATALOG = Object.freeze([
  { key: "spend", label: "Spend", kind: "money" },
  { key: "budget", label: "Budget", kind: "money" },
  { key: "remaining", label: "Remaining", kind: "money" },
  { key: "pacing", label: "Pacing", kind: "pacing" },
  { key: "impressions", label: "Impressions", kind: "count" },
  { key: "clicks", label: "Clicks", kind: "count" },
  { key: "ctr", label: "CTR", kind: "percent" },
  { key: "cpm", label: "CPM", kind: "rate" },
  { key: "cpc", label: "CPC", kind: "rate" },
  { key: "videoStarts", label: "Video starts", kind: "count" },
  { key: "videoCompletions", label: "Video completes", kind: "count" },
  { key: "vcr", label: "VCR", kind: "percent" },
  { key: "conversions", label: "Conversions", kind: "count" },
  { key: "cpa", label: "CPA", kind: "rate" },
  { key: "revenue", label: "Revenue", kind: "money" },
  { key: "roas", label: "ROAS", kind: "multiplier" },
  { key: "dcmCpa", label: "DCM CPA", kind: "rate" },
  { key: "dcmRoas", label: "DCM ROAS", kind: "multiplier" },
  { key: "dcmGap", label: "DCM imp. gap", kind: "gap" },
  { key: "kpi", label: "Primary KPI", kind: "text" }
]);

export const DEFAULT_METRICS = Object.freeze(["spend", "budget", "pacing", "impressions", "clicks", "kpi"]);
export const MAX_ROW_METRICS = 8;
const COMPONENTS = ["impressions", "clicks", "conversions", "revenue", "videoStarts", "videoCompletions"];
const KNOWN = new Set(METRIC_CATALOG.map(metric => metric.key));

export function normalizeMetricSelection(value, fallback = DEFAULT_METRICS) {
  if (!Array.isArray(value)) return [...fallback];
  const selected = [...new Set(value)].filter(key => KNOWN.has(key)).slice(0, MAX_ROW_METRICS);
  return selected.length ? selected : [...fallback];
}

const finite = value => Number.isFinite(value) ? value : null;
const ratio = (numerator, denominator, scale = 1) => numerator !== null && denominator !== null && denominator > 0 ? numerator / denominator * scale : null;

function addInto(totals, key, value) {
  if (Number.isFinite(value)) totals[key] = (totals[key] ?? 0) + value;
}

/**
 * Computes every catalog metric for one record or an array of records (a campaign's lines),
 * using the dashboard's selected spend source and reporting period. Unavailable values are null.
 */
export function computeMetrics(items, { spendView = "billing", period = "current", asOf = new Date(), totals: groupTotals = null } = {}) {
  const records = Array.isArray(items) ? items : [items];
  const today = asOf instanceof Date ? asOf.toISOString().slice(0, 10) : String(asOf).slice(0, 10);
  const totals = {};
  let budget = null;
  for (const record of records) {
    const windowed = period === "current" ? null : periodMetrics(record, period, { today, spendView });
    if (period !== "current" && !windowed) continue;
    const lineSpend = period === "current" ? resolveSpend(record, spendView) : windowed.spend;
    addInto(totals, "spend", lineSpend);
    for (const key of COMPONENTS) addInto(totals, key, finite(period === "current" ? record[key] : windowed[key]));
    // CPA and ROAS divide by the spend of lines that report conversions or revenue, so a YouTube line with no revenue
    // doesn't pull the campaign's ROAS down.
    if (finite(period === "current" ? record.conversions : windowed.conversions) !== null) addInto(totals, "conversionSpend", lineSpend);
    if (finite(period === "current" ? record.revenue : windowed.revenue) !== null) addInto(totals, "revenueSpend", lineSpend);
  }
  for (const record of records) if (Number.isFinite(record.budget) && record.budget > 0) budget = (budget ?? 0) + record.budget;
  const spend = totals.spend ?? null;
  let pacing = calculatePortfolioPacing(records.map(record => ({ ...record, spend: resolveSpend(record, "billing") })), asOf).pacing;
  if (groupTotals && records.length) {
    // The insertion-order total and flight measure the whole campaign, whatever its lines report.
    const [unit] = budgetUnits(records, { [groupKey(records[0])]: groupTotals });
    budget = unit.budget;
    pacing = unitsPacing([unit], asOf);
  }
  let kpi = null;
  if (records.length === 1) {
    const resolved = resolveKpiView(records[0], "primary", period === "current" ? records[0] : periodMetrics(records[0], period, { today, spendView }));
    kpi = resolved?.formatted ? `${resolved.formatted} ${resolved.metric}` : null;
  } else {
    const aggregate = aggregateKpiView(records, "primary");
    kpi = aggregate.formatted === "—" ? null : aggregate.metric === "Primary KPI mix" ? kpiBreakdown(records).map(item => `${item.formatted} ${item.metric}`).join(" · ") : `${aggregate.formatted} ${aggregate.metric}`;
  }
  // DCM figures cover only the days both DCM and the line's report have, so they are summed from each line's comparison.
  const dcm = { spend: 0, conversions: 0, revenue: 0, reportImpressions: 0, dcmImpressions: 0, lines: 0 };
  for (const record of records) {
    const comparison = deliveryComparison(record);
    if (!comparison || !Number.isFinite(comparison.report.spend)) continue;
    dcm.lines += 1;
    dcm.spend += comparison.report.spend;
    dcm.conversions += comparison.adServer.conversions;
    dcm.revenue += comparison.adServer.revenue;
    if (Number.isFinite(comparison.report.impressions)) { dcm.reportImpressions += comparison.report.impressions; dcm.dcmImpressions += comparison.adServer.impressions; }
  }
  return {
    dcmCpa: dcm.lines && dcm.conversions > 0 ? dcm.spend / dcm.conversions : null,
    dcmRoas: dcm.lines && dcm.spend > 0 ? dcm.revenue / dcm.spend : null,
    dcmGap: dcm.lines && dcm.dcmImpressions > 0 ? (dcm.reportImpressions - dcm.dcmImpressions) / dcm.dcmImpressions * 100 : null,
    spend, budget, remaining: budget !== null && spend !== null && period === "current" ? Math.max(budget - spend, 0) : null, pacing,
    impressions: totals.impressions ?? null, clicks: totals.clicks ?? null, conversions: totals.conversions ?? null, revenue: totals.revenue ?? null,
    videoStarts: totals.videoStarts ?? null, videoCompletions: totals.videoCompletions ?? null,
    ctr: ratio(totals.clicks ?? null, totals.impressions ?? null, 100),
    cpm: ratio(spend, totals.impressions ?? null, 1000),
    cpc: ratio(spend, totals.clicks ?? null),
    vcr: ratio(totals.videoCompletions ?? null, totals.videoStarts ?? null, 100),
    cpa: ratio(totals.conversionSpend ?? null, totals.conversions ?? null),
    roas: totals.revenueSpend > 0 && totals.revenue !== undefined ? totals.revenue / totals.revenueSpend : null,
    kpi
  };
}

const compactMoney = value => value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(2)}M` : value >= 10_000 ? `$${(value / 1000).toFixed(1)}K` : `$${Math.round(value).toLocaleString("en-US")}`;
const count = value => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

export function formatMetric(key, value) {
  if (value === null || value === undefined) return "—";
  const kind = METRIC_CATALOG.find(metric => metric.key === key)?.kind;
  if (kind === "money") return compactMoney(value);
  if (kind === "rate") return `$${value.toFixed(2)}`;
  if (kind === "count") return count(value);
  if (kind === "percent") return `${value.toFixed(2)}%`;
  if (kind === "pacing") return `${value.toFixed(0)}%`;
  if (kind === "multiplier") return `$${value.toFixed(2)}`;
  if (kind === "gap") return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  return String(value);
}

export const metricLabel = key => METRIC_CATALOG.find(metric => metric.key === key)?.label ?? key;
