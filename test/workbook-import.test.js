import test from "node:test";
import assert from "node:assert/strict";
import { findHeaderRow, rowsToCsv } from "../lib/workbook-import.js";
import { extractPerformanceSummaryCampaigns, inferClientName, sheetPriority } from "../lib/native-workbook-import.js";
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

test("extracts a Zeta performance summary into a canonical campaign", () => {
  const rows = [
    [null, null, "ADVERTISER", "McMaster-Carr Supply Company", null, null, "START", new Date("2026-07-06T00:00:00Z")],
    [null, null, "Campaign", "Display Q3", null, null, "END", new Date("2026-09-30T00:00:00Z")],
    [null, null, "Campaign ID", 234797],
    [],
    [null, "Line Item", "Impressions", "Clicks", "CTR", "Spend", "Offline Conversions", "CPM", "IO Budget", "IO Impressions", "Percent Delivered"],
    [null, "Display", 45_761_247, 80_152, 0.0017515, 226_074.74, 50_501, 5, 248_400, 49_680_000, 0.92112],
    [null, "Total", 45_761_247, 80_152, 0.0017515, 226_074.74, 50_501, null, 248_400, 49_680_000, 0.92112]
  ];
  const [campaign] = extractPerformanceSummaryCampaigns(rows, { sheetName: "DSP Performance Overview", fileName: "report.xlsx" });
  assert.equal(campaign.client, "McMaster-Carr Supply Company");
  assert.equal(campaign.campaign, "Display Q3");
  assert.equal(campaign.campaign_id, "234797");
  assert.equal(campaign.spend, 226_074.74);
  assert.equal(campaign.budget, 248_400);
  assert.equal(campaign.pacing, 92.112);
  assert.equal(campaign.kpi, "CPA");
  assert.equal(campaign.first_party_spend, 226_074.74);
});

test("extracts DSP and DCM spend columns from a Rent-A-Center flight summary", () => {
  const rows = [
    [null, null, "Line", "Impressions", "Clicks", "CTR", "DCM Spend", "DSP Impression", "DSP Spend", "DCM Conversion", "DSP Conversions", "DCM CPA", "DSP CPA", "Offline Conversions", "Total CPA", "Cost", null, "IO Budget", null, "Delivery"],
    [null, "Flight 1", "Display", 11_311_618, 5_875, 0.000519, 36_762.76, 11_698_377, 39_019.73, 375, 330, 98.03, 118.24, 851, 29.98, 3.25, null, 23_751.74, null, 1.54779]
  ];
  const [campaign] = extractPerformanceSummaryCampaigns(rows, { sheetName: "Drive_To_Store", fileName: "9.29_Zeta Global Performance Report-Rent A Center Q2-Q3_2026.xlsx" });
  assert.equal(campaign.client, "Rent A Center");
  assert.equal(campaign.campaign, "Drive To Store — Flight 1");
  assert.equal(campaign.first_party_spend, 39_019.73);
  assert.equal(campaign.third_party_spend, 36_762.76);
  assert.equal(campaign.kpi, "CPA");
});

test("uses report goals as CTR targets and filename fallbacks for client names", () => {
  const rows = [
    [null, "Line Item", "Impressions", "Clicks", "CTR", "Video Starts", "Video Completes", "VCR", "CPM", "Spend", "Budget", "Goal"],
    [null, "Standard Display", 37_063_208, 43_490, 0.0011734, null, null, null, 4, 148_252.832, 176_083.76, 0.0011]
  ];
  const [campaign] = extractPerformanceSummaryCampaigns(rows, { sheetName: "Performance Summary", fileName: "Highmark - COMM - Legacy & SEPA 9.29.26.xlsx" });
  assert.equal(campaign.client, "Highmark");
  assert.equal(campaign.kpi, "CTR");
  assert.equal(campaign.kpi_target, "0.11%");
  assert.equal(inferClientName("Zeta Global Nature's Sunshine Display Report 09.28.26.xlsx"), "Nature's Sunshine");
});

test("never scans raw-data, pixel, or mapping worksheets", () => {
  for (const name of ["DSP Raw Data", "Pixel Data", "Mapping"]) assert.equal(sheetPriority(name), 3);
  assert.equal(sheetPriority("Performance Summary"), 0);
  assert.equal(sheetPriority("May"), 2);
});
