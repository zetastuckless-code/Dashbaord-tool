const formatPercent = value => `${value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}%`;
const formatMoney = value => `$${value.toFixed(2)}`;
const formatMultiplier = value => `${Number(value.toFixed(2))}x`;

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

  const formatted = metric === "CPA" ? formatMoney(value) : metric === "ROAS" ? formatMultiplier(value) : formatPercent(value);
  return { metric, value, formatted };
}

export function calculateAvailableKpis(metrics) {
  return ["CTR", "VCR", "CPA", "ROAS"].map(kpi => calculateKpi(kpi, metrics)).filter(Boolean);
}
