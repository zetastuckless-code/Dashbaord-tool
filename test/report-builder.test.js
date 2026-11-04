import test from "node:test";
import assert from "node:assert/strict";
import { bestDays, bucketOf, buildReport, lineDays, pivotReport, resolveReportRange } from "../lib/report-builder.js";

const days = (from, to, metrics) => {
  const result = {};
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += 86_400_000) result[new Date(time).toISOString().slice(0, 10)] = { ...metrics };
  return result;
};
const line = (name, extra = {}) => ({ client: "McMaster-Carr", name: `McMaster Q4 — ${name}`, startDate: "2026-10-01", endDate: "2026-12-31", ...extra });

test("date ranges: past N days end yesterday, months and quarters follow the calendar, flight uses the lines' dates", () => {
  const today = "2026-11-04";
  assert.deepEqual(resolveReportRange("7", { today }), { start: "2026-10-28", end: "2026-11-03", error: "" });
  assert.deepEqual(resolveReportRange("last-month", { today }), { start: "2026-10-01", end: "2026-10-31", error: "" });
  assert.deepEqual(resolveReportRange("this-quarter", { today }), { start: "2026-10-01", end: "2026-11-04", error: "" });
  assert.deepEqual(resolveReportRange("last-quarter", { today }), { start: "2026-07-01", end: "2026-09-30", error: "" });
  assert.deepEqual(resolveReportRange("flight", { today, flight: { start: "2026-10-01", end: "2026-12-31" } }), { start: "2026-10-01", end: "2026-11-04", error: "" });
  assert.equal(resolveReportRange("custom", { today, custom: { start: "2026-10-05" } }).error, "Choose a start and end date.");
  assert.equal(bucketOf("2026-11-04", "week"), "2026-11-02");
  assert.equal(bucketOf("2026-11-04", "quarter"), "2026-Q4");
});

test("a line's days come from DSP, then DCM priced at its rate, then report totals spread between report dates", () => {
  const record = line("NY", {
    deliveredRate: { type: "cpm", rate: 5 },
    thirdPartyDelivery: { DSP: { "2026-10-02": { impressions: 1000, clicks: 2, spend: 3 } }, CM360: { "2026-10-02": { impressions: 999 }, "2026-10-03": { impressions: 2000, clicks: 4 } } },
    performanceSnapshots: [{ date: "2026-10-05", source: "Zeta", impressions: 9000, clicks: 10, spend: 40 }]
  });
  const billable = lineDays(record);
  assert.equal(billable["2026-10-02"].impressions, 1000);
  assert.equal(billable["2026-10-02"].spend, 5);
  assert.equal(billable["2026-10-03"].spend, 10);
  // Oct 1 and Oct 4–5 come from the report: 9,000 spread over the five days since the flight began.
  assert.equal(billable["2026-10-04"].impressions, 1800);
  assert.equal(billable["2026-10-04"].estimated, true);
  assert.equal(lineDays(record, { spendView: "media" })["2026-10-02"].spend, 3);
});

test("a report rolls lines up by group and bucket, with rates and totals that add up", () => {
  const records = [line("NY", { thirdPartyDelivery: { DSP: days("2026-10-01", "2026-10-14", { impressions: 1000, clicks: 2, spend: 5, conversions: 1 }) } }), line("Chicago", { thirdPartyDelivery: { DSP: days("2026-10-01", "2026-10-14", { impressions: 3000, clicks: 3, spend: 15 }) } })];
  const weekly = buildReport(records, { start: "2026-10-01", end: "2026-10-14", grain: "week", groupBy: "line", spendView: "media" });
  assert.deepEqual(weekly.buckets, ["2026-09-28", "2026-10-05", "2026-10-12"]);
  assert.deepEqual(weekly.groups.map(group => [group.group, group.spend]), [["McMaster Q4 · Chicago", 210], ["McMaster Q4 · NY", 70]]);
  assert.equal(weekly.total.impressions, 56_000);
  assert.equal(weekly.total.days, 14);
  assert.equal(Math.round(weekly.groups[1].ctr * 1000) / 1000, 0.2);
  assert.equal(weekly.groups[1].cpa, 5);
  const pivot = pivotReport(weekly, "spend");
  assert.deepEqual(pivot.rows[1].values, [20, 35, 15]);
  assert.deepEqual(pivot.totals, [80, 140, 60]);
  assert.equal(pivot.grand, 280);
});

test("best days rank single days and weekdays by a metric, ignoring days too small to judge", () => {
  const delivery = days("2026-10-05", "2026-10-18", { impressions: 10_000, clicks: 10, spend: 50 });
  delivery["2026-10-07"] = { impressions: 10_000, clicks: 40, spend: 50 };
  delivery["2026-10-14"] = { impressions: 10_000, clicks: 30, spend: 50 };
  delivery["2026-10-11"] = { impressions: 100, clicks: 50, spend: 1 };
  const result = bestDays([line("NY", { thirdPartyDelivery: { DSP: delivery } })], { start: "2026-10-05", end: "2026-10-18", metric: "ctr", spendView: "media" });
  assert.deepEqual(result.topDays.map(day => day.date).slice(0, 2), ["2026-10-07", "2026-10-14"]);
  assert.equal(result.best, "Wednesday");
  assert.ok(!result.topDays.some(day => day.date === "2026-10-11"));
});

test("pacing compares spend with each budget spread evenly over its flight, within the chosen dates", async () => {
  const { pacingSeries } = await import("../lib/report-builder.js");
  const record = line("NY", { thirdPartyDelivery: { DSP: days("2026-10-01", "2026-10-04", { impressions: 1000, spend: 120 }) } });
  const units = [{ budget: 3100, startDate: "2026-10-01", endDate: "2026-10-31" }];
  const series = pacingSeries([record], units, { start: "2026-10-01", end: "2026-10-06", spendView: "media" });
  assert.deepEqual(series.map(day => day.planned), [100, 100, 100, 100, 100, 100]);
  assert.deepEqual(series.slice(0, 4).map(day => day.cumulativeActual), [120, 240, 360, 480]);
  // After the newest day of data there's no actual yet, but the plan keeps counting.
  assert.equal(series[4].actual, null);
  assert.equal(series[5].cumulativePlanned, 600);
});
