const BILLING_SOURCES = new Set(["first", "third", "reported"]);
const REPORT_CADENCES = new Set(["none", "daily", "weekly"]);

export function createCampaign(input, createdAt = new Date().toISOString()) {
  const client = String(input.client ?? "").trim();
  const name = String(input.name ?? "").trim();
  const startDate = String(input.startDate ?? "").trim();
  const endDate = String(input.endDate ?? "").trim();
  const budget = Number(String(input.budget ?? "").replace(/[$,\s]/g, ""));
  const billingSource = String(input.billingSource ?? "").trim().toLowerCase();
  const kpi = String(input.kpi ?? "").trim().toUpperCase();
  const target = String(input.target ?? "").trim();
  const ioFileName = String(input.ioFileName ?? "").trim();
  const campaignId = String(input.campaignId ?? "").trim();
  const owner = String(input.owner ?? "").trim();
  const channel = String(input.channel ?? "").trim();
  const reportCadence = String(input.reportCadence ?? "none").trim().toLowerCase();
  const errors = [];

  if (!client) errors.push("Client name is required.");
  if (!name) errors.push("Campaign name is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(`${startDate}T00:00:00Z`))) errors.push("Choose a valid start date.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || Number.isNaN(Date.parse(`${endDate}T00:00:00Z`))) errors.push("Choose a valid end date.");
  if (startDate && endDate && startDate > endDate) errors.push("Campaign end date must be on or after its start date.");
  if (!Number.isFinite(budget) || budget <= 0) errors.push("Approved budget must be greater than zero.");
  if (!BILLING_SOURCES.has(billingSource)) errors.push("Choose a valid billing source.");
  if (!kpi) errors.push("Primary KPI is required.");
  if (!target) errors.push("KPI target is required.");
  if (!ioFileName) errors.push("Attach the approved insertion order.");
  if (!REPORT_CADENCES.has(reportCadence)) errors.push("Choose a valid report cadence.");
  if (errors.length) return { valid: false, errors, campaign: null };

  return { valid: true, errors: [], campaign: {
    id: `manual-${createdAt}-${client}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    client, name, short: client.split(/\s+/).map(word => word[0]).join("").slice(0, 2).toUpperCase(), className: "apex",
    startDate, endDate, budget, spend: 0, firstPartySpend: null, thirdPartySpend: null, pacing: 0,
    billingSource, source: "Manual", kpi, value: "—", target: target.toLowerCase().startsWith("target") ? target : `Target ${target}`,
    campaignId: campaignId || null, requiresMapping: !campaignId, owner: owner || null, channel: channel || null, reportCadence,
    ioFileName, createdAt, updated: "Just now", budgetRevisions: []
  } };
}
