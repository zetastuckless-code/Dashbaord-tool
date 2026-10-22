import test from "node:test";
import assert from "node:assert/strict";
import { detectMonthlyPerformance, extractMonthlyPerformance } from "../lib/monthly-performance-import.js";
import { extractPerformanceSummaryCampaigns, refineClientName } from "../lib/native-workbook-import.js";
import { validateCampaignCsv } from "../lib/importer.js";
import { rowsToCsv } from "../lib/workbook-import.js";
import { mergePerformanceSnapshots } from "../lib/performance-snapshots.js";

// Synthetic layout mirroring a monthly video tab: one row per month and line, then a Total row.
const monthlyRows = [
  [],
  [null, "Note: not for billing"],
  [null, "Acme Foods", "1/1/26 - 10/4/26"],
  [null, null, null, null, null, null, null, null, null, "Conversions (Page)"],
  [null, "Month", "Media Format", "Line", "Impressions", "Clicks", "CTR", "Spend", "CPM", null, "Views", "VCR (100%)", "Unique Users", "Impression Goal", "View Goal", "IO Budget", "Delivery"],
  [null, "January", "YouTube", "Acme Foods 2026", 6_000_000, 5_000, 0.0008, 45_000, 7.5, 2_000, 580_000, 0.11, 4_000_000, 3_750_000, "-", 45_000, 1],
  [null, null, "YouTube", "Acme Foods 2026", 800_000, 180, 0.0002, 15_000, 18, 300, 440_000, 0.8, 570_000, "-", 148_000, 15_000, 1],
  [null, "February", "YouTube", "Acme Foods 2026", 7_000_000, 3_000, 0.0004, 55_000, 7.8, 270, 380_000, 0.19, 5_000_000, 4_500_000, "-", 55_000, 1],
  [null, null, "Total", null, 13_800_000, 8_180, 0.0005, 115_000, 8.3, 2_570, 1_400_000, 0.2, 9_000_000, null, null, 115_000, 1],
  [],
  [null, "Display", "Acme Foods 2026", 999, 9]
];

test("detects a monthly performance tab, including a conversions header split over two rows", () => {
  const detection = detectMonthlyPerformance(monthlyRows);
  assert.equal(detection.headerRow, 4);
  assert.equal(detection.columns.conversions, 9);
  assert.equal(detectMonthlyPerformance([["Line", "Impressions", "Spend"]]), null);
});

test("builds one full-flight campaign row from the Total row, with budget to date and the data-through date (not a flight end)", () => {
  const rows = extractMonthlyPerformance(monthlyRows, detectMonthlyPerformance(monthlyRows), { fileName: "Acme Foods Report.xlsx" });
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.equal(row.client, "Acme Foods");
  assert.equal(row.campaign, "Acme Foods 2026 — YouTube");
  assert.deepEqual([row.start_date, row.end_date, row.data_as_of], ["", "", "2026-10-04"]);
  assert.deepEqual([row.spend, row.budget, row.impressions, row.clicks, row.conversions], [115_000, 115_000, 13_800_000, 8_180, 2_570]);
  assert.equal(row.pacing, 100);
  assert.equal(row.kpi, "CPA");
  const result = validateCampaignCsv(rowsToCsv([Object.keys(row), Object.values(row)]));
  assert.equal(result.valid, true);
  assert.equal(result.campaigns[0].name, "Acme Foods 2026 — YouTube");
});

test("sums month rows when the tab has no Total row", () => {
  const withoutTotal = monthlyRows.filter(row => row[2] !== "Total");
  const [row] = extractMonthlyPerformance(withoutTotal, detectMonthlyPerformance(withoutTotal));
  assert.equal(row.spend, 115_000);
  assert.equal(row.impressions, 13_800_000);
});

test("keeps rows that share a label distinct by media format", () => {
  const rows = [
    [null, "Media Format", "Line", "Impressions", "Clicks", "CTR", "Spend", "Cost", "Conversions", "Revenue", "ROAS", null, "IO Budget", "Delivery"],
    [null, "Display", "Acme Foods 2026", 1000, 10, 0.01, 40, 4, 1, 100, 2.5, 9000, 100, 0.4],
    [null, "YouTube", "Acme Foods 2026", 2000, 20, 0.01, 60, 12, 0, 0, 0, 9000, 200, 0.3]
  ];
  const campaigns = extractPerformanceSummaryCampaigns(rows, { sheetName: "Performance Summary", fileName: "Acme Foods Report 10.5.2026.xlsx" });
  assert.deepEqual(campaigns.map(campaign => campaign.campaign), ["Acme Foods 2026 — Display", "Acme Foods 2026 — YouTube"]);
  const result = validateCampaignCsv(rowsToCsv([Object.keys(campaigns[0]), ...campaigns.map(campaign => Object.values(campaign))]));
  assert.equal(result.valid, true);
});

test("does not rename rows whose label already is the channel", () => {
  const rows = [
    [null, "Channel", "Impressions", "Clicks", "CTR", "Spend"],
    [null, "OLV", 100, 1, 0.01, 10],
    [null, "OLV", 200, 2, 0.01, 20]
  ];
  const names = extractPerformanceSummaryCampaigns(rows, { sheetName: "Flight", fileName: "x.xlsx" }).map(campaign => campaign.campaign);
  assert.deepEqual(names, ["OLV", "OLV"]);
});

