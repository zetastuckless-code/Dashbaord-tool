import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, parseCsv, validateCampaignCsv } from "../lib/importer.js";

const header = "client,campaign,spend,budget,pacing,kpi,kpi_value,kpi_target,source,updated";

test("parseCsv handles quoted commas, escaped quotes, CRLF, and blank rows", () => {
  const rows = parseCsv('client,campaign\r\n"Apex, Inc.","Fall ""Launch"""\r\n\r\n');
  assert.deepEqual(rows, [["client", "campaign"], ["Apex, Inc.", 'Fall "Launch"']]);
});

test("parseCsv rejects an unclosed quoted field", () => {
  assert.throws(() => parseCsv('client,campaign\nApex,"Fall'), /unclosed quoted value/);
});

test("validateCampaignCsv transforms a valid campaign report", () => {
  const result = validateCampaignCsv(`${header}\nApex Athletics,Fall Video,"$1,000","$2,000",50%,vcr,74.8%,70%,CM360,Today`);
  assert.equal(result.valid, true);
  assert.equal(result.campaigns.length, 1);
  assert.deepEqual(result.campaigns[0], {
    client: "Apex Athletics", name: "Fall Video", campaignId: null, requiresMapping: true, owner: null, channel: null, startDate: null, endDate: null, dataAsOf: null, short: "AA", className: "apex",
    spend: 1000, budget: 2000, pacing: 50, kpi: "VCR", value: "74.8%", reportedValue: "74.8%",
    target: "Target 70%", source: "CM360", billingSource: "CM360",
    firstPartySpend: null, thirdPartySpend: null, impressions: null, clicks: null, conversions: null, revenue: null,
    videoStarts: null, videoCompletions: null, updated: "Today"
  });
  assert.equal(result.warnings.length, 4);
});

test("validateCampaignCsv has no warnings when the complete optional contract is present", () => {
  const completeHeader = `${header},campaign_id,start_date,end_date,data_as_of,first_party_spend,third_party_spend`;
  const result = validateCampaignCsv(`${completeHeader}\nApex,Fall,95,200,50,CTR,1%,1%,CM360,Today,CMP-1,2026-09-01,2026-09-30,2026-09-25,95,90`);
  assert.equal(result.valid, true);
  assert.deepEqual(result.warnings, []);
});

test("validateCampaignCsv calculates KPI values from optional component metrics", () => {
  const result = validateCampaignCsv(`${header},impressions,clicks\nApex,Fall,95,200,50,CTR,reported-value,1%,CM360,Today,10000,125`);
  assert.equal(result.valid, true);
  assert.equal(result.campaigns[0].value, "1.25%");
  assert.equal(result.campaigns[0].reportedValue, "reported-value");
});

test("validateCampaignCsv rejects invalid optional component metrics", () => {
  const result = validateCampaignCsv(`${header},impressions,clicks\nApex,Fall,95,200,50,CTR,1%,1%,CM360,Today,10000,-1`);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes("optional performance metrics")));
});

test("validateCampaignCsv accepts optional source-comparison fields", () => {
  const sourceHeader = `${header},billing_source,first_party_spend,third_party_spend`;
  const result = validateCampaignCsv(`${sourceHeader}\nApex,Fall,95,200,50,CTR,1%,1%,CM360,Today,CM360,110,95`);
  assert.equal(result.valid, true);
  assert.equal(result.campaigns[0].billingSource, "CM360");
  assert.equal(result.campaigns[0].firstPartySpend, 110);
  assert.equal(result.campaigns[0].thirdPartySpend, 95);
});

test("validateCampaignCsv preserves an optional stable campaign ID", () => {
  const result = validateCampaignCsv(`${header},campaign_id\nApex,Fall,95,200,50,CTR,1%,1%,CM360,Today,CMP-42`);
  assert.equal(result.valid, true);
  assert.equal(result.campaigns[0].campaignId, "CMP-42");
  assert.equal(result.campaigns[0].requiresMapping, false);
});

test("validateCampaignCsv accepts a valid campaign flight", () => {
  const result = validateCampaignCsv(`${header},start_date,end_date\nApex,Fall,95,200,50,CTR,1%,1%,CM360,Today,2026-09-01,2026-09-30`);
  assert.equal(result.valid, true);
  assert.equal(result.campaigns[0].startDate, "2026-09-01");
  assert.equal(result.campaigns[0].endDate, "2026-09-30");
});

test("validateCampaignCsv rejects incomplete or reversed flights", () => {
  const incomplete = validateCampaignCsv(`${header},start_date,end_date\nApex,Fall,95,200,50,CTR,1%,1%,CM360,Today,2026-09-01,`);
  const reversed = validateCampaignCsv(`${header},start_date,end_date\nApex,Fall,95,200,50,CTR,1%,1%,CM360,Today,2026-09-30,2026-09-01`);
  assert.match(incomplete.errors[0], /must both use valid YYYY-MM-DD/);
  assert.ok(reversed.errors.some(error => error.includes("on or after start date")));
});

test("validateCampaignCsv accepts and validates the optional data-through date", () => {
  const valid = validateCampaignCsv(`${header},report_date\nApex,Fall,95,200,50,CTR,1%,1%,CM360,Today,2026-09-25`);
  const invalid = validateCampaignCsv(`${header},data_as_of\nApex,Fall,95,200,50,CTR,1%,1%,CM360,Today,09/25/2026`);
  assert.equal(valid.campaigns[0].dataAsOf, "2026-09-25");
  assert.match(invalid.errors[0], /data as of must use a valid YYYY-MM-DD/);
});

test("validateCampaignCsv maps common report header aliases", () => {
  const aliasHeader = "Advertiser Name,Campaign Name,Media Cost,Approved Budget,Pacing (%),Primary KPI,Current Value,Goal,Platform";
  const result = validateCampaignCsv(`${aliasHeader}\nApex,Fall Video,100,200,50,VCR,74%,70%,CM360`);
  assert.equal(result.valid, true);
  assert.equal(result.campaigns[0].client, "Apex");
  assert.equal(result.campaigns[0].spend, 100);
});

test("validateCampaignCsv reports missing columns", () => {
  const result = validateCampaignCsv("client,campaign\nApex,Fall Video");
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /Missing required columns/);
});

test("validateCampaignCsv rejects duplicate headers", () => {
  const result = validateCampaignCsv(`${header},spend\nApex,Fall,1,2,50,CTR,1%,1%,CM360,Today,1`);
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /Duplicate column: spend/);
});

test("validateCampaignCsv rejects malformed, negative, and duplicate rows atomically", () => {
  const row = "Apex,Fall,-1,0,50,CTR,1%,1%,CM360,Today";
  const result = validateCampaignCsv(`${header}\n${row}\n${row}`);
  assert.equal(result.valid, false);
  assert.equal(result.campaigns.length, 0);
  assert.ok(result.errors.some(error => error.includes("budget must be above zero")));
  assert.ok(result.errors.some(error => error.includes("duplicate client")));
});

test("escapeHtml neutralizes imported markup", () => {
  assert.equal(escapeHtml('<img src="x"> & test'), "&lt;img src=&quot;x&quot;&gt; &amp; test");
});
