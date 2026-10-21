import test from "node:test";
import assert from "node:assert/strict";
import { dailyActualSeries, dailyBaseline, dailyPacingView, daysBetween, requiredDailyFromToday } from "../lib/daily-pacing.js";
import { applyBulkEdits, applyLineItemEdits, applyRecordEdits, lineKey, parseLineKey, validateBulkEdits } from "../lib/bulk-edit.js";
import { findCampaignForIo } from "../lib/io-match.js";
import { groupCampaigns } from "../lib/campaign-groups.js";

test("spreads spend between reports evenly over the days between them and flags the estimate", () => {
  const series = dailyActualSeries([{ date: "2026-09-01", actual: 100 }, { date: "2026-09-02", actual: 160 }, { date: "2026-09-06", actual: 360 }]);
  assert.deepEqual(series.map(day => [day.date, day.actual, day.estimated]), [
    ["2026-09-02", 60, false], ["2026-09-03", 50, true], ["2026-09-04", 50, true], ["2026-09-05", 50, true], ["2026-09-06", 50, true]
  ]);
  assert.deepEqual(dailyActualSeries([{ date: "2026-09-01", actual: 5 }]), []);
});

test("never reports negative daily spend after a corrected cumulative total", () => {
  const [day] = dailyActualSeries([{ date: "2026-09-01", actual: 500 }, { date: "2026-09-02", actual: 450 }]);
  assert.equal(day.actual, 0);
});

test("the baseline is budget over flight days, summed across the units live on each date", () => {
  const units = [
    { budget: 3000, startDate: "2026-09-01", endDate: "2026-09-30" },
    { budget: 1000, startDate: "2026-09-10", endDate: "2026-09-19" },
    { budget: null, startDate: "2026-09-01", endDate: "2026-09-30" },
    { budget: 500, startDate: null, endDate: null }
  ];
  const { series, usableUnits, skippedUnits } = dailyBaseline(units, ["2026-09-05", "2026-09-12", "2026-10-02"]);
  assert.deepEqual(series.map(day => Math.round(day.baseline)), [100, 200, 0]);
  assert.deepEqual([usableUnits, skippedUnits], [2, 2]);
});

test("required daily spend from today uses the remaining budget over the remaining days", () => {
  const units = [{ budget: 3000, spend: 1000, startDate: "2026-09-01", endDate: "2026-09-30" }, { budget: 500, spend: 0, startDate: "2026-08-01", endDate: "2026-08-31" }];
  // 2,000 left over Sep 16-30 (15 days); the August unit has ended
  assert.ok(Math.abs(requiredDailyFromToday(units, "2026-09-16") - 2000 / 15) < 1e-9);
  assert.equal(requiredDailyFromToday([{ budget: null }], "2026-09-16"), null);
  assert.equal(daysBetween("2026-09-01", "2026-09-30"), 29);
});

test("summarizes recent daily spend against the baseline", () => {
  const points = [{ date: "2026-09-01", actual: 0 }, { date: "2026-09-08", actual: 700 }];
  const view = dailyPacingView(points, [{ budget: 3000, spend: 700, startDate: "2026-09-01", endDate: "2026-09-30" }], { today: "2026-09-08" });
  assert.equal(view.days.length, 7);
  assert.equal(view.days[0].actual, 100);
  assert.equal(Math.round(view.recentBaseline), 100);
  assert.equal(Math.round(view.recentPercent), 100);
  assert.ok(Math.abs(view.requiredFromToday - 2300 / 23) < 1e-9);
});

const records = [
  { client: "A", name: "C — One", owner: "x", lineItems: [{ id: "1", budget: 10, startDate: "2026-09-01", endDate: "2026-09-30" }, { id: "2", budget: 20 }], lineItemFlights: [{ id: "2", budget: 20 }, { id: "3", budget: 30 }] },
  { client: "A", name: "C — Two", owner: "y" }
];

test("line keys round-trip, including IDs that contain separators", () => {
  assert.deepEqual(parseLineKey(lineKey(3, "line-item", "P1|x")), { index: 3, kind: "item", id: "P1|x" });
  assert.deepEqual(parseLineKey(lineKey(0, "record")), { index: 0, kind: "record", id: "" });
});

test("bulk edits change only the filled fields on lines and on line items", () => {
  const edited = applyRecordEdits(records[0], { owner: "Sam", kpi: "vcr", target: "70%", billingSource: "third", reportCadence: "weekly", channel: "" });
  assert.deepEqual([edited.owner, edited.kpi, edited.target, edited.billingSource, edited.reportCadence, edited.channel], ["Sam", "VCR", "Target 70%", "third", "weekly", undefined]);
  const items = applyLineItemEdits(records[0], ["2"], { endDate: "2026-12-31", budget: "$99" });
  assert.deepEqual([items.lineItems[1].budget, items.lineItems[1].endDate, items.lineItems[0].budget, items.lineItemFlights[0].budget, items.lineItemFlights[1].budget], [99, "2026-12-31", 10, 99, 30]);
});

test("applies one edit to a mixed selection and counts what changed", () => {
  const keys = [lineKey(0, "record"), lineKey(1, "record"), lineKey(0, "item", "1")];
  const result = applyBulkEdits(records, keys, { owner: "Sam", startDate: "2026-10-01" });
  assert.deepEqual([result.records, result.items], [2, 1]);
  assert.deepEqual(result.campaigns.map(record => record.owner), ["Sam", "Sam"]);
  assert.equal(result.campaigns[0].lineItems[0].startDate, "2026-10-01");
  assert.equal(records[0].owner, "x");
});

test("validates bulk edits", () => {
  assert.deepEqual(validateBulkEdits({}), []);
  assert.equal(validateBulkEdits({ startDate: "2026-10-02", endDate: "2026-10-01" }).length, 1);
  assert.equal(validateBulkEdits({ budget: "-1" }).length, 1);
  assert.equal(validateBulkEdits({ startDate: "soon", billingSource: "x" }).length, 2);
});

test("matches an uploaded IO to the campaign it revises by order number, then by name", () => {
  const groups = groupCampaigns([
    { client: "M", name: "Display Q3", ioOrder: "4240-Rev1", spend: 1 },
    { client: "N", name: "Nature's Sunshine 2026", spend: 1 }
  ]);
  const byOrder = findCampaignForIo(groups, {}, { orderNumber: "4240", revision: "Rev2", campaign: "Unrelated name" });
  assert.deepEqual([byOrder.key, byOrder.reason, byOrder.isRevision], [groups[0].key, "order", true]);
  assert.equal(findCampaignForIo(groups, {}, { orderNumber: "4240", revision: "Rev1" }).isRevision, false);
  const viaTotals = findCampaignForIo(groups, { [groups[1].key]: { order: "O-ABC-R4" } }, { orderNumber: "O-ABC", revision: "R5" });
  assert.deepEqual([viaTotals.key, viaTotals.isRevision], [groups[1].key, true]);
  assert.equal(findCampaignForIo(groups, {}, { orderNumber: "999", campaign: "Nature's Sunshine 2026" }).reason, "name");
  assert.equal(findCampaignForIo(groups, {}, { orderNumber: "999", campaign: "Something else entirely" }), null);
});
