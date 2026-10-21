import test from "node:test";
import assert from "node:assert/strict";
import { buildClientRollup, pacingBand } from "../lib/client-rollup.js";

const asOf = new Date("2026-09-16T12:00:00Z");
const base = { startDate: "2026-09-01", endDate: "2026-09-30", impressions: 1000, clicks: 10, source: "DSP", billingSource: "DSP", kpi: "CTR", value: "1.0%", target: "Target 1%" };
const campaigns = [
  { ...base, client: "Apex", name: "A1", spend: 5000, budget: 10000, firstPartySpend: 5000, thirdPartySpend: 5500, short: "AP", className: "apex" },
  { ...base, client: "Apex", name: "A2", spend: 9000, budget: 10000, firstPartySpend: 9000, thirdPartySpend: null, short: "AP", className: "apex" },
  { ...base, client: "Apex", name: "Done", spend: 100, budget: 100, startDate: "2026-01-01", endDate: "2026-02-01", short: "AP", className: "apex" },
  { ...base, client: "Lumon", name: "L1", spend: 4800, budget: 10000, short: "LU", className: "lumon", dataAsOf: "2026-09-15" }
];

test("groups live campaigns by client and ignores completed flights", () => {
  const rollup = buildClientRollup(campaigns, { asOf });
  const apex = rollup.find(item => item.client === "Apex");
  assert.equal(apex.liveCount, 2);
  assert.equal(apex.spend, 14000);
  assert.equal(apex.budget, 20000);
  assert.equal(apex.campaigns.length, 2);
  assert.equal(rollup.find(item => item.client === "Lumon").latestDataAsOf, "2026-09-15");
});

test("honors the selected spend source", () => {
  const apex = buildClientRollup(campaigns, { asOf, spendView: "third" }).find(item => item.client === "Apex");
  assert.equal(apex.spend, 5500 + 9000);
});

test("calculates pacing from spend and expected spend, not an average of percentages", () => {
  const apex = buildClientRollup(campaigns, { asOf }).find(item => item.client === "Apex");
  // 16 of 30 days elapsed: expected 5333.33 per campaign; 14000 / 10666.67
  assert.ok(Math.abs(apex.pacing - 131.25) < 0.01);
  assert.equal(apex.pacingBand, "over");
});

test("counts open alerts per client and sorts the most critical first", () => {
  const alerts = [{ campaign: campaigns[3], severity: "critical" }, { campaign: campaigns[3], severity: "warning" }, { campaign: campaigns[0], severity: "info" }];
  const rollup = buildClientRollup(campaigns, { asOf, alerts });
  assert.deepEqual(rollup.map(item => item.client), ["Lumon", "Apex"]);
  assert.equal(rollup[0].alertCount, 2);
  assert.equal(rollup[0].criticalCount, 1);
});

test("reports unavailable period spend instead of zero", () => {
  const rollup = buildClientRollup(campaigns, { asOf, period: "7" });
  assert.equal(rollup[0].spendCoverage, 0);
  assert.equal(rollup[0].utilization, null);
});

test("classifies pacing bands with configurable limits", () => {
  assert.equal(pacingBand(null), "unknown");
  assert.equal(pacingBand(80), "under");
  assert.equal(pacingBand(100), "on-track");
  assert.equal(pacingBand(110, { overPacing: 120 }), "on-track");
});

test("falls back to a lone campaign's reported KPI when no components were imported", () => {
  const lone = { ...base, client: "Solo", name: "S1", spend: 1, budget: 2, impressions: null, clicks: null, short: "SO", className: "apex" };
  const [solo] = buildClientRollup([lone], { asOf });
  assert.equal(solo.kpi.formatted, "1.0%");
});
