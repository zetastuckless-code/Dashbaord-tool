import test from "node:test";
import assert from "node:assert/strict";
import { splitByGeo } from "../lib/geo-breakdown.js";

// A made-up summary tab: format totals on top, then the same formats split by region, then one month's split.
const rows = [
  [null, "Line Item", "Impressions", "Clicks", "Video Starts", "Video Completes", "Spend", "Budget", "Goal"],
  [null, "Standard Display", 3000, 30, null, null, 300, 320, 0.0011],
  [null, "OLV", 1000, 5, 900, 700, 400, 380, 0.73],
  [null, "Total", 4000, 35, 900, 700, 700, 700],
  [],
  [null, "Overall"],
  [null, "Geo Targeting Performance"],
  [null, "Tactic", "Impressions", "Clicks", "Video Starts", "Video Completes", "Spend", "% of Spend", "Budget"],
  [null, "Standard Display"],
  [null, "WPA", 1000, 10, null, null, 100, 0.33, 110],
  [null, "SEPA", 2000, 20, null, null, 200, 0.67, 210],
  [null, "Total", 3000, 30, null, null, 300],
  [null, "OLV"],
  [null, "WPA", 1000, 5, 900, 700, 400, 1, 380],
  [null, "Total", 1000, 5, 900, 700, 400],
  [],
  [null, "June"],
  [null, "Geo Targeting Performance"],
  [null, "Tactic", "Impressions", "Clicks", "Video Starts", "Video Completes", "Spend", "% of Spend"],
  [null, "Standard Display"],
  [null, "WPA", 400, 4, null, null, 40, 0.4],
  [null, "SEPA", 600, 6, null, null, 60, 0.6]
];
const base = { client: "Acme Health", start_date: "2026-06-15", end_date: "2026-10-23", data_as_of: "2026-10-23", source_sheet: "Performance Summary" };
const summary = [
  { ...base, campaign: "Acme Fall — Standard Display", channel: "Standard Display", spend: 300 },
  { ...base, campaign: "Acme Fall — OLV", channel: "OLV", spend: 400 }
];

test("splits format rows into region lines named the way the insertion order names them", () => {
  const lines = splitByGeo(rows, summary);
  assert.deepEqual(lines.map(line => [line.campaign, line.spend, line.budget, line.kpi]), [
    ["Acme Fall — Standard Display WPA", 100, 110, "CTR"],
    ["Acme Fall — Standard Display SEPA", 200, 210, "CTR"],
    ["Acme Fall — Online Video WPA", 400, 380, "VCR"]
  ]);
  assert.equal(lines[2].line_aliases, "OLV WPA");
  assert.equal(lines[2].kpi_target, "73%");
  const history = JSON.parse(lines[0].history);
  assert.deepEqual([history[0], history.at(-1)].map(entry => [entry.date, entry.spend]), [["2026-05-31", 0], ["2026-06-30", 40]]);
});

test("keeps the format row when its regions do not add up to it", () => {
  const off = summary.map(row => row.channel === "OLV" ? { ...row, spend: 900 } : row);
  const lines = splitByGeo(rows, off);
  assert.deepEqual(lines.map(line => line.campaign), ["Acme Fall — Standard Display WPA", "Acme Fall — Standard Display SEPA", "Acme Fall — OLV"]);
});

test("leaves a summary without a geo table alone", () => {
  assert.equal(splitByGeo(rows.slice(0, 4), summary), summary);
});
