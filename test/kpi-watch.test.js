import test from "node:test";
import assert from "node:assert/strict";
import { kpiWatch } from "../lib/kpi-watch.js";

const line = (name, kpi, target, metrics) => ({ name, kpi, target, spend: 100, impressions: 100000, ...metrics });

test("lines are sorted into off goal, near, on goal, and without a goal, worst first", () => {
  const watch = kpiWatch([
    line("CTR way off", "CTR", "Target 0.10%", { clicks: 10 }),
    line("CTR slightly off", "CTR", "0.10%", { clicks: 95 }),
    line("CTR beating", "CTR", "0.10%", { clicks: 150 }),
    line("CPA too high", "CPA", "$80", { spend: 1000, conversions: 10 }),
    line("No goal", "VCR", "", {}),
    line("No KPI data", "ROAS", "3x", { revenue: null, spend: 0 })
  ], { tolerance: 10 });
  assert.deepEqual(watch.off.map(item => item.record.name), ["CTR way off", "CPA too high"]);
  assert.equal(Math.round(watch.off[0].gap), 90);
  assert.equal(Math.round(watch.off[1].gap), 25);
  assert.deepEqual(watch.near.map(item => item.record.name), ["CTR slightly off"]);
  assert.deepEqual(watch.on.map(item => item.record.name), ["CTR beating"]);
  assert.deepEqual(watch.noGoal.map(item => item.record.name), ["No goal"]);
  assert.equal(watch.noData.length, 1);
  assert.equal(watch.watched, 4);
});
