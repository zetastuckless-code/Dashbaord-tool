import test from "node:test";
import assert from "node:assert/strict";
import { calculateDiscrepancy, discrepancyStatus, normalizeBillingSource, resolveSpend } from "../lib/source-comparison.js";

const campaign = { spend: 100, firstPartySpend: 110, thirdPartySpend: 95, billingSource: "CM360" };

test("normalizes supported billing-source aliases", () => {
  assert.equal(normalizeBillingSource("DSP"), "first");
  assert.equal(normalizeBillingSource("1st party"), "first");
  assert.equal(normalizeBillingSource("DCM"), "third");
  assert.equal(normalizeBillingSource("Flashtalking"), "third");
  assert.equal(normalizeBillingSource("Other"), "reported");
});

test("resolves billing, first-party, and third-party spend views", () => {
  assert.equal(resolveSpend(campaign, "billing"), 95);
  assert.equal(resolveSpend(campaign, "first"), 110);
  assert.equal(resolveSpend(campaign, "third"), 95);
});

test("falls back to reported spend when comparison values are unavailable", () => {
  assert.equal(resolveSpend({ spend: 82, source: "CM360" }, "first"), 82);
});

test("calculates discrepancy against the authoritative billing value", () => {
  assert.equal(calculateDiscrepancy(campaign), 15 / 95 * 100);
  assert.deepEqual(discrepancyStatus(campaign, 10), { percentage: 15 / 95 * 100, absoluteDifference: 15, flagged: true, label: "15.8% source variance" });
});

test("does not flag campaigns without comparable source values", () => {
  assert.deepEqual(discrepancyStatus({ spend: 100 }, 10), { percentage: null, absoluteDifference: null, flagged: false, label: "Comparison unavailable" });
});
