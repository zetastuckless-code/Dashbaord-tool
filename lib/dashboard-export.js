import { dashboardFlightStatus, filterCampaigns } from "./campaign-filters.js";
import { discrepancyStatus, resolveSpend } from "./source-comparison.js";
import { effectivePacing } from "./spend-pacing.js";
import { rowsToCsv } from "./workbook-import.js";
import { periodMetrics } from "./performance-snapshots.js";
import { sortCampaigns } from "./campaign-sort.js";
import { resolveKpiView } from "./kpi-view.js";

const HEADERS = ["client", "campaign", "campaign_id", "owner", "channel", "status", "start_date", "end_date", "data_as_of", "reporting_period", "spend_view", "spend", "budget", "pacing", "source_variance", "source_variance_percent", "kpi", "kpi_value", "kpi_target", "source", "impressions", "clicks", "conversions", "revenue", "video_starts", "video_completions"];

export function exportCampaignsCsv(campaigns, { client = "all", status = "all", owner = "all", channel = "all", query = "", sort = "portfolio", spendView = "billing", period = "current", kpiView = "primary" } = {}, asOf = new Date()) {
  const filtered = sortCampaigns(filterCampaigns(campaigns, { client, status, owner, channel, query }, asOf), { mode: sort, spendView, asOf });
  const rows = filtered.map(campaign => {
    const changes = periodMetrics(campaign, period);
    const spend = period === "current" ? resolveSpend(campaign, spendView) : changes?.spend;
    const pacing = effectivePacing({ ...campaign, spend: resolveSpend(campaign, "billing") }, asOf);
    const variance = discrepancyStatus(campaign);
    const metrics = period === "current" ? campaign : changes || {};
    const selectedKpi = resolveKpiView(campaign, kpiView, period === "current" ? campaign : changes);
    return [campaign.client, campaign.name, campaign.campaignId, campaign.owner, campaign.channel, dashboardFlightStatus(campaign, asOf), campaign.startDate, campaign.endDate, campaign.dataAsOf, period, period === "current" ? spendView : "reported snapshot", spend ?? "", campaign.budget, pacing === null ? "" : Number(pacing.toFixed(2)), variance.absoluteDifference, variance.percentage === null ? "" : Number(variance.percentage.toFixed(2)), selectedKpi?.metric || kpiView, selectedKpi?.formatted || "", selectedKpi?.target || "", (campaign.sources || [campaign.source]).filter(Boolean).join(" + "), metrics.impressions, metrics.clicks, metrics.conversions, metrics.revenue, metrics.videoStarts, metrics.videoCompletions];
  });
  return rowsToCsv([HEADERS, ...rows]);
}
