import test from "node:test";
import assert from "node:assert/strict";
import { findHeaderRow, rowsToCsv } from "../lib/workbook-import.js";
import { extractPerformanceSummaryCampaigns, inferClientName, mergeNativeCampaigns, sheetPriority } from "../lib/native-workbook-import.js";
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

test("imports a flight summary without a budget column and leaves the budget blank", () => {
  const rows = [
    [null, null, "Note: not for billing"],
    [null, null, "ZIAO-1_Ro2 - National Pork Board", null, null, null, null, null, null, "Start Date", "2026-05-25"],
    [null, null, null, null, null, null, null, null, null, "End Date", "2026-09-07"],
    [null, null, "Channel", "Impressions", "Clicks", "CTR", "Video Starts", "Video Completions", "VCR", "Spend"],
    [null, null, "Display Awareness", 14_829_299, 63_717, 0.0043, null, null, null, 66_731.85],
    [null, null, "OLV", 5_364_470, 2_921, 0.0005, 5_359_966, 4_943_425, 0.92, 75_102.58],
    [null, null, null, 20_193_769, 66_638, 0.0033, 5_359_966, 4_943_425, 0.92, 141_834.43]
  ];
  const campaigns = extractPerformanceSummaryCampaigns(rows, { sheetName: "05.25-09.07 Flight", fileName: "National Pork Board - Flight 2 2026 Reporting.xlsx" });
  assert.equal(campaigns.length, 2);
  assert.equal(campaigns[0].client, "National Pork Board");
  assert.equal(campaigns[0].campaign, "Display Awareness");
  assert.equal(campaigns[0].budget, "");
  assert.equal(campaigns[0].start_date, "2026-05-25");
  const result = validateCampaignCsv(rowsToCsv([Object.keys(campaigns[0]), ...campaigns.map(campaign => Object.values(campaign))]));
  assert.equal(result.valid, true);
  assert.equal(result.campaigns[0].budget, null);
});

test("strips flight and date-range report suffixes from client names", () => {
  assert.equal(inferClientName("National Pork Board - Flight 2 2026 Reporting.xlsx"), "National Pork Board");
  assert.equal(inferClientName("National Pork Board - March-December 2026 Reporting Montly.xlsx"), "National Pork Board");
});

test("keeps the most recent flight when a workbook repeats a line across flights", () => {
  const flight = (end, spend) => ({ client: "NPB", campaign: "OLV", campaign_id: "", channel: "OLV", end_date: end, spend, first_party_spend: spend, third_party_spend: "" });
  const [merged] = mergeNativeCampaigns([flight("2026-04-15", 100), flight("2026-09-07", 300), flight("2026-06-01", 200)]);
  assert.equal(merged.spend, 300);
});

test("ignores a later flight that has not delivered yet", () => {
  const flight = (end, spend) => ({ client: "NPB", campaign: "OLV", campaign_id: "", channel: "OLV", end_date: end, spend, first_party_spend: spend, third_party_spend: "" });
  const [merged] = mergeNativeCampaigns([flight("2026-09-07", 300), flight("2026-12-31", 0)]);
  assert.equal(merged.spend, 300);
});

test("uses ad-server impressions (matching Clicks and CTR), keeps DSP impressions separately, and records the source row", () => {
  const rows = [
    [null, null, "Line", "Impressions", "Clicks", "CTR", "DCM Spend", "DSP Impression", "DSP Spend", "IO Budget"],
    [null, "Flight 1", "Display", 6_567_625, 144, 0.0000219, 21_344.78, 2_892_266, 9_399.86, 20_782.86],
    [null, "Flight 2", "Display", 9_432_378, 245, 0.000026, 30_655.23, null, null, 20_782.86]
  ];
  const [one, two] = extractPerformanceSummaryCampaigns(rows, { sheetName: "Hyperlocal", fileName: "RAC Report.xlsx" });
  assert.deepEqual([one.impressions, one.dsp_impressions, one.source_sheet, one.source_row], [6_567_625, 2_892_266, "Hyperlocal", 2]);
  assert.deepEqual([two.impressions, two.dsp_impressions, two.source_row], [9_432_378, "", 3]);
  const result = validateCampaignCsv(rowsToCsv([Object.keys(one), Object.values(one), Object.values(two)]));
  assert.equal(result.valid, true);
  assert.deepEqual([result.campaigns[0].dspImpressions, result.campaigns[0].sourceSheet, result.campaigns[0].sourceRow, result.campaigns[1].dspImpressions], [2_892_266, "Hyperlocal", 2, undefined]);
});

test("falls back to DSP impressions when a row has no ad-server impressions", () => {
  const rows = [[null, null, "Line", "Impressions", "Clicks", "DSP Impression", "DSP Spend", "IO Budget"], [null, "Flight 1", "Display", null, 10, 5_000, 100, 500]];
  const [campaign] = extractPerformanceSummaryCampaigns(rows, { sheetName: "S", fileName: "x.xlsx" });
  assert.equal(campaign.impressions, 5_000);
});
