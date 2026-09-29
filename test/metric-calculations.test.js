import test from "node:test";
import assert from "node:assert/strict";
import { calculateAvailableKpis, calculateKpi } from "../lib/metric-calculations.js";

test("calculates and formats supported KPI formulas", () => {
  assert.deepEqual(calculateKpi("CTR", { clicks: 125, impressions: 10000 }), { metric: "CTR", value: 1.25, formatted: "1.25%" });
  assert.deepEqual(calculateKpi("VCR", { videoCompletions: 750, videoStarts: 1000 }), { metric: "VCR", value: 75, formatted: "75%" });
  assert.deepEqual(calculateKpi("CPA", { spend: 1000, conversions: 25 }), { metric: "CPA", value: 40, formatted: "$40.00" });
  assert.deepEqual(calculateKpi("ROAS", { revenue: 4200, spend: 1000 }), { metric: "ROAS", value: 4.2, formatted: "4.2x" });
  assert.equal(calculateKpi("ROAS", { revenue: 4000, spend: 100 }).formatted, "40x");
});

test("returns null when a required denominator is unavailable", () => {
  assert.equal(calculateKpi("CTR", { clicks: 2, impressions: 0 }), null);
  assert.equal(calculateKpi("CPA", { spend: 10, conversions: null }), null);
  assert.equal(calculateKpi("UNKNOWN", { spend: 10 }), null);
});

test("returns every KPI supported by the available campaign components", () => {
  const metrics = { spend: 1000, impressions: 10000, clicks: 100, conversions: 20, revenue: 3000, videoStarts: null, videoCompletions: null };
  assert.deepEqual(calculateAvailableKpis(metrics).map(result => result.formatted), ["1%", "$50.00", "3x"]);
});
