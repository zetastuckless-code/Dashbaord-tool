const BILLING_SOURCES = new Set(["first", "third", "reported"]);
const REPORT_CADENCES = new Set(["none", "daily", "weekly"]);

const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

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
  const cpmText = String(settings.billingCpm ?? campaign.billingCpm ?? "").trim();
  const billingCpm = cpmText === "" ? null : Number(cpmText);
  const mappingManaged = Boolean(campaign.requiresMapping || campaign.campaignId || campaignId);
  // Flight dates are only touched when the caller passes them; a blank date clears it.
  const hasDates = settings.startDate !== undefined || settings.endDate !== undefined;
  const startDate = String(settings.startDate ?? campaign.startDate ?? "").trim();
  const endDate = String(settings.endDate ?? campaign.endDate ?? "").trim();
  const errors = [];

  if (!name) errors.push("Campaign display name is required.");
  if (!kpi) errors.push("Primary KPI is required.");
  if (!value) errors.push("Current KPI value is required.");
  if (!target) errors.push("KPI target is required.");
  if (!BILLING_SOURCES.has(billingSource)) errors.push("Choose a valid billing source.");
  if (!REPORT_CADENCES.has(reportCadence)) errors.push("Choose a valid report cadence.");
  if (billingCpm !== null && (!Number.isFinite(billingCpm) || billingCpm < 0)) errors.push("Billing CPM must be a non-negative number.");
  if (hasDates) {
    if (startDate && !validDate(startDate)) errors.push("Flight start must be a valid date.");
    if (endDate && !validDate(endDate)) errors.push("Flight end must be a valid date.");
    if (validDate(startDate) && validDate(endDate) && endDate < startDate) errors.push("Flight end must be on or after flight start.");
  }

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
      billingCpm,
      owner: owner || null,
      channel: channel || null,
      ...(hasDates ? { startDate: startDate || null, endDate: endDate || null } : {}),
      ...(mappingManaged ? { campaignId: campaignId || null, requiresMapping: !campaignId } : {})
    }
  };
}
