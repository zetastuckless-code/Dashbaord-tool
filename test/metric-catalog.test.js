import test from "node:test";
import assert from "node:assert/strict";
import { computeMetrics, DEFAULT_METRICS, formatMetric, MAX_ROW_METRICS, METRIC_CATALOG, normalizeMetricSelection } from "../lib/metric-catalog.js";

const asOf = new Date("2026-09-16T12:00:00Z");
const display = { client: "A", name: "A — Display", spend: 1000, budget: 4000, startDate: "2026-09-01", endDate: "2026-09-30", impressions: 400_000, clicks: 800, conversions: 20, revenue: 3000, kpi: "CTR", value: "0.2%", target: "Target 0.2%" };
const video = { client: "A", name: "A — Video", spend: 500, budget: 2000, startDate: "2026-09-01", endDate: "2026-09-30", impressions: 100_000, clicks: 50, videoStarts: 1000, videoCompletions: 700, kpi: "VCR", value: "70%", target: "Target 70%" };

test("computes catalog metrics from a single record", () => {
  const metrics = computeMetrics(display, { asOf });
  assert.equal(metrics.spend, 1000);
  assert.equal(metrics.ctr, 0.2);
  assert.equal(metrics.cpm, 2.5);
  assert.equal(metrics.cpc, 1.25);
  assert.equal(metrics.cpa, 50);
  assert.equal(metrics.roas, 3);
  assert.equal(metrics.remaining, 3000);
  assert.equal(metrics.kpi, "0.2% CTR");
  assert.equal(metrics.vcr, null);
});

test("rolls several lines up from components rather than averaging ratios", () => {
  const metrics = computeMetrics([display, video], { asOf });
  assert.equal(metrics.spend, 1500);
  assert.equal(metrics.budget, 6000);
  assert.equal(metrics.impressions, 500_000);
  assert.ok(Math.abs(metrics.ctr - 850 / 500_000 * 100) < 1e-9);
  assert.equal(metrics.vcr, 70);
  assert.equal(metrics.kpi, "Mixed KPIs");
});

test("leaves unavailable metrics null and never divides by zero", () => {
  const metrics = computeMetrics({ client: "A", name: "B", spend: 10, impressions: 0, clicks: 0 }, { asOf });
  assert.equal(metrics.ctr, null);
  assert.equal(metrics.cpm, null);
  assert.equal(metrics.budget, null);
  assert.equal(metrics.remaining, null);
});

test("period views report windowed deltas and blank values without history", () => {
  assert.equal(computeMetrics(display, { period: "7", asOf }).spend, null);
  const withHistory = { ...display, performanceSnapshots: [
    { date: "2026-09-01", source: "DSP", spend: 100, impressions: 10_000, clicks: 10 },
    { date: "2026-09-09", source: "DSP", spend: 400, impressions: 150_000, clicks: 100 },
    { date: "2026-09-16", source: "DSP", spend: 1000, impressions: 400_000, clicks: 800 }
  ], dataAsOf: "2026-09-16", source: "DSP" };
  const week = computeMetrics(withHistory, { period: "7", asOf });
  assert.equal(week.spend, 600);
  assert.equal(week.impressions, 250_000);
});

test("formats each metric kind and blanks missing values", () => {
  assert.equal(formatMetric("spend", 1_240_000), "$1.24M");
  assert.equal(formatMetric("spend", 184_200), "$184.2K");
  assert.equal(formatMetric("spend", 950), "$950");
  assert.equal(formatMetric("cpm", 22), "$22.00");
  assert.equal(formatMetric("impressions", 59540), "59,540");
  assert.equal(formatMetric("ctr", 0.123), "0.12%");
  assert.equal(formatMetric("pacing", 96.8), "97%");
  assert.equal(formatMetric("roas", 4.2), "4.20×");
  assert.equal(formatMetric("spend", null), "—");
});

test("normalizes a metric selection to known, unique, bounded keys", () => {
  assert.deepEqual(normalizeMetricSelection(["spend", "spend", "bogus", "ctr"]), ["spend", "ctr"]);
  assert.deepEqual(normalizeMetricSelection([]), [...DEFAULT_METRICS]);
  assert.deepEqual(normalizeMetricSelection("x"), [...DEFAULT_METRICS]);
  assert.equal(normalizeMetricSelection(METRIC_CATALOG.map(metric => metric.key)).length, MAX_ROW_METRICS);
});
