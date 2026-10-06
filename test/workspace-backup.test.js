import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceBackup, restoreWorkspaceBackup, validateWorkspaceBackup } from "../lib/workspace-backup.js";

test("round-trips the complete browser workspace", () => {
  const state = { campaigns: [{ name: "Launch" }], importHistory: [{ status: "Imported" }], alertRules: { underPacing: 85 }, visibleColumns: ["spend"], acknowledgedAlerts: [{ id: "alert-1" }], dashboardView: { client: "Apex" }, savedViews: [{ name: "Apex", view: { client: "Apex" } }] };
  const result = validateWorkspaceBackup(createWorkspaceBackup(state, "2026-09-28T12:00:00Z"));
  assert.equal(result.valid, true);
  assert.deepEqual(result.backup.campaigns, state.campaigns);
  assert.deepEqual(result.backup.savedViews, state.savedViews);
  assert.equal(result.backup.exportedAt, "2026-09-28T12:00:00Z");
});

test("rejects malformed, unsupported, and incomplete backups", () => {
  assert.equal(validateWorkspaceBackup("not json").valid, false);
  const result = validateWorkspaceBackup(JSON.stringify({ schemaVersion: 99, campaigns: [] }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 6);
});

test("restores every workspace collection to browser storage", () => {
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value) };
  const backup = validateWorkspaceBackup(createWorkspaceBackup({ campaigns: [], importHistory: [], alertRules: {}, visibleColumns: [], acknowledgedAlerts: [], dashboardView: {} })).backup;
  restoreWorkspaceBackup(storage, backup);
  assert.deepEqual([...values.keys()].sort(), ["northstar-acknowledged-alerts", "northstar-alert-rules", "northstar-campaign-columns", "northstar-campaigns", "northstar-dashboard-view", "northstar-import-history", "northstar-saved-views"]);
});

test("carries per-campaign metric choices and still accepts older backups without them", () => {
  const prefs = { defaults: ["spend"], byCampaign: { "a::b": ["spend", "vcr"] } };
  const base = { campaigns: [], importHistory: [], alertRules: {}, visibleColumns: [], acknowledgedAlerts: [], dashboardView: {} };
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value) };
  const withPrefs = validateWorkspaceBackup(createWorkspaceBackup({ ...base, metricPrefs: prefs })).backup;
  restoreWorkspaceBackup(storage, withPrefs);
  assert.deepEqual(JSON.parse(values.get("northstar-campaign-metrics")), prefs);
  const legacy = validateWorkspaceBackup(JSON.stringify({ schemaVersion: 1, ...base }));
  assert.equal(legacy.valid, true);
  assert.equal(validateWorkspaceBackup(JSON.stringify({ schemaVersion: 1, ...base, metricPrefs: [] })).valid, false);
});
