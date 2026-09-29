import test from "node:test";
import assert from "node:assert/strict";
import { acknowledgeAlert, alertSignature, readAcknowledgedAlerts, removeAcknowledgment, unacknowledgedAlerts, writeAcknowledgedAlerts } from "../lib/alert-acknowledgments.js";

const alert = { id: "campaign-over", severity: "critical", title: "Overpacing", detail: "120% pacing" };

test("acknowledges the current alert condition idempotently", () => {
  const records = acknowledgeAlert(acknowledgeAlert([], alert, "2026-09-28T10:00:00Z"), alert, "2026-09-28T11:00:00Z");
  assert.equal(records.length, 1);
  assert.equal(records[0].signature, alertSignature(alert));
  assert.equal(records[0].acknowledgedAt, "2026-09-28T11:00:00Z");
  assert.deepEqual(unacknowledgedAlerts([alert, { id: "campaign-kpi" }], records), [{ id: "campaign-kpi" }]);
});

test("reopens an acknowledged alert when its evaluated condition changes", () => {
  const records = acknowledgeAlert([], alert);
  const changed = { ...alert, detail: "135% pacing" };
  assert.deepEqual(unacknowledgedAlerts([changed], records), [changed]);
});

test("does not reopen freshness alerts solely because another hour elapsed", () => {
  const stale = { id: "campaign-stale", severity: "warning", title: "Data is stale", detail: "Data through 2026-09-20 · 72 hours old", campaign: { dataAsOf: "2026-09-20" } };
  const records = acknowledgeAlert([], stale);
  assert.deepEqual(unacknowledgedAlerts([{ ...stale, detail: "Data through 2026-09-20 · 73 hours old" }], records), []);
  assert.equal(unacknowledgedAlerts([{ ...stale, detail: "Data through 2026-09-21 · 72 hours old", campaign: { dataAsOf: "2026-09-21" } }], records).length, 1);
});

test("persists records, migrates legacy IDs, and tolerates corrupt storage", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  writeAcknowledgedAlerts(storage, acknowledgeAlert([], alert, "2026-09-28T10:00:00Z"));
  assert.equal(readAcknowledgedAlerts(storage)[0].id, alert.id);
  values.set("northstar-acknowledged-alerts", JSON.stringify(["legacy-alert"]));
  assert.deepEqual(readAcknowledgedAlerts(storage), [{ id: "legacy-alert", signature: null, acknowledgedAt: null }]);
  assert.deepEqual(unacknowledgedAlerts([{ id: "legacy-alert", detail: "changed" }], readAcknowledgedAlerts(storage)), []);
  values.set("northstar-acknowledged-alerts", "bad-json");
  assert.deepEqual(readAcknowledgedAlerts(storage), []);
});

test("restores one acknowledged alert without clearing the remaining audit records", () => {
  const records = [acknowledgeAlert([], alert)[0], acknowledgeAlert([], { ...alert, id: "campaign-kpi" })[0]];
  assert.deepEqual(removeAcknowledgment(records, alert.id).map(record => record.id), ["campaign-kpi"]);
  assert.equal(removeAcknowledgment(records, "missing").length, 2);
});
