import test from "node:test";
import assert from "node:assert/strict";
import { exportCampaignsCsv } from "../lib/dashboard-export.js";
import { parseCsv } from "../lib/importer.js";

const asOf = new Date("2026-09-25T12:00:00Z");

test("exports the filtered campaign view with selected spend and calculated pacing", () => {
  const campaigns = [
    { client: "Apex, Inc.", name: "Live", campaignId: "CMP-1", channel: "Video", startDate: "2026-09-01", endDate: "2026-09-30", spend: 90, firstPartySpend: 120, thirdPartySpend: 90, billingSource: "third", budget: 300, kpi: "CTR", value: "1%", target: "Target 1%", source: "CM360", impressions: 1000, clicks: 10 },
    { client: "Nova", name: "Complete", startDate: "2026-08-01", endDate: "2026-08-31", spend: 50, budget: 100, pacing: 50, source: "DSP" }
  ];
  const rows = parseCsv(exportCampaignsCsv(campaigns, { client: "Apex, Inc.", status: "live", spendView: "first" }, asOf));
  assert.equal(rows.length, 2);
  const record = Object.fromEntries(rows[0].map((header, index) => [header, rows[1][index]]));
  assert.equal(record.client, "Apex, Inc.");
  assert.equal(record.channel, "Video");
  assert.equal(record.spend_view, "first");
  assert.equal(record.spend, "120");
  assert.equal(record.pacing, "36");
  assert.equal(record.source_variance, "30");
  assert.equal(record.source_variance_percent, "33.33");
  assert.equal(record.impressions, "1000");
});

test("exports headers when no campaigns match", () => {
  assert.equal(parseCsv(exportCampaignsCsv([], {}, asOf)).length, 1);
});

test("exports spend for the selected snapshot reporting period", () => {
  const performanceSnapshots = [
    { date: "2026-09-18", source: "CM360", spend: 300, impressions: 1000, clicks: 10 },
    { date: "2026-09-25", source: "CM360", spend: 475, impressions: 2500, clicks: 40 }
  ];
  const csv = exportCampaignsCsv([{ client: "Apex", name: "Launch", source: "CM360", spend: 475, budget: 1000, pacing: 100, kpi: "CTR", value: "1.6%", performanceSnapshots }], { period: "7" });
  const [headers, row] = parseCsv(csv);
  assert.equal(row[headers.indexOf("reporting_period")], "7");
  assert.equal(row[headers.indexOf("spend_view")], "reported snapshot");
  assert.equal(row[headers.indexOf("spend")], "175");
  assert.equal(row[headers.indexOf("impressions")], "1500");
  assert.equal(row[headers.indexOf("clicks")], "30");
  assert.equal(row[headers.indexOf("kpi_value")], "2%");
});

test("exports a blank period spend when history is unavailable", () => {
  const csv = exportCampaignsCsv([{ client: "Apex", name: "Launch", source: "CM360", spend: 475, budget: 1000, pacing: 100 }], { period: "30" });
  const [headers, row] = parseCsv(csv);
  assert.equal(row[headers.indexOf("spend")], "");
  assert.equal(row[headers.indexOf("kpi_value")], "");
});


test("applies campaign search to dashboard exports", () => {
  const campaigns = [
    { client: "Apex", name: "Video Launch", campaignId: "VID-1", owner: "Jordan", source: "CM360", spend: 10, budget: 20, pacing: 100 },
    { client: "Apex", name: "Display Launch", campaignId: "DSP-2", owner: "Morgan", source: "DSP", spend: 10, budget: 20, pacing: 100 }
  ];
  const rows = parseCsv(exportCampaignsCsv(campaigns, { query: "vid-1" }, asOf));
  assert.equal(rows.length, 2);
  assert.equal(rows[1][rows[0].indexOf("campaign")], "Video Launch");
});

test("exports campaigns in the selected dashboard sort order", () => {
  const campaigns = [
    { client: "Apex", name: "Lower spend", source: "DSP", spend: 10, budget: 20, pacing: 100 },
    { client: "Apex", name: "Higher spend", source: "DSP", spend: 30, budget: 40, pacing: 100 }
  ];
  const rows = parseCsv(exportCampaignsCsv(campaigns, { sort: "spend" }, asOf));
  assert.equal(rows[1][rows[0].indexOf("campaign")], "Higher spend");
});


test("exports the selected calculated KPI view", () => {
  const campaign = { client: "Apex", name: "Launch", source: "DSP", spend: 100, budget: 200, pacing: 100, kpi: "CPA", value: "$50", target: "Target $40", impressions: 1000, clicks: 25 };
  const [headers, row] = parseCsv(exportCampaignsCsv([campaign], { kpiView: "CTR" }, asOf));
  assert.equal(row[headers.indexOf("kpi")], "CTR");
  assert.equal(row[headers.indexOf("kpi_value")], "2.5%");
  assert.equal(row[headers.indexOf("kpi_target")], "Calculated from imported components");
});
