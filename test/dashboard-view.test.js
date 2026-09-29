import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DASHBOARD_VIEW, normalizeDashboardView, readDashboardView, writeDashboardView } from "../lib/dashboard-view.js";

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("normalizes saved dashboard controls and rejects unsupported choices", () => {
  assert.deepEqual(normalizeDashboardView({ client: " Apex ", period: "7", status: "live", owner: " Jordan ", channel: "Video", attention: "attention", sort: "spend", query: " launch ", spendSource: "first", kpiView: "CTR" }), {
    client: "Apex", period: "7", status: "live", owner: "Jordan", channel: "Video", attention: "attention", sort: "spend", query: "launch", spendSource: "first", kpiView: "CTR"
  });
  assert.deepEqual(normalizeDashboardView({ period: "year", status: "paused", attention: "critical", sort: "random", spendSource: "unknown" }), DEFAULT_DASHBOARD_VIEW);
});

test("reads and writes dashboard views safely", () => {
  const target = storage();
  const saved = writeDashboardView(target, { ...DEFAULT_DASHBOARD_VIEW, query: "Apex", sort: "name" });
  assert.deepEqual(readDashboardView(target), saved);
  assert.deepEqual(readDashboardView(storage({ "northstar-dashboard-view": "not json" })), DEFAULT_DASHBOARD_VIEW);
});
