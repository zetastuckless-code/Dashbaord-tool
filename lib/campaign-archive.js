export function setCampaignArchived(campaign, archived, changedAt = new Date().toISOString()) {
  return { ...campaign, archivedAt: archived ? changedAt : null };
}

export function isCampaignArchived(campaign) {
  return typeof campaign?.archivedAt === "string" && campaign.archivedAt.length > 0;
}
