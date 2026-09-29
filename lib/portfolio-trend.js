import { calculateSpendPacing } from "./spend-pacing.js";
import { normalizeBillingSource } from "./source-comparison.js";
import { rowsToCsv } from "./workbook-import.js";

function selectedSnapshots(campaign, spendView) {
  const snapshots = Array.isArray(campaign.performanceSnapshots) ? campaign.performanceSnapshots : [];
  if (!snapshots.length) return [];
  const requestedSource = spendView === "billing" ? normalizeBillingSource(campaign.billingSource || campaign.source) : spendView;
  if (["first", "third"].includes(requestedSource)) {
    const requested = snapshots.filter(snapshot => normalizeBillingSource(snapshot.source) === requestedSource);
    if (requested.length) return requested;
    if (spendView !== "billing") return [];
  }
  const matching = snapshots.filter(snapshot => snapshot.source === campaign.source);
  if (matching.length) return matching;
  const latest = [...snapshots].sort((left, right) => String(right.date).localeCompare(String(left.date)))[0];
  return snapshots.filter(snapshot => snapshot.source === latest.source);
}

export function buildPortfolioSpendTrend(campaigns, { spendView = "billing" } = {}) {
  const histories = campaigns.map(campaign => ({ campaign, snapshots: selectedSnapshots(campaign, spendView).sort((left, right) => left.date.localeCompare(right.date)) }));
  const historyCampaigns = histories.filter(item => item.snapshots.length).length;
  const dates = [...new Set(histories.flatMap(item => item.snapshots.map(snapshot => snapshot.date)))].sort();
  return dates.map(date => {
    let actual = 0;
    let actualCampaigns = 0;
    let planned = 0;
    let plannedCampaigns = 0;
    for (const { campaign, snapshots } of histories) {
      const snapshot = snapshots.filter(item => item.date <= date).at(-1);
      if (snapshot && Number.isFinite(snapshot.spend)) { actual += snapshot.spend; actualCampaigns += 1; }
      const pacing = snapshot ? calculateSpendPacing(campaign, new Date(`${date}T23:59:59Z`)) : null;
      if (pacing) { planned += pacing.expectedSpend; plannedCampaigns += 1; }
    }
    return { date, actual: actualCampaigns ? actual : null, planned: plannedCampaigns ? planned : null, actualCampaigns, plannedCampaigns, historyCampaigns, totalCampaigns: campaigns.length };
  });
}

export function exportPortfolioSpendTrendCsv(points, spendView = "billing") {
  const headers = ["date", "spend_view", "actual_spend", "planned_spend", "spend_variance", "pacing_percent", "actual_campaigns", "planned_campaigns", "campaigns_with_history", "total_campaigns"];
  const rows = points.map(point => {
    const comparable = Number.isFinite(point.actual) && Number.isFinite(point.planned);
    const variance = comparable ? point.actual - point.planned : "";
    const pacing = comparable && point.planned > 0 ? point.actual / point.planned * 100 : "";
    return [point.date, spendView, point.actual ?? "", point.planned ?? "", variance, pacing === "" ? "" : Number(pacing.toFixed(2)), point.actualCampaigns, point.plannedCampaigns, point.historyCampaigns, point.totalCampaigns];
  });
  return rowsToCsv([headers, ...rows]);
}
