import { rowsToCsv } from "./workbook-import.js";

export function createBudgetRevision(campaign, input, createdAt = new Date().toISOString()) {
  const amount = Number(String(input.amount ?? "").replace(/[$,\s]/g, ""));
  const effectiveDate = String(input.effectiveDate ?? "").trim();
  const fileName = String(input.fileName ?? "").trim();
  const note = String(input.note ?? "").trim();
  const errors = [];
  if (!Number.isFinite(amount) || amount <= 0) errors.push("Revised budget must be greater than zero.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || Number.isNaN(Date.parse(`${effectiveDate}T00:00:00Z`))) errors.push("Choose a valid effective date.");
  if (!fileName) errors.push("Attach the approved IO or budget document.");
  if (errors.length) return { valid: false, errors, campaign };
  const previousBudget = Number(campaign.budget) || 0;
  const revisions = Array.isArray(campaign.budgetRevisions) ? campaign.budgetRevisions : [];
  return { valid: true, errors: [], campaign: { ...campaign, budget: amount, budgetRevisions: [...revisions, { revisionNumber: revisions.length + 1, previousBudget, amount, effectiveDate, fileName, note, createdAt }] } };
}

export function latestBudgetRevision(campaign) {
  const revisions = Array.isArray(campaign.budgetRevisions) ? campaign.budgetRevisions : [];
  return revisions.at(-1) ?? null;
}

export function budgetRevisionHistory(campaign) {
  return [...(campaign.budgetRevisions || [])].sort((left, right) => Number(right.revisionNumber) - Number(left.revisionNumber));
}

export function exportBudgetRevisionsCsv(campaign) {
  const headers = ["client", "campaign", "campaign_id", "revision_number", "previous_budget", "revised_budget", "effective_date", "approved_document", "revision_note", "created_at"];
  const rows = budgetRevisionHistory(campaign).map(revision => [campaign.client, campaign.name, campaign.campaignId, revision.revisionNumber, revision.previousBudget, revision.amount, revision.effectiveDate, revision.fileName, revision.note, revision.createdAt]);
  return rowsToCsv([headers, ...rows]);
}
