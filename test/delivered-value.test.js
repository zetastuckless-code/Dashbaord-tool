import test from "node:test";
import assert from "node:assert/strict";
import { applyDeliveredValue, lineMargin, marginOf, valueAt } from "../lib/delivered-value.js";
import { resolveSpend } from "../lib/source-comparison.js";
import { selectedSnapshots } from "../lib/portfolio-trend.js";
import { dailyActualSeries } from "../lib/daily-pacing.js";

const record = { client: "Carter", name: "Carter — Display", source: "Zeta", spend: 5000, impressions: 2_000_000, videoCompletions: null, performanceSnapshots: [{ date: "2026-10-01", source: "Zeta", spend: 1000, impressions: 400_000 }, { date: "2026-10-25", source: "Zeta", spend: 5000, impressions: 2_000_000 }] };
const billing = { Carter: { rows: [{ lines: ["Carter — Display"], rateType: "cpm", rate: 4 }] } };

test("a CPM line paces on delivered value, keeps its media spend, and shows the margin", () => {
  const [line] = applyDeliveredValue([record], { billing });
  assert.deepEqual(line.deliveredRate, { type: "cpm", rate: 4, from: "billing" });
  assert.equal(line.deliveredValue, 8000);
  assert.equal(resolveSpend(line, "billing"), 8000);
  assert.equal(resolveSpend(line, "media"), 5000);
  assert.deepEqual(lineMargin(line), { value: 8000, media: 5000, margin: 3000 });
  assert.equal(marginOf([line]).percent, 37.5);
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
