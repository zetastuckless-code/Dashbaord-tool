import test from "node:test";
import assert from "node:assert/strict";
import { budgetRevisionHistory, createBudgetRevision, exportBudgetRevisionsCsv, latestBudgetRevision } from "../lib/budget-revisions.js";
import { parseCsv } from "../lib/importer.js";

test("creates an auditable budget revision and updates the current budget", () => {
  const campaign = { name: "Fall", budget: 100000 };
  const result = createBudgetRevision(campaign, { amount: "$125,000", effectiveDate: "2026-10-01", fileName: "revised-io.pdf", note: "Added video" }, "2026-09-24T12:00:00Z");
  assert.equal(result.valid, true);
  assert.equal(result.campaign.budget, 125000);
  assert.deepEqual(result.campaign.budgetRevisions[0], { revisionNumber: 1, previousBudget: 100000, amount: 125000, effectiveDate: "2026-10-01", fileName: "revised-io.pdf", note: "Added video", createdAt: "2026-09-24T12:00:00Z" });
  assert.equal(campaign.budget, 100000);
});

test("increments revision numbers and exposes the latest revision", () => {
  const first = createBudgetRevision({ budget: 100 }, { amount: 120, effectiveDate: "2026-09-01", fileName: "io-1.pdf" }).campaign;
  const second = createBudgetRevision(first, { amount: 150, effectiveDate: "2026-10-01", fileName: "io-2.pdf" }).campaign;
  assert.equal(second.budgetRevisions[1].revisionNumber, 2);
  assert.equal(latestBudgetRevision(second).fileName, "io-2.pdf");
});

test("rejects invalid revisions without changing the campaign", () => {
  const campaign = { budget: 100 };
  const result = createBudgetRevision(campaign, { amount: 0, effectiveDate: "not-a-date", fileName: "" });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 3);
  assert.equal(result.campaign, campaign);
});

test("lists and exports the complete budget revision audit newest-first", () => {
  const first = createBudgetRevision({ client: "Apex, Inc.", name: "Launch", campaignId: "CMP-1", budget: 100 }, { amount: 120, effectiveDate: "2026-09-01", fileName: "io-1.pdf", note: "Initial change" }, "2026-08-30T12:00:00Z").campaign;
  const campaign = createBudgetRevision(first, { amount: 150, effectiveDate: "2026-10-01", fileName: "io-2.pdf", note: "Added video" }, "2026-09-28T12:00:00Z").campaign;
  assert.deepEqual(budgetRevisionHistory(campaign).map(revision => revision.revisionNumber), [2, 1]);
  const [headers, newest] = parseCsv(exportBudgetRevisionsCsv(campaign));
  assert.equal(newest[headers.indexOf("client")], "Apex, Inc.");
  assert.equal(newest[headers.indexOf("revision_number")], "2");
  assert.equal(newest[headers.indexOf("revised_budget")], "150");
  assert.equal(newest[headers.indexOf("revision_note")], "Added video");
});
