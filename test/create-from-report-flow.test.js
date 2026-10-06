import test from "node:test";
import assert from "node:assert/strict";
import { rowsForCreatedGroup, setupFieldsFromRow } from "../lib/new-campaign-setup.js";
import { createCampaign } from "../lib/campaign-creation.js";
import { mergeCampaignImports } from "../lib/import-merge.js";
import { groupCampaigns } from "../lib/campaign-groups.js";
import { validateCampaignCsv } from "../lib/importer.js";
import { evaluateDataHealth } from "../lib/data-health.js";
import { createImportRecord, hasSuccessfulFingerprint } from "../lib/import-history.js";

const header = "client,campaign,spend,budget,pacing,kpi,kpi_value,kpi_target,source,channel";
const rows = validateCampaignCsv([
  header,
  "Acme,Drive To Store — Flight 1,1000,5000,40,CPA,$45,$40,DSP,Display",
  "Acme,Drive To Store — Flight 2,2000,5000,50,CPA,$38,$40,DSP,Display",
  "Acme,Hyperlocal — Flight 1,3000,6000,50,CPA,$27,$40,DSP,Display"
].join("\n")).campaigns;
const dts = rows.filter(row => row.name.startsWith("Drive"));

test("creating from a multi-line campaign brings in every line, under the name confirmed on the form", () => {
  const created = createCampaign({ ...setupFieldsFromRow({ ...dts[0], name: "Drive To Store" }), name: "Drive To Store 2026", budgetSource: "report", allowUndated: true }).campaign;
  const { created: renamed, rows: toMerge } = rowsForCreatedGroup(dts, created, "Drive To Store 2026");
  assert.equal(renamed.name, "Drive To Store 2026 — Flight 1");
  const merged = mergeCampaignImports([{ ...renamed, source: "DSP" }], toMerge).campaigns;
  assert.equal(merged.length, 2);
  const [group] = groupCampaigns(merged);
  assert.deepEqual([group.name, group.records.map(record => record.name), group.records.map(record => record.spend)], ["Drive To Store 2026", ["Drive To Store 2026 — Flight 1", "Drive To Store 2026 — Flight 2"], [1000, 2000]]);
});

test("a single-line campaign is created exactly as before", () => {
  const single = rows.filter(row => row.name.startsWith("Hyper"));
  const created = createCampaign({ ...setupFieldsFromRow(single[0]), budgetSource: "report", allowUndated: true }).campaign;
  const { created: same, rows: toMerge } = rowsForCreatedGroup(single, created, created.name);
  assert.equal(same, created);
  assert.equal(toMerge.length, 1);
  assert.equal(toMerge[0].name, created.name);
});

test("a report without flight dates can create a campaign, but a typed date still has to be valid", () => {
  const base = { ...setupFieldsFromRow(dts[0]), budgetSource: "report" };
  assert.equal(createCampaign({ ...base }).valid, false);
  const undated = createCampaign({ ...base, allowUndated: true });
  assert.equal(undated.valid, true);
  assert.deepEqual([undated.campaign.startDate, undated.campaign.endDate], [null, null]);
  assert.equal(createCampaign({ ...base, allowUndated: true, startDate: "soon" }).valid, false);
});

test("a partly imported report does not block importing the rest, and is flagged in data health", () => {
  const fingerprint = "abc123";
  const partial = createImportRecord({ fileName: "report.xlsx", fingerprint, status: "Partially imported", rowCount: 2, warnings: ["2 other campaigns were not imported."] });
  assert.equal(hasSuccessfulFingerprint([partial], fingerprint), false);
  assert.equal(hasSuccessfulFingerprint([createImportRecord({ fileName: "report.xlsx", fingerprint, status: "Imported", rowCount: 3 })], fingerprint), true);
  const health = evaluateDataHealth([partial], new Date(partial.importedAt));
  assert.deepEqual([health.state, health.title, health.detail], ["warning", "Part of a report imported", "2 other campaigns were not imported."]);
});
