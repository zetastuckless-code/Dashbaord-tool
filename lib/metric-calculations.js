// Rounded for reading at a glance: CTR keeps two decimals (0.13%), VCR is a whole percent (76%), CPA whole dollars
// ($39), ROAS one decimal (3.8x).
const formatPercent = value => `${value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}%`;
const formatWholePercent = value => `${Math.round(value)}%`;
const formatMoney = value => `$${Math.round(value).toLocaleString("en-US")}`;
const formatMultiplier = value => `${Number(value.toFixed(1))}x`;

export function calculateKpi(kpi, metrics) {
  const metric = String(kpi ?? "").trim().toUpperCase();
  const number = value => value === null || value === undefined || value === "" ? null : Number(value);
  const spend = number(metrics.spend);
  const impressions = number(metrics.impressions);
  const clicks = number(metrics.clicks);
  const conversions = number(metrics.conversions);
  const revenue = number(metrics.revenue);
  const videoStarts = number(metrics.videoStarts);
  const videoCompletions = number(metrics.videoCompletions);
  let value;

  if (metric === "CTR" && impressions > 0 && Number.isFinite(clicks) && clicks >= 0) value = clicks / impressions * 100;
  else if (metric === "VCR" && videoStarts > 0 && Number.isFinite(videoCompletions) && videoCompletions >= 0) value = videoCompletions / videoStarts * 100;
  else if (metric === "CPA" && conversions > 0 && Number.isFinite(spend) && spend >= 0) value = spend / conversions;
  else if (metric === "ROAS" && spend > 0 && Number.isFinite(revenue) && revenue >= 0) value = revenue / spend;
  else return null;

  const formatted = metric === "CPA" ? formatMoney(value) : metric === "ROAS" ? formatMultiplier(value) : metric === "VCR" ? formatWholePercent(value) : formatPercent(value);
  return { metric, value, formatted };
}

export function calculateAvailableKpis(metrics) {
  return ["CTR", "VCR", "CPA", "ROAS"].map(kpi => calculateKpi(kpi, metrics)).filter(Boolean);
}
