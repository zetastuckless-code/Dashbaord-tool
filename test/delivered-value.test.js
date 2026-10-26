import test from "node:test";
import assert from "node:assert/strict";
import { applyDeliveredValue, valueAt } from "../lib/delivered-value.js";
import { resolveSpend } from "../lib/source-comparison.js";
import { selectedSnapshots } from "../lib/portfolio-trend.js";
import { dailyActualSeries } from "../lib/daily-pacing.js";

const record = { client: "Carter", name: "Carter — Display", source: "Zeta", spend: 5000, impressions: 2_000_000, videoCompletions: null, performanceSnapshots: [{ date: "2026-10-01", source: "Zeta", spend: 1000, impressions: 400_000 }, { date: "2026-10-25", source: "Zeta", spend: 5000, impressions: 2_000_000 }] };
const billing = { Carter: { rows: [{ lines: ["Carter — Display"], rateType: "cpm", rate: 4 }] } };

test("a CPM line paces on delivered value and keeps its media spend", () => {
  const [line] = applyDeliveredValue([record], { billing });
  assert.deepEqual(line.deliveredRate, { type: "cpm", rate: 4, from: "billing" });
  assert.equal(line.deliveredValue, 8000);
  assert.equal(resolveSpend(line, "billing"), 8000);
  assert.equal(resolveSpend(line, "media"), 5000);
  assert.deepEqual(selectedSnapshots(line, "billing").map(snapshot => snapshot.spend), [1600, 8000]);
  // Unchanged records come back as the same array.
  const once = applyDeliveredValue([record], { billing });
  assert.equal(applyDeliveredValue(once, { billing }), once);
});

test("a line billed on spend, or with no rate, keeps its reported spend", () => {
  const [line] = applyDeliveredValue([record], { billing: { Carter: { rows: [{ lines: ["Carter — Display"], rateType: "spend", rate: 4 }] } } });
  assert.equal(line.deliveredValue, undefined);
  assert.equal(resolveSpend(line, "billing"), 5000);
  assert.equal(valueAt({ type: "cpv", rate: 0.05 }, { videoCompletions: 1000 }), 50);
});

test("a dip in the running total can't make the days add up to more than was spent", () => {
  const series = dailyActualSeries([{ date: "2026-09-27", actual: 0 }, { date: "2026-09-28", actual: 6000 }, { date: "2026-09-29", actual: 2000 }, { date: "2026-09-30", actual: 7000 }], { maxDays: Infinity });
  assert.equal(series.reduce((sum, day) => sum + day.actual, 0), 7000);
});

test("a line in no billing row, on an IO read before rates were saved, takes the client's one billing rate", () => {
  const ola = { client: "Rent A Center", name: "RAC_National_OLA_Q4_2026 — Standard Display Package", spend: 6112, impressions: 4_110_305 };
  const rows = [{ lines: ["RAC_National_Hyperlocal_Q2_2026 — Standard Display Package"], rateType: "cpm", rate: 3.25 }, { lines: ["RAC_National_OLA_Q2_2026 — Standard Display Package"], rateType: "cpm", rate: 3.25 }];
  const [line] = applyDeliveredValue([ola], { billing: { "Rent A Center": { rows } } });
  assert.deepEqual(line.deliveredRate, { type: "cpm", rate: 3.25, from: "client billing" });
  assert.equal(line.deliveredValue, 13358.49);
  // Two different rates on the client: no guess.
  const [mixed] = applyDeliveredValue([ola], { billing: { "Rent A Center": { rows: [...rows, { lines: [], rateType: "cpm", rate: 5 }] } } });
  assert.equal(mixed.deliveredValue, undefined);
});

test("the 3rd-party view counts delivered value too; 1st-party keeps the DSP's cost", () => {
  const [line] = applyDeliveredValue([{ ...record, thirdPartySpend: 5000, firstPartySpend: 4800 }], { billing });
  assert.equal(resolveSpend(line, "third"), 8000);
  assert.equal(resolveSpend(line, "first"), 4800);
});
