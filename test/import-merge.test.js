import test from "node:test";
import assert from "node:assert/strict";
import { mergeCampaignImports } from "../lib/import-merge.js";

test("adds new campaigns without removing the existing portfolio", () => {
  const result = mergeCampaignImports([{ client: "A", name: "One", source: "CM360", spend: 10 }], [{ client: "B", name: "Two", source: "DSP", spend: 20 }]);
  assert.equal(result.campaigns.length, 2);
  assert.deepEqual({ added: result.added, updated: result.updated, unchanged: result.unchanged }, { added: 1, updated: 0, unchanged: 1 });
});

test("updates matching client and campaign identities case-insensitively", () => {
  const existing = { client: "Apex", name: "Fall", source: "CM360", spend: 10, billingSource: "third", budgetRevisions: [{ revisionNumber: 1 }], ioFileName: "io.pdf" };
  const imported = { client: " apex ", name: "FALL", source: "cm360", spend: 25, billingSource: "reported" };
  const result = mergeCampaignImports([existing], [imported]);
  assert.equal(result.campaigns.length, 1);
  assert.equal(result.campaigns[0].spend, 25);
  assert.equal(result.campaigns[0].billingSource, "third");
  assert.equal(result.campaigns[0].ioFileName, "io.pdf");
  assert.deepEqual(result.campaigns[0].budgetRevisions, [{ revisionNumber: 1 }]);
  assert.equal(result.updated, 1);
});

test("consolidates different reporting sources into one campaign comparison", () => {
  const result = mergeCampaignImports([{ client: "Apex", name: "Fall", source: "CM360", spend: 100 }], [{ client: "Apex", name: "Fall", source: "DSP", spend: 115 }]);
  assert.equal(result.campaigns.length, 1);
  assert.equal(result.updated, 1);
  assert.equal(result.campaigns[0].firstPartySpend, 115);
  assert.equal(result.campaigns[0].thirdPartySpend, 100);
  assert.deepEqual(result.campaigns[0].sources, ["CM360", "DSP"]);
});

test("matches stable campaign IDs when a display name changes", () => {
  const existing = { client: "Apex", name: "Editable dashboard name", campaignId: "CMP-42", source: "CM360", spend: 100 };
  const imported = { client: "Apex", name: "Platform campaign name", campaignId: "cmp-42", source: "DSP", spend: 115 };
  const result = mergeCampaignImports([existing], [imported]);
  assert.equal(result.campaigns.length, 1);
  assert.equal(result.campaigns[0].name, "Editable dashboard name");
  assert.equal(result.campaigns[0].firstPartySpend, 115);
});

test("does not merge campaigns with the same name and different stable IDs", () => {
  const existing = { client: "Apex", name: "Fall", campaignId: "CMP-1", source: "CM360" };
  const imported = { client: "Apex", name: "Fall", campaignId: "CMP-2", source: "CM360" };
  const result = mergeCampaignImports([existing], [imported]);
  assert.equal(result.campaigns.length, 2);
  assert.equal(result.added, 1);
});

test("adopts a stable ID when upgrading a legacy name-matched campaign", () => {
  const existing = { client: "Apex", name: "Fall", source: "CM360", spend: 100 };
  const imported = { client: "Apex", name: "Fall", campaignId: "CMP-42", source: "CM360", spend: 120 };
  const result = mergeCampaignImports([existing], [imported]);
  assert.equal(result.campaigns.length, 1);
  assert.equal(result.campaigns[0].campaignId, "CMP-42");
});

test("preserves an IO-backed approved budget during performance refreshes", () => {
  const existing = { client: "Apex", name: "Fall", source: "CM360", budget: 250, ioFileName: "approved.pdf" };
  const result = mergeCampaignImports([existing], [{ client: "Apex", name: "Fall", source: "CM360", budget: 999 }]);
  assert.equal(result.campaigns[0].budget, 250);
});

test("does not mutate existing or imported arrays", () => {
  const existing = [{ client: "Apex", name: "Fall", source: "CM360", spend: 1 }];
  const imported = [{ client: "Apex", name: "Fall", source: "CM360", spend: 2 }];
  mergeCampaignImports(existing, imported);
  assert.equal(existing[0].spend, 1);
  assert.equal(imported[0].spend, 2);
});
