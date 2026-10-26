import { campaignFlightStatus } from "./spend-pacing.js";
import { isCampaignArchived } from "./campaign-archive.js";

// A line with no flight dates (no IO yet) counts as live until its report shows no delivery for this many days.
export const UNDATED_STALE_DAYS = 21;

export function dashboardFlightStatus(campaign, asOf = new Date()) {
  if (isCampaignArchived(campaign)) return "archived";
  // Marked paused or completed by hand: that wins over the flight dates.
  if (campaign.manualStatus === "paused" || campaign.manualStatus === "completed") return campaign.manualStatus;
  // A campaign the client canceled is finished, the same as a completed one; only its label differs.
  if (campaign.manualStatus === "canceled") return "completed";
  const status = campaignFlightStatus(campaign, asOf);
  if (status !== "unknown") return status;
  const lastDelivery = campaign.deliveryEnd || null;
  if (lastDelivery && Date.parse(`${lastDelivery}T00:00:00Z`) < asOf.getTime() - UNDATED_STALE_DAYS * 86_400_000) return "completed";
  return "live";
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
