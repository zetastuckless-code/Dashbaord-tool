import test from "node:test";
import assert from "node:assert/strict";
import { exportAlertsCsv } from "../lib/alert-export.js";
import { parseCsv } from "../lib/importer.js";

test("exports active alert context and campaign ownership safely", () => {
  const alerts = [{ id: "cmp-1-over", severity: "critical", title: "Overpacing", detail: "120% pacing, limit 110%", campaign: { client: "Apex, Inc.", name: "Launch", campaignId: "CMP-1", owner: "Jordan", channel: "Video", sources: ["DSP", "CM360"], dataAsOf: "2026-09-25" } }];
  const [headers, row] = parseCsv(exportAlertsCsv(alerts, "2026-09-28T12:00:00.000Z"));
  assert.equal(row[headers.indexOf("severity")], "critical");
  assert.equal(row[headers.indexOf("client")], "Apex, Inc.");
  assert.equal(row[headers.indexOf("source")], "DSP + CM360");
  assert.equal(row[headers.indexOf("exported_at")], "2026-09-28T12:00:00.000Z");
});

test("exports headers when no active alerts remain", () => {
  assert.equal(parseCsv(exportAlertsCsv([])).length, 1);
});
