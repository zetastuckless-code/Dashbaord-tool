const BILLING_SOURCES = new Set(["first", "third", "reported"]);
const REPORT_CADENCES = new Set(["none", "daily", "weekly"]);
export const BUDGET_SOURCES = Object.freeze(["manual", "io", "report"]);

export function createCampaign(input, createdAt = new Date().toISOString()) {
  const client = String(input.client ?? "").trim();
  const name = String(input.name ?? "").trim();
  const startDate = String(input.startDate ?? "").trim();
  const endDate = String(input.endDate ?? "").trim();
  const budgetSource = String(input.budgetSource ?? "").trim().toLowerCase() || (String(input.ioFileName ?? "").trim() ? "io" : "manual");
  const budgetText = String(input.budget ?? "").replace(/[$,\s]/g, "");
  const budget = budgetSource === "report" && budgetText === "" ? null : Number(budgetText);
  const billingSource = String(input.billingSource ?? "").trim().toLowerCase();
  const kpi = String(input.kpi ?? "").trim().toUpperCase();
  const target = String(input.target ?? "").trim();
  const ioFileName = String(input.ioFileName ?? "").trim();
  const campaignId = String(input.campaignId ?? "").trim();
  const owner = String(input.owner ?? "").trim();
  const channel = String(input.channel ?? "").trim();
  const reportCadence = String(input.reportCadence ?? "none").trim().toLowerCase();
  const undated = Boolean(input.allowUndated) && !startDate && !endDate;
  const errors = [];

  if (!client) errors.push("Client name is required.");
  if (!name) errors.push("Campaign name is required.");
  if (!undated && (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(`${startDate}T00:00:00Z`)))) errors.push("Choose a valid start date.");
  if (!undated && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || Number.isNaN(Date.parse(`${endDate}T00:00:00Z`)))) errors.push("Choose a valid end date.");
  if (startDate && endDate && startDate > endDate) errors.push("Campaign end date must be on or after its start date.");
  if (!BUDGET_SOURCES.includes(budgetSource)) errors.push("Choose how the budget is set: manual entry, insertion order, or from reports.");
  else if (budget === null) { /* filled from the first report that includes a budget */ }
  else if (!Number.isFinite(budget) || budget <= 0) errors.push(budgetSource === "report" ? "Enter a valid budget, or leave it blank to read it from reports." : "Approved budget must be greater than zero.");
  if (!BILLING_SOURCES.has(billingSource)) errors.push("Choose a valid billing source.");
  if (!kpi) errors.push("Primary KPI is required.");
  if (!target) errors.push("KPI target is required.");
  if (budgetSource === "io" && !ioFileName) errors.push("Attach the approved insertion order.");
  if (!REPORT_CADENCES.has(reportCadence)) errors.push("Choose a valid report cadence.");
  if (errors.length) return { valid: false, errors, campaign: null };

  return { valid: true, errors: [], campaign: {
    id: `manual-${createdAt}-${client}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    client, name, short: client.split(/\s+/).map(word => word[0]).join("").slice(0, 2).toUpperCase(), className: "apex",
    startDate: undated ? null : startDate, endDate: undated ? null : endDate, budget, budgetSource, spend: 0, firstPartySpend: null, thirdPartySpend: null, pacing: budget === null ? null : 0,
    billingSource, source: "Manual", kpi, value: "—", target: target.toLowerCase().startsWith("target") ? target : `Target ${target}`,
    campaignId: campaignId || null, requiresMapping: !campaignId, owner: owner || null, channel: channel || null, reportCadence,
    ioFileName: ioFileName || null, createdAt, updated: "Just now", budgetRevisions: []
  } };
}
