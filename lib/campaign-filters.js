import { campaignFlightStatus } from "./spend-pacing.js";
import { isCampaignArchived } from "./campaign-archive.js";

export function dashboardFlightStatus(campaign, asOf = new Date()) {
  if (isCampaignArchived(campaign)) return "archived";
  const status = campaignFlightStatus(campaign, asOf);
  return status === "unknown" ? "live" : status;
}

export function filterCampaigns(campaigns, { client = "all", status = "all", owner = "all", channel = "all", query = "" } = {}, asOf = new Date()) {
  const normalizedQuery = String(query).trim().toLowerCase();
  return campaigns.filter(campaign => (client === "all" || campaign.client === client)
    && (status === "all" ? dashboardFlightStatus(campaign, asOf) !== "archived" : dashboardFlightStatus(campaign, asOf) === status)
    && (owner === "all" || campaign.owner === owner)
    && (channel === "all" || campaign.channel === channel)
    && (!normalizedQuery || [campaign.client, campaign.name, campaign.campaignId, campaign.owner, campaign.channel, campaign.source, ...(campaign.sources || [])]
      .some(value => String(value ?? "").toLowerCase().includes(normalizedQuery))));
}