test("uses the client printed on the sheet when the file name adds noise", () => {
  const rows = [[], [null, "Note: x"], [null, "Acme Foods"]];
  assert.equal(refineClientName("Acme Foods Report", rows), "Acme Foods");
  assert.equal(refineClientName("Other Client", rows), "Other Client");
});

// A "(Video Views)" line sits under the campaign's standard line in the same month, so the tab has two lines per format.
const twoLineRows = [
  [],
  [null, "Note: not for billing"],
  [null, "Acme Foods", "1/1/26 - 5/10/26"],
  [null, "Month", "Media Format", "Line", "Impressions", "Clicks", "CTR", "Spend", "CPM", "Conversions", "Views", "VCR (100%)", "Unique Users", "Impression Goal", "View Goal", "IO Budget", "Delivery"],
  [null, "January", "YouTube", "Acme Foods 2026", 6_000_000, 5_000, 0.0008, 45_000, 7.5, 2_000, 580_000, 0.11, 4_000_000, 3_750_000, "-", 45_000, 1],
  [null, "April", "YouTube", "Acme Foods 2026", 7_000_000, 3_000, 0.0004, 55_000, 7.8, 270, 380_000, 0.19, 5_000_000, 4_500_000, "-", 55_000, 1],
  [null, null, "YouTube", "Acme Foods 2026 (Video Views)", 800_000, 180, 0.0002, 15_000, 18, 300, 440_000, 0.8, 570_000, "-", 148_000, 15_000, 1],
  [null, "May", "YouTube", "Acme Foods 2026", 700_000, 300, 0.0004, 6_000, 8, 20, 30_000, 0.1, 500_000, 400_000, "-", 33_000, 0.2],
  [null, null, "YouTube", "Acme Foods 2026 (Video Views)", 80_000, 14, 0.0002, 1_500, 17, 13, 31_000, 0.7, 70_000, "-", 80_000, 8_000, 0.2],
  [null, null, "Total", null, 14_580_000, 8_494, 0.0005, 122_500, 8.4, 2_603, 1_461_000, 0.2, 10_000_000, null, null, 156_000, 0.8]
];

test("keeps a campaign's standard and Video Views lines as separate rows that add up to the Total", () => {
  const rows = extractMonthlyPerformance(twoLineRows, detectMonthlyPerformance(twoLineRows));
  assert.deepEqual(rows.map(row => row.campaign), ["Acme Foods 2026 — YouTube", "Acme Foods 2026 — YouTube (Video Views)"]);
  assert.deepEqual(rows.map(row => [row.spend, row.budget, row.impressions]), [[106_000, 133_000, 13_700_000], [16_500, 23_000, 880_000]]);
  assert.equal(rows.reduce((sum, row) => sum + row.spend, 0), 122_500);
  assert.equal(rows.reduce((sum, row) => sum + row.budget, 0), 156_000);
  const result = validateCampaignCsv(rowsToCsv([Object.keys(rows[0]), ...rows.map(row => Object.values(row))]));
  assert.equal(result.valid, true);
  assert.deepEqual(result.campaigns.map(campaign => campaign.name), ["Acme Foods 2026 — YouTube", "Acme Foods 2026 — YouTube (Video Views)"]);
});

test("records cumulative monthly history, holding the total flat through months with no row", () => {
  const [standard, views] = extractMonthlyPerformance(twoLineRows, detectMonthlyPerformance(twoLineRows));
  assert.deepEqual(JSON.parse(standard.history).map(entry => [entry.date, entry.spend]), [
    ["2025-12-31", 0], ["2026-01-31", 45_000], ["2026-03-31", 45_000], ["2026-04-30", 100_000], ["2026-05-10", 106_000]
  ]);
  assert.deepEqual(JSON.parse(views.history).map(entry => [entry.date, entry.spend]), [["2026-03-31", 0], ["2026-04-30", 15_000], ["2026-05-10", 16_500]]);
});

test("passes the monthly history into the imported campaign's snapshots", () => {
  const rows = extractMonthlyPerformance(twoLineRows, detectMonthlyPerformance(twoLineRows));
  const result = validateCampaignCsv(rowsToCsv([Object.keys(rows[0]), rows[0].history ? Object.values(rows[0]) : []]));
  const [campaign] = result.campaigns;
  const snapshots = mergePerformanceSnapshots({}, campaign);
  assert.deepEqual(snapshots.map(snapshot => [snapshot.date, snapshot.spend]), [
    ["2025-12-31", 0], ["2026-01-31", 45_000], ["2026-03-31", 45_000], ["2026-04-30", 100_000], ["2026-05-10", 106_000]
  ]);
  assert.equal(snapshots.at(-1).source, "Zeta Global");
});

test("rejects a malformed history column", () => {
  const rows = extractMonthlyPerformance(twoLineRows, detectMonthlyPerformance(twoLineRows));
  const bad = { ...rows[0], history: "not json" };
  assert.equal(validateCampaignCsv(rowsToCsv([Object.keys(bad), Object.values(bad)])).valid, false);
});
