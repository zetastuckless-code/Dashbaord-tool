import test from "node:test";
import assert from "node:assert/strict";
import { aggregateKpiView, resolveKpiView } from "../lib/kpi-view.js";

const campaign = { kpi: "CPA", value: "$40.00", target: "Target $35", spend: 100, firstPartySpend: 120, billingSource: "first", impressions: 1000, clicks: 20, conversions: 3 };

test("returns the configured primary KPI without replacing its target", () => {
  assert.deepEqual(resolveKpiView(campaign), { metric: "CPA", formatted: "$40.00", target: "Target $35" });
});

test("calculates selected KPIs with authoritative billing spend", () => {
  assert.deepEqual(resolveKpiView(campaign, "CTR"), { metric: "CTR", formatted: "2%", target: "Calculated from imported components" });
  assert.deepEqual(resolveKpiView(campaign, "CPA"), { metric: "CPA", formatted: "$40.00", target: "Target $35" });
});

test("returns null when selected KPI components are unavailable", () => {
  assert.equal(resolveKpiView(campaign, "VCR"), null);
});

test("aggregates a selected KPI across eligible campaigns", () => {
  const result = aggregateKpiView([campaign, { ...campaign, impressions: 3000, clicks: 30 }], "CTR");
  assert.deepEqual(result, { metric: "CTR", formatted: "1.25%", coverage: 2, total: 2 });
});

test("summarizes mixed primary KPIs without combining incompatible values", () => {
  assert.deepEqual(aggregateKpiView([campaign, { ...campaign, kpi: "CTR" }]), { metric: "Primary KPI mix", formatted: "2 KPIs", coverage: 2, total: 2 });
  assert.deepEqual(aggregateKpiView([], "ROAS"), { metric: "ROAS", formatted: "—", coverage: 0, total: 0 });
});
