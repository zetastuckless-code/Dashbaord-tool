import test from "node:test";
import assert from "node:assert/strict";
import { findHeaderRow, rowsToCsv } from "../lib/workbook-import.js";
import { validateCampaignCsv } from "../lib/importer.js";

test("rowsToCsv preserves commas, quotes, line breaks, dates, and blanks", () => {
  const csv = rowsToCsv([["client", "campaign", "note", "date", "blank"], ["Apex, Inc.", 'Fall "Launch"', "Line 1\nLine 2", new Date("2026-09-24T00:00:00Z"), null]]);
  assert.equal(csv, 'client,campaign,note,date,blank\n"Apex, Inc.","Fall ""Launch""","Line 1\nLine 2",2026-09-24,');
});

test("Excel-style rows round-trip through campaign CSV validation", () => {
  const rows = [["client", "campaign", "spend", "budget", "pacing", "kpi", "kpi_value", "kpi_target", "source"], ["Apex", "Fall Launch", 100, 200, 50, "CTR", "1%", "1.2%", "CM360"]];
  const result = validateCampaignCsv(rowsToCsv(rows));
  assert.equal(result.valid, true);
  assert.equal(result.campaigns[0].spend, 100);
});

test("findHeaderRow skips workbook titles and notes", () => {
  const rows = [
    ["Weekly client report"],
    ["Generated", "2026-09-24"],
    [],
    ["Client", "Campaign", "Spend", "Budget", "Pacing", "KPI", "KPI Value", "KPI Target", "Source"]
  ];
  assert.equal(findHeaderRow(rows), 3);
});

test("findHeaderRow limits scanning and rejects partial schemas", () => {
  assert.equal(findHeaderRow([["client", "campaign", "spend"]]), -1);
  const rows = Array.from({ length: 21 }, () => ["note"]);
  rows[20] = ["client", "campaign", "spend", "budget", "pacing", "kpi", "kpi_value", "kpi_target", "source"];
  assert.equal(findHeaderRow(rows), -1);
});

test("findHeaderRow recognizes aliased source headers", () => {
  const rows = [["Advertiser", "Campaign Name", "Media Cost", "Approved Budget", "Pacing Percentage", "Primary KPI", "Actual", "Target", "Platform"]];
  assert.equal(findHeaderRow(rows), 0);
});
