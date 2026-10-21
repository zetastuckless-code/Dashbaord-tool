import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseCsv } from "../lib/importer.js";
import { readReportFile } from "../lib/workbook-import.js";
import { applyLineItems, assignRecordIndex, detectLineItemExport, matchLineItemCampaign, normalizeCampaignKey, parseLineItemExport } from "../lib/line-item-import.js";
import { groupCampaigns } from "../lib/campaign-groups.js";

const asOf = new Date("2026-10-02T12:00:00Z");
const sample = async () => parseCsv(await readFile(new URL("../templates/alpha/07-dsp-line-items.csv", import.meta.url), "utf8"));

test("detects a DSP line-item export but not summaries or daily reports", async () => {
  assert.ok(detectLineItemExport(await sample()));
  assert.equal(detectLineItemExport([["Line Item", "Impressions", "Spend", "Budget"], ["A", 1, 2, 3]]), null);
  assert.equal(detectLineItemExport([["Date", "Line Item", "Line Item ID", "Impressions"], ["2026-01-01", "A", "1", "5"]]), null);
});

test("detects the DSP grid columns (Line Item/Tactic, Spend FTD, Flight Bdgt.)", () => {
  const rows = [["Status", "Line Item / Tactic", "Pricing", "Flight Bdgt.", "Spend FTD", "Imps. FTD"], ["Active", "Hispanic Audio", "CPM", "$6,250.00", "$1,309.88", "59,540"]];
  const detection = detectLineItemExport(rows);
  const parsed = parseLineItemExport(rows, detection, { fileName: "grid.csv", asOf });
  const [item] = parsed.campaigns[0].lineItems;
  assert.deepEqual([item.name, item.budget, item.spend, item.impressions, item.status, item.rateType], ["Hispanic Audio", 6250, 1309.88, 59540, "Active", "CPM"]);
});

test("parses lines, strips the campaign prefix, and keeps duplicate names distinguishable by ID", async () => {
  const rows = await sample();
  const parsed = parseLineItemExport(rows, detectLineItemExport(rows), { asOf });
  assert.equal(parsed.valid, true);
  assert.equal(parsed.campaigns.length, 2);
  const alpha = parsed.campaigns.find(entry => entry.key === "alpha retargeting");
  assert.deepEqual(alpha.lineItems.map(item => item.name), ["Chicago", "Dallas (500002)", "Dallas (500003)"]);
  assert.equal(alpha.lineItems[0].spend, 4800.5);
  assert.equal(alpha.lineItems[0].asOf, "2026-10-02");
});

test("rejects negative numbers and empty exports", () => {
  const rows = [["Line Item", "Line Item ID", "Impressions", "Spend"], ["A", "1", "-5", "2"]];
  assert.equal(parseLineItemExport(rows, detectLineItemExport(rows)).valid, false);
  const empty = [["Line Item", "Line Item ID", "Impressions"]];
  assert.match(parseLineItemExport(empty, detectLineItemExport(empty)).errors[0], /No line items/);
});

test("reads a CSV line-item export through readReportFile", async () => {
  const text = await readFile(new URL("../templates/alpha/07-dsp-line-items.csv", import.meta.url));
  const report = await readReportFile({ name: "lines.csv", type: "text/csv" }, new Uint8Array(text));
  assert.equal(report.kind, "line-items");
  assert.equal(report.parsed.lineItemCount, 4);
});

test("matches by normalized campaign name and attaches line items idempotently", async () => {
  const rows = await sample();
  const parsed = parseLineItemExport(rows, detectLineItemExport(rows), { asOf });
  const campaigns = [{ client: "Alpha", name: "Alpha Retargeting", spend: 1, budget: 2 }];
  const first = applyLineItems(campaigns, parsed);
  assert.equal(first.matched.length, 1);
  assert.equal(first.unmatched[0].key, "unlisted brand");
  assert.equal(first.campaigns[0].lineItems.length, 3);
  const second = applyLineItems(first.campaigns, parsed);
  assert.equal(second.campaigns[0].lineItems.length, 3);
  assert.deepEqual(second.campaigns[0].dspCampaignKeys, ["alpha retargeting"]);
});

test("links an unmatched source campaign to a chosen record and remembers it", async () => {
  const rows = await sample();
  const parsed = parseLineItemExport(rows, detectLineItemExport(rows), { asOf });
  const campaigns = [{ client: "A", name: "Something Else" }, { client: "B", name: "Other" }];
  const linked = applyLineItems(campaigns, parsed, { "unlisted brand": 1, "alpha retargeting": 0 });
  assert.equal(linked.unmatched.length, 0);
  assert.equal(linked.campaigns[1].lineItems.length, 1);
  assert.deepEqual(matchLineItemCampaign(linked.campaigns, { key: "unlisted brand" }), [1]);
});

test("splits a campaign's line items across its display, native, and video records", () => {
  const records = [{ name: "B2B — Standard Display", channel: "Display" }, { name: "B2B — Native Display" }, { name: "B2B — OLV", kpi: "VCR" }];
  assert.equal(assignRecordIndex(records, "Primary Audience_DE"), 0);
  assert.equal(assignRecordIndex(records, "Native_WPA"), 1);
  assert.equal(assignRecordIndex(records, "OLV_SEPA"), 2);
  const parsed = { campaigns: [{ key: "b2b", lineItems: [{ id: "1", name: "Native_A", spend: 1 }, { id: "2", name: "OLV_B", spend: 2 }, { id: "3", name: "Audience_C", spend: 3 }] }] };
  const result = applyLineItems(records.map(record => ({ client: "H", ...record })), parsed);
  assert.equal(result.matched.length, 3);
  assert.deepEqual(result.campaigns.map(record => (record.lineItems || []).map(item => item.id)), [["3"], ["1"], ["2"]]);
});

test("strips ZCA codes and punctuation when normalizing campaign names", () => {
  assert.equal(normalizeCampaignKey("ZCA-239_TruMC-Highmark - COMM"), "trumc highmark comm");
  assert.equal(normalizeCampaignKey("ZCA-239: TruMC-Highmark - COMM"), "trumc highmark comm");
});

test("attached line items surface as lines of the campaign group", async () => {
  const rows = await sample();
  const parsed = parseLineItemExport(rows, detectLineItemExport(rows), { asOf });
  const { campaigns } = applyLineItems([{ client: "Alpha", name: "Alpha Retargeting", spend: 1, budget: 2 }], parsed);
  const [group] = groupCampaigns(campaigns, asOf);
  assert.equal(group.lines.length, 3);
});
