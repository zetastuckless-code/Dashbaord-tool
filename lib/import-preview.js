import { mergeCampaignImports } from "./import-merge.js";

export function previewCampaignImport(existingCampaigns, importedCampaigns, mode = "merge") {
  if (mode === "replace") {
    return {
      mode,
      campaigns: importedCampaigns.map(campaign => ({ ...campaign })),
      added: importedCampaigns.length,
      updated: 0,
      unchanged: 0,
      removed: existingCampaigns.length,
      actions: importedCampaigns.map(campaign => ({ action: "replace", client: campaign.client, campaign: campaign.name, campaignId: campaign.campaignId || "", source: campaign.source }))
    };
  }
  return { mode: "merge", removed: 0, ...mergeCampaignImports(existingCampaigns, importedCampaigns) };
}
