import test from "node:test";
import assert from "node:assert/strict";
import { dailyTotalRows, rawDataSheet, reportSheet, reportWorkbook } from "../lib/report-export.js";

const report = {
  start: "2026-10-01", end: "2026-10-31", grain: "month",
  rows: [{ bucket: "2026-10", group: "NY", spend: 12929.65, impressions: 2585930, ctr: 0.12, days: 30, estimatedDays: 0 }],
  total: { spend: 12929.65, impressions: 2585930, ctr: 0.12, days: 30, estimatedDays: 0 }
};
const columns = [["spend", "Spend", "money"], ["impressions", "Impressions", "count"], ["ctr", "CTR", "percent"]];

test("the report tab has the date, the group, the chosen columns, and a total", () => {
  const sheet = reportSheet(report, columns, { groupLabel: "Line", bucketText: bucket => `Month ${bucket}` });
  assert.deepEqual(sheet[0].map(cell => cell.value), ["Date", "Line", "Spend", "Impressions", "CTR", "Days", "Estimated days"]);
  assert.deepEqual(sheet[1].slice(0, 3), ["Month 2026-10", "NY", { value: 12929.65, type: Number, format: "[$$-409]#,##0.00" }]);
  // A blank number is an empty cell, not a formatted nothing.
  assert.equal(reportSheet({ ...report, rows: [{ ...report.rows[0], ctr: null }] }, columns)[1][4], null);
  assert.equal(sheet.at(-1)[1].value, "Total");
});

test("the data tab lists each DCM or DSP row with its line, and sums the numbers", () => {
  const sheet = rawDataSheet([{ date: "2026-10-05", source: "CM360", campaign: "McMaster", placement: "Zeta_NY_300x250", creative: "A", impressions: 1000, clicks: 2, line: "McMaster — NY" }]);
  assert.equal(sheet.length, 3);
  assert.equal(sheet[1][1], "DCM");
  assert.equal(sheet[1][13], "McMaster — NY");
  assert.equal(sheet[2][6].value, "SUM(G2:G2)");
});

test("lines without kept rows fall back to their daily totals, and the workbook has both tabs", () => {
  const rows = dailyTotalRows({ name: "McMaster — NY", thirdPartyDelivery: { CM360: { "2026-09-30": { impressions: 5 }, "2026-10-02": { impressions: 900 } } } }, "2026-10-01", "2026-10-31");
  assert.deepEqual(rows.map(row => [row.date, row.placement, row.impressions]), [["2026-10-02", "All placements (daily total)", 900]]);
  assert.deepEqual(reportWorkbook({ report, columns, rawRows: rows }).map(sheet => sheet.sheet), ["Report", "DCM & DSP data"]);
});
