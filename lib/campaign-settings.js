const BILLING_SOURCES = new Set(["first", "third", "reported"]);
const REPORT_CADENCES = new Set(["none", "daily", "weekly"]);

export function applyCampaignSettings(campaign, settings) {
  const name = String(settings.name ?? "").trim();
  const kpi = String(settings.kpi ?? "").trim().toUpperCase();
  const value = String(settings.value ?? "").trim();
  const target = String(settings.target ?? "").trim();
  const billingSource = String(settings.billingSource ?? "").trim().toLowerCase();
  const reportCadence = String(settings.reportCadence ?? campaign.reportCadence ?? "none").trim().toLowerCase();
  const campaignId = String(settings.campaignId ?? campaign.campaignId ?? "").trim();
  const owner = String(settings.owner ?? campaign.owner ?? "").trim();
  const channel = String(settings.channel ?? campaign.channel ?? "").trim();
  const mappingManaged = Boolean(campaign.requiresMapping || campaign.campaignId || campaignId);
  const errors = [];

  if (!name) errors.push("Campaign display name is required.");
  if (!kpi) errors.push("Primary KPI is required.");
  if (!value) errors.push("Current KPI value is required.");
  if (!target) errors.push("KPI target is required.");
  if (!BILLING_SOURCES.has(billingSource)) errors.push("Choose a valid billing source.");
  if (!REPORT_CADENCES.has(reportCadence)) errors.push("Choose a valid report cadence.");

  if (errors.length) return { valid: false, errors, campaign };
  return {
    valid: true,
    errors: [],
    campaign: {
      ...campaign,
      name,
      kpi,
      value,
      target: target.toLowerCase().startsWith("target") ? target : `Target ${target}`,
      billingSource,
      reportCadence,
      owner: owner || null,
      channel: channel || null,
      ...(mappingManaged ? { campaignId: campaignId || null, requiresMapping: !campaignId } : {})
    }
  };
}
