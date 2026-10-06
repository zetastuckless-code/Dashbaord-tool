import { normalizeBillingSource } from "./source-comparison.js";

const BILLING = new Set(["first", "third", "reported"]);
const CADENCES = new Set(["none", "daily", "weekly"]);
const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** The campaign-setup fields a report can pre-fill, in the same terms as the Create campaign form. */
export function setupFieldsFromRow(row) {
  const party = normalizeBillingSource(row.billingSource || row.source);
  return {
    client: row.client ?? "",
    name: row.name ?? "",
    campaignId: row.campaignId ?? "",
    owner: row.owner ?? "",
    channel: row.channel ?? "",
    startDate: row.startDate ?? "",
    endDate: row.endDate ?? "",
    budget: Number.isFinite(row.budget) ? String(row.budget) : "",
    billingSource: party,
    kpi: String(row.kpi ?? "").toUpperCase(),
    target: String(row.target ?? "").replace(/^target\s*/i, ""),
    reportCadence: CADENCES.has(row.reportCadence) ? row.reportCadence : "none"
  };
}

export function validateSetupEdits(edits) {
  const errors = [];
  if (!String(edits.client ?? "").trim()) errors.push("Client name is required.");
  if (!String(edits.name ?? "").trim()) errors.push("Campaign name is required.");
  const budgetText = String(edits.budget ?? "").replace(/[$,\s]/g, "");
  if (budgetText !== "" && !(Number(budgetText) > 0)) errors.push("Budget must be a number above zero, or blank to leave it unset.");
  for (const [field, label] of [["startDate", "Start date"], ["endDate", "End date"]]) {
    if (String(edits[field] ?? "").trim() && !isDate(String(edits[field]).trim())) errors.push(`${label} must be a valid date.`);
  }
  if (edits.startDate && edits.endDate && edits.startDate > edits.endDate) errors.push("End date must be on or after the start date.");
  if (edits.billingSource && !BILLING.has(edits.billingSource)) errors.push("Choose a valid billing source.");
  if (edits.reportCadence && !CADENCES.has(edits.reportCadence)) errors.push("Choose a valid report cadence.");
  return errors;
}

/**
 * Applies a person's setup edits to a row that will become a new campaign. A budget typed over the report's own
 * figure is treated as a manual budget so later reports do not overwrite it.
 */
export function applySetupEdits(row, edits = {}) {
  if (!Object.keys(edits).length) return row;
  const next = { ...row };
  const text = field => String(edits[field] ?? "").trim();
  if ("client" in edits && text("client")) next.client = text("client");
  if ("name" in edits && text("name")) next.name = text("name");
  if ("campaignId" in edits) { next.campaignId = text("campaignId") || null; next.requiresMapping = !next.campaignId; }
  if ("owner" in edits) next.owner = text("owner") || null;
  if ("channel" in edits) next.channel = text("channel") || null;
  if ("startDate" in edits) next.startDate = text("startDate") || null;
  if ("endDate" in edits) next.endDate = text("endDate") || null;
  if ("budget" in edits) {
    const budget = Number(text("budget").replace(/[$,\s]/g, ""));
    if (text("budget") === "") { next.budget = row.budget; }
    else if (Number.isFinite(budget) && budget > 0) { next.budget = budget; if (budget !== row.budget) next.budgetSource = "manual"; }
  }
  if ("billingSource" in edits && BILLING.has(edits.billingSource)) next.billingSource = edits.billingSource;
  if ("kpi" in edits && text("kpi")) next.kpi = text("kpi").toUpperCase();
  if ("target" in edits && text("target")) next.target = /^target/i.test(text("target")) ? text("target") : `Target ${text("target")}`;
  if ("reportCadence" in edits && CADENCES.has(edits.reportCadence)) next.reportCadence = edits.reportCadence;
  return next;
}

/**
 * Turns a report row into the exact record the Create campaign form would produce for it, so the data it carried
 * (spend, impressions, snapshots, ...) can then be merged in without overwriting what was confirmed on the form.
 */
export function rowForCreatedCampaign(row, created) {
  return {
    ...row,
    client: created.client, name: created.name, campaignId: created.campaignId ?? row.campaignId ?? null,
    owner: created.owner ?? row.owner ?? null, channel: created.channel ?? row.channel ?? null,
    startDate: created.startDate, endDate: created.endDate, budget: created.budget, billingSource: created.billingSource,
    kpi: created.kpi, target: created.target
  };
}
