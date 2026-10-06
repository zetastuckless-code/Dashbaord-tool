import test from "node:test";
import assert from "node:assert/strict";
import { applySetupEdits, rowForCreatedCampaign, setupFieldsFromRow, validateSetupEdits } from "../lib/new-campaign-setup.js";
import { validateCampaignCsv } from "../lib/importer.js";
import { createCampaign } from "../lib/campaign-creation.js";
import { mergeCampaignImports } from "../lib/import-merge.js";

const header = "client,campaign,spend,budget,pacing,kpi,kpi_value,kpi_target,source,campaign_id,owner,channel,start_date,end_date,billing_source";
const [row] = validateCampaignCsv(`${header}\nAcme,Fall Launch,1000,5000,40,CTR,0.2%,0.25%,DSP,AC-1,Pat,Display,2026-09-01,2026-10-31,DSP`).campaigns;

test("pre-fills the setup form from a report row in the form's own terms", () => {
  assert.deepEqual(setupFieldsFromRow(row), { client: "Acme", name: "Fall Launch", campaignId: "AC-1", owner: "Pat", channel: "Display", startDate: "2026-09-01", endDate: "2026-10-31", budget: "5000", billingSource: "first", kpi: "CTR", target: "0.25%", reportCadence: "none" });
  assert.equal(setupFieldsFromRow({ ...row, budget: null, source: "CM360", billingSource: "CM360" }).budget, "");
  assert.equal(setupFieldsFromRow({ ...row, billingSource: "CM360" }).billingSource, "third");
});

test("applies setup edits over the report row and leaves untouched fields alone", () => {
  const edited = applySetupEdits(row, { name: "Fall Launch 2026", owner: "Sam", channel: "", kpi: "vcr", target: "70%", billingSource: "third", reportCadence: "weekly", endDate: "2026-11-30" });
  assert.deepEqual([edited.name, edited.owner, edited.channel, edited.kpi, edited.target, edited.billingSource, edited.reportCadence, edited.endDate], ["Fall Launch 2026", "Sam", null, "VCR", "Target 70%", "third", "weekly", "2026-11-30"]);
  assert.equal(edited.spend, 1000);
  assert.equal(edited.client, "Acme");
  assert.equal(applySetupEdits(row, {}), row);
});

test("a typed budget that differs from the report becomes a locked manual budget; blank keeps the report's", () => {
  assert.deepEqual([applySetupEdits(row, { budget: "$9,000" }).budget, applySetupEdits(row, { budget: "$9,000" }).budgetSource], [9000, "manual"]);
  assert.equal(applySetupEdits(row, { budget: "5000" }).budgetSource, row.budgetSource);
  assert.equal(applySetupEdits(row, { budget: "" }).budget, 5000);
  assert.equal(applySetupEdits(row, { budget: "abc" }).budget, 5000);
});

test("clearing the campaign ID flags the row for mapping", () => {
  const cleared = applySetupEdits(row, { campaignId: "" });
  assert.deepEqual([cleared.campaignId, cleared.requiresMapping], [null, true]);
});

test("validates setup edits", () => {
  assert.deepEqual(validateSetupEdits(setupFieldsFromRow(row)), []);
  assert.equal(validateSetupEdits({ client: "", name: "" }).length, 2);
  assert.ok(validateSetupEdits({ client: "A", name: "B", budget: "-4" })[0].includes("Budget"));
  assert.ok(validateSetupEdits({ client: "A", name: "B", startDate: "2026-10-02", endDate: "2026-10-01" })[0].includes("End date"));
  assert.ok(validateSetupEdits({ client: "A", name: "B", startDate: "soon" })[0].includes("Start date"));
});

test("a report row merges into a campaign created from it without overwriting the confirmed setup", () => {
  const form = { ...setupFieldsFromRow(row), kpi: "ROAS", target: "3x", owner: "Sam", budget: "7000" };
  const created = createCampaign({ ...form, budgetSource: "report", ioFileName: "" }).campaign;
  const merged = mergeCampaignImports([created], [rowForCreatedCampaign(row, created)]);
  assert.equal(merged.updated, 1);
  assert.equal(merged.campaigns.length, 1);
  const [campaign] = merged.campaigns;
  assert.deepEqual([campaign.spend, campaign.kpi, campaign.target, campaign.owner], [1000, "ROAS", "Target 3x", "Sam"]);
});
