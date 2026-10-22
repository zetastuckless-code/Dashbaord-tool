import test from "node:test";
import assert from "node:assert/strict";
import { detectRawLineTable, extractRawLines } from "../lib/raw-line-breakdown.js";

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
