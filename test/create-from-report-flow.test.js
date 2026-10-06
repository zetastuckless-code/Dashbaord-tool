import test from "node:test";
import assert from "node:assert/strict";
import { setupFieldsFromRow } from "../lib/new-campaign-setup.js";
import { createCampaign } from "../lib/campaign-creation.js";
import { applyAssignments, assignmentKey, inheritShellSetup, initialChoices, removeFilledShells, rememberAssignments } from "../lib/import-assignment.js";
import { mergeCampaignImports } from "../lib/import-merge.js";
import { groupCampaigns, groupKey, isPlaceholder } from "../lib/campaign-groups.js";
import { validateCampaignCsv } from "../lib/importer.js";
import { evaluateDataHealth } from "../lib/data-health.js";
import { createImportRecord, hasSuccessfulFingerprint } from "../lib/import-history.js";
import { activeRowsWithPooled, setCampaignTotals } from "../lib/campaign-totals.js";
import { buildClientRollup } from "../lib/client-rollup.js";
import { evaluateCampaignAlerts } from "../lib/alert-engine.js";

const header = "client,campaign,spend,budget,pacing,kpi,kpi_value,kpi_target,source,channel";
const rows = validateCampaignCsv([
  header,
  "Acme,Drive To Store — Flight 1,1000,5000,40,CPA,$45,Not provided,DSP,",
  "Acme,Drive To Store — Flight 2,2000,5000,50,CPA,$38,Not provided,DSP,",
  "Acme,Hyperlocal — Flight 1,3000,6000,50,CPA,$27,Not provided,DSP,"
].join("\n")).campaigns;
const dts = rows.filter(row => row.name.startsWith("Drive"));
const now = new Date("2026-10-06T12:00:00Z");

// The campaign as the New campaign form creates it from a report: setup only, no numbers.
const shell = createCampaign({ ...setupFieldsFromRow({ ...dts[0], name: "Drive To Store", owner: "Sam" }), name: "Drive To Store", owner: "Sam", target: "$40", channel: "Display", reportCadence: "weekly", budgetSource: "report", budget: "", allowUndated: true }).campaign;

test("a report with no flight dates can create a campaign, but a typed date still has to be valid", () => {
  const base = { ...setupFieldsFromRow(dts[0]), budgetSource: "report" };
  assert.equal(createCampaign({ ...base }).valid, false);
  const undated = createCampaign({ ...base, allowUndated: true });
  assert.deepEqual([undated.valid, undated.campaign.startDate, undated.campaign.endDate], [true, null, null]);
  assert.equal(createCampaign({ ...base, allowUndated: true, startDate: "soon" }).valid, false);
});

test("the report's lines are remembered as going into the new campaign, so the later import pre-selects it", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  rememberAssignments(storage, dts, Object.fromEntries(dts.map(row => [assignmentKey(row), groupKey(shell)])));
  const groups = groupCampaigns([shell]);
  const remembered = JSON.parse(data.get("northstar-import-assignments"));
  assert.deepEqual(Object.values(initialChoices(dts, remembered, groups)), [groupKey(shell), groupKey(shell)]);
  assert.equal(Object.keys(initialChoices([rows[2]], remembered, groups)).length, 0);
});

test("lines assigned to the shell inherit its confirmed setup where the report is silent", () => {
  const choices = Object.fromEntries(dts.map(row => [assignmentKey(row), groupKey(shell)]));
  const { campaigns } = applyAssignments(dts, choices, groupCampaigns([shell]));
  assert.deepEqual(campaigns.map(row => row.name), ["Drive To Store — Flight 1", "Drive To Store — Flight 2"]);
  assert.deepEqual([campaigns[0].owner, campaigns[0].channel, campaigns[0].reportCadence, campaigns[0].target], ["Sam", "Display", "weekly", "Target $40"]);
  const explicit = inheritShellSetup({ ...dts[0], target: "Target $25", owner: "Pat" }, shell);
  assert.deepEqual([explicit.owner, explicit.target], ["Pat", "Target $25"]);
});

test("once lines join, the empty shell is removed so it is never counted twice", () => {
  assert.equal(isPlaceholder(shell), true);
  const choices = Object.fromEntries(dts.map(row => [assignmentKey(row), groupKey(shell)]));
  const imported = applyAssignments(dts, choices, groupCampaigns([shell])).campaigns;
  const merged = removeFilledShells(mergeCampaignImports([shell], imported).campaigns, imported);
  assert.deepEqual(merged.map(record => record.name), ["Drive To Store — Flight 1", "Drive To Store — Flight 2"]);
  const other = removeFilledShells([shell], [rows[2]]);
  assert.equal(other.length, 1);
});

test("a shell with no budget does not raise 'Budget needed' once another line of its campaign has one", () => {
  const withLine = { ...shell, budget: null };
  const line = { ...rows[0], campaignGroup: "Drive To Store", name: "Drive To Store — Flight 1", startDate: "2026-09-01", endDate: "2026-10-31" };
  const alone = evaluateCampaignAlerts([{ ...withLine, startDate: "2026-09-01", endDate: "2026-10-31" }], undefined, now);
  assert.ok(alone.some(alert => alert.title === "Budget needed"));
  const together = evaluateCampaignAlerts([{ ...withLine, startDate: "2026-09-01", endDate: "2026-10-31" }, line], undefined, now);
  assert.equal(together.some(alert => alert.title === "Budget needed"), false);
});

// A campaign paced on an order whose YouTube line ended: its spend to date still counts toward the live totals.
const natures = (end) => [
  { client: "N", name: "Nature's Sunshine 2026 — Display", short: "N", className: "x", spend: 800_000, budget: 850_000, startDate: null, endDate: null, source: "Zeta" },
  { client: "N", name: "Nature's Sunshine 2026 — YouTube", short: "N", className: "x", spend: 500_000, budget: 520_000, startDate: "2026-01-01", endDate: end, source: "Zeta" }
];
const isLive = row => !row.endDate || row.endDate >= "2026-10-06";

test("an order-paced campaign counts all of its lines while any line is live", () => {
  const records = natures("2026-10-04");
  const key = groupKey(records[0]);
  const totals = setCampaignTotals({}, key, { orderNumber: "O-1", revision: "R1", budget: 1_500_000, startDate: "2026-01-01", endDate: "2026-12-31", lineItems: [] }, "a.pdf", now);
  assert.equal(activeRowsWithPooled(records, {}, isLive).length, 1);
  assert.equal(activeRowsWithPooled(records, totals, isLive).length, 2);
  const [client] = buildClientRollup(records, { asOf: now, totals });
  assert.equal(client.spend, 1_300_000);
  assert.equal(client.budget, 1_500_000);
  const [without] = buildClientRollup(records, { asOf: now });
  assert.equal(without.spend, 800_000);
});

test("a partly imported report does not block importing the rest, and is flagged in data health", () => {
  const fingerprint = "abc123";
  const partial = createImportRecord({ fileName: "report.xlsx", fingerprint, status: "Partially imported", rowCount: 2, warnings: ["2 other campaigns were not imported."] });
  assert.equal(hasSuccessfulFingerprint([partial], fingerprint), false);
  const health = evaluateDataHealth([partial], new Date(partial.importedAt));
  assert.deepEqual([health.state, health.title], ["warning", "Part of a report imported"]);
});
