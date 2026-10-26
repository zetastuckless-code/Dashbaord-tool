import test from "node:test";
import assert from "node:assert/strict";
import { conversionsByLine, detectRawLineTable, extractRawLines } from "../lib/raw-line-breakdown.js";

const header = ["Placement Name", "Date", "Placement", "Creative", "Impressions", "Clicks", "Media Cost", "Line Item"];
const day = (placement, date, spend, line = "Display") => [placement, new Date(`${date}T00:00:00Z`), `Zeta_${placement}`, `${placement}_creative`, 1000, 2, spend, line];

test("placement and creative columns never become lines", () => {
  const rows = [header, day("LapsedWebsite_160x600", "2026-01-01", 10), day("LapsedWebsite_300x250", "2026-01-01", 20), day("Lookalikes_728x90", "2026-01-02", 30)];
  const detection = detectRawLineTable(rows);
  assert.deepEqual(detection.lineColumns, [7]);
  const lines = extractRawLines(rows, detection, { client: "Nature's Sunshine", campaign: "Nature's Sunshine 2026" });
  assert.deepEqual(lines.map(line => [line.campaign, line.spend]), [["Nature's Sunshine 2026 — Display", 60]]);
});

test("line-item values that vary are the lines", () => {
  const rows = [header, day("A_300x250", "2026-01-01", 10, "Display"), day("B_1x1", "2026-01-01", 40, "YouTube"), day("A_728x90", "2026-01-02", 5, "Display")];
  const lines = extractRawLines(rows, detectRawLineTable(rows), { client: "Acme", campaign: "Acme 2026" });
  assert.deepEqual(lines.map(line => [line.campaign, line.spend]).sort(), [["Acme 2026 — Display", 15], ["Acme 2026 — YouTube", 40]]);
});

test("a table with only placement columns is not a line table", () => {
  const rows = [["Date", "Placement", "Impressions", "Spend"], [new Date("2026-01-01T00:00:00Z"), "P_300x250", 10, 1]];
  assert.equal(detectRawLineTable(rows), null);
});

test("a matched conversions tab fills in conversions by line and day", () => {
  const date = iso => new Date(`${iso}T00:00:00Z`);
  const delivery = [["Date", "Campaign", "Line Item", "Impressions", "Clicks", "Spend", "Line Item3"],
    [date("2026-07-06"), "ZCA-7609_McMaster Q3", "McMaster Q3_NY", 1000, 2, 10, "New York"],
    [date("2026-07-06"), "ZCA-7609_McMaster Q3", "McMaster Q3_NY_AV", 500, 1, 0, "New York"],
    [date("2026-07-07"), "ZCA-7609_McMaster Q3", "McMaster Q3_Austin", 800, 1, 8, "Austin"]];
  const matched = [["data_date", "campaign_name", "line_item", "ad", "impressions", "clicks", "spend", "conversions", "Date", "Line Item"],
    [20260706, "ZCA-7609_McMaster Q3", "McMaster Q3_NY", "ad_300x250", 600, 1, 6, 4, date("2026-07-06"), "New York"],
    [20260706, "ZCA-7609_McMaster Q3", "McMaster Q3_NY", "ad_728x90", 400, 1, 4, 1, date("2026-07-06"), "New York"],
    [20260706, "ZCA-7609_McMaster Q3", "McMaster Q3_NY_AV", "ad_300x250", 500, 1, 0, 2, date("2026-07-06"), "New York"],
    [20260707, "ZCA-7609_McMaster Q3", "McMaster Q3_Austin", "ad_300x250", 800, 1, 8, 2, date("2026-07-07"), "Austin"]];
  const added = conversionsByLine(matched, detectRawLineTable(matched));
  const lines = extractRawLines(delivery, detectRawLineTable(delivery), { client: "McMaster-Carr", addedConversions: added });
  const byName = Object.fromEntries(lines.map(line => [line.campaign.split(" — ")[1], line]));
  assert.equal(byName.NY.conversions, 5);
  assert.equal(byName.NY.kpi_value, "$2.00");
  assert.equal(byName.Austin.conversions, 2);
  // The added-value line has conversions but no cost, so it keeps CTR.
  assert.equal(byName.NY_AV.conversions, 2);
  assert.equal(byName.NY_AV.kpi, "CTR");
});

test("a line's running totals land on every month's last day, so billing has exact month edges", () => {
  const date = iso => new Date(`${iso}T00:00:00Z`);
  const rows = [["Date", "Line Item", "Impressions", "Clicks", "Spend"], [date("2026-09-28"), "NY", 100, 1, 1], [date("2026-09-29"), "NY", 100, 1, 1], [date("2026-10-02"), "NY", 100, 1, 1], [date("2026-09-28"), "Austin", 50, 0, 1]];
  const [ny] = extractRawLines(rows, detectRawLineTable(rows), { client: "McMaster" }).filter(line => line.campaign.endsWith("NY"));
  const history = JSON.parse(ny.history);
  assert.deepEqual(history.map(point => [point.date, point.impressions]), [["2026-09-27", 0], ["2026-09-30", 200], ["2026-10-02", 300]]);
});
