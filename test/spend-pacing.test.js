import test from "node:test";
import assert from "node:assert/strict";
import { calculatePortfolioPacing, calculateSpendPacing, campaignFlightStatus, effectivePacing } from "../lib/spend-pacing.js";

test("calculates inclusive flight pacing and projected spend", () => {
  const result = calculateSpendPacing({ startDate: "2026-09-01", endDate: "2026-09-10", budget: 1000, spend: 400 }, new Date("2026-09-04T18:00:00Z"));
  assert.deepEqual(result, { totalDays: 10, elapsedDays: 4, timeElapsed: 0.4, expectedSpend: 400, pacing: 100, projectedSpend: 1000, variance: 0 });
});

test("clamps completed flights and uses actual spend as the final projection", () => {
  const result = calculateSpendPacing({ startDate: "2026-09-01", endDate: "2026-09-10", budget: 1000, spend: 900 }, new Date("2026-09-25T00:00:00Z"));
  assert.equal(result.elapsedDays, 10);
  assert.equal(result.expectedSpend, 1000);
  assert.equal(result.projectedSpend, 900);
});

test("returns no projection before flight start", () => {
  const result = calculateSpendPacing({ startDate: "2026-10-01", endDate: "2026-10-10", budget: 1000, spend: 0 }, new Date("2026-09-25T00:00:00Z"));
  assert.equal(result.elapsedDays, 0);
  assert.equal(result.pacing, null);
  assert.equal(result.projectedSpend, null);
});

test("rejects incomplete dates and invalid financial values", () => {
  assert.equal(calculateSpendPacing({ startDate: "2026-09-01", budget: 1000, spend: 1 }), null);
  assert.equal(calculateSpendPacing({ startDate: "2026-09-10", endDate: "2026-09-01", budget: 1000, spend: 1 }), null);
  assert.equal(calculateSpendPacing({ startDate: "2026-09-01", endDate: "2026-09-10", budget: 0, spend: 1 }), null);
});

test("uses calculated pacing when flight dates exist and reported pacing otherwise", () => {
  assert.equal(effectivePacing({ startDate: "2026-09-01", endDate: "2026-09-10", budget: 1000, spend: 600, pacing: 42 }, new Date("2026-09-04T00:00:00Z")), 150);
  assert.equal(effectivePacing({ budget: 1000, spend: 600, pacing: 42 }, new Date("2026-09-04T00:00:00Z")), 42);
});

test("does not treat missing reported pacing as zero", () => {
  assert.equal(effectivePacing({ pacing: null }), null);
  assert.equal(effectivePacing({ pacing: "" }), null);
});

test("does not fall back to reported pacing before a valid flight starts", () => {
  assert.equal(effectivePacing({ startDate: "2026-10-01", endDate: "2026-10-10", budget: 1000, spend: 0, pacing: 100 }, new Date("2026-09-25T00:00:00Z")), null);
});

test("aggregates portfolio pacing from spend and expected spend instead of averaging percentages", () => {
  const campaigns = [
    { startDate: "2026-09-01", endDate: "2026-09-10", budget: 1000, spend: 400 },
    { startDate: "2026-09-01", endDate: "2026-09-10", budget: 3000, spend: 600 }
  ];
  const result = calculatePortfolioPacing(campaigns, new Date("2026-09-04T00:00:00Z"));
  assert.equal(result.expectedSpend, 1600);
  assert.equal(result.spend, 1000);
  assert.equal(result.pacing, 62.5);
  assert.equal(result.campaignCount, 2);
});

test("portfolio pacing uses reported fallback and excludes future flights", () => {
  const campaigns = [
    { pacing: 80, spend: 400 },
    { startDate: "2026-10-01", endDate: "2026-10-10", budget: 1000, spend: 0, pacing: 1 }
  ];
  const result = calculatePortfolioPacing(campaigns, new Date("2026-09-25T00:00:00Z"));
  assert.equal(result.expectedSpend, 500);
  assert.equal(result.pacing, 80);
  assert.equal(result.campaignCount, 1);
});

test("classifies scheduled, live, completed, and undated campaigns", () => {
  const asOf = new Date("2026-09-25T18:00:00Z");
  assert.equal(campaignFlightStatus({ startDate: "2026-09-26", endDate: "2026-10-10" }, asOf), "scheduled");
  assert.equal(campaignFlightStatus({ startDate: "2026-09-25", endDate: "2026-10-10" }, asOf), "live");
  assert.equal(campaignFlightStatus({ startDate: "2026-09-01", endDate: "2026-09-24" }, asOf), "completed");
  assert.equal(campaignFlightStatus({}, asOf), "unknown");
});
