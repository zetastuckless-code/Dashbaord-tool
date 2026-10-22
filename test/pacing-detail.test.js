import test from "node:test";
import assert from "node:assert/strict";
import { buildPacingDetail, dailySpendAcrossCampaigns, resolvePacingRange } from "../lib/pacing-detail.js";
import { groupKey } from "../lib/campaign-groups.js";
import { setCampaignTotals } from "../lib/campaign-totals.js";

const snap = (date, spend, source = "Zeta Global") => ({ date, source, spend });
const record = (name, snapshots, overrides = {}) => ({ client: "Acme", name, channel: "YouTube", source: "Zeta Global", billingSource: "Zeta Global", firstPartySpend: snapshots.at(-1)?.spend ?? 0, spend: snapshots.at(-1)?.spend ?? 0, budget: 10_000, startDate: "2026-01-01", endDate: "2026-01-31", performanceSnapshots: snapshots, ...overrides });

test("spreads spend between reports over the days between them", () => {
  const { days, withHistory } = dailySpendAcrossCampaigns([record("A — YouTube", [snap("2025-12-31", 0), snap("2026-01-10", 1000)])]);
  assert.equal(withHistory, 1);
  assert.equal(days.length, 10);
  assert.deepEqual([days[0].date, days[0].actual, days[0].estimated], ["2026-01-01", 100, true]);
});

test("a campaign that first appears in a late report adds no spike to earlier days", () => {
  const steady = record("A — YouTube", [snap("2025-12-31", 0), snap("2026-01-10", 1000)]);
  const late = record("B — Display", [snap("2026-01-10", 50_000)]);
  const { days, withHistory, withoutHistory } = dailySpendAcrossCampaigns([steady, late]);
  assert.equal(withHistory, 1);
  assert.equal(withoutHistory, 1);
  assert.ok(days.every(day => day.actual <= 100 + 1e-9));
});

test("days no report covers count as zero", () => {
  const { days } = dailySpendAcrossCampaigns([record("A", [snap("2025-12-31", 0), snap("2026-01-02", 200), snap("2026-01-10", 200), snap("2026-01-11", 300)])]);
  assert.deepEqual(days.map(day => day.actual), [100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 100]);
});

test("compares daily spend with the flat daily amount a 100% pace needs, and totals the campaign", () => {
  const rows = [
    record("Spring — YouTube", [snap("2025-12-31", 0), snap("2026-01-10", 1000)], { spend: 1000, firstPartySpend: 1000 }),
    record("Spring — YouTube (Video Views)", [snap("2025-12-31", 0), snap("2026-01-10", 500)], { spend: 500, firstPartySpend: 500, name: "Spring — YouTube (Video Views)" })
  ];
  const totals = setCampaignTotals({}, groupKey(rows[0]), { orderNumber: "O-1", budget: 3100, startDate: "2026-01-01", endDate: "2026-01-31", lineItems: [] }, "io.pdf");
  const detail = buildPacingDetail({ campaigns: rows, totals, spendView: "billing", asOf: new Date("2026-01-10T12:00:00Z") });
  assert.equal(detail.rows.length, 1);
  assert.equal(detail.rows[0].name, "Spring");
  assert.equal(detail.rows[0].lines, 2);
  assert.equal(detail.budget, 3100);
  assert.equal(detail.spend, 1500);
  assert.equal(Math.round(detail.expected), 1000);
  assert.equal(Math.round(detail.pacing), 150);
  assert.equal(detail.days.length, 10);
  assert.ok(detail.days.every(day => Math.abs(day.baseline - 100) < 1e-9));
  assert.ok(detail.days.every(day => Math.abs(day.actual - 150) < 1e-9));
  assert.equal(Math.round(detail.period.percent), 150);
  assert.equal(detail.rows[0].daysLeft, 22);
  assert.equal(Math.round(detail.requiredDaily), 73);
});

test("falls back to reported pacing when a campaign has no flight dates", () => {
  const detail = buildPacingDetail({ campaigns: [record("A", [], { startDate: null, endDate: null, pacing: 90, spend: 900, performanceSnapshots: [] })], asOf: new Date("2026-01-10T12:00:00Z") });
  assert.equal(detail.rows[0].pacing, 90);
  assert.equal(detail.days.length, 0);
  assert.equal(detail.skippedUnits, 1);
});

const today = "2026-10-22";

test("resolves last-N-day presets to end today", () => {
  assert.deepEqual([resolvePacingRange("7", { today }).start, resolvePacingRange("7", { today }).end], ["2026-10-16", "2026-10-22"]);
  assert.equal(resolvePacingRange("30", { today }).start, "2026-09-23");
  assert.equal(resolvePacingRange("90", { today }).start, "2026-07-25");
});

test("resolves calendar months, quarters and year to date", () => {
  const span = preset => { const { start, end } = resolvePacingRange(preset, { today }); return [start, end]; };
  assert.deepEqual(span("this-month"), ["2026-10-01", "2026-10-31"]);
  assert.deepEqual(span("last-month"), ["2026-09-01", "2026-09-30"]);
  assert.deepEqual(span("this-quarter"), ["2026-10-01", "2026-12-31"]);
  assert.deepEqual(span("last-quarter"), ["2026-07-01", "2026-09-30"]);
  assert.deepEqual(span("ytd"), ["2026-01-01", "2026-10-22"]);
});

test("rolls back across a year boundary", () => {
  const span = preset => { const { start, end } = resolvePacingRange(preset, { today: "2026-01-15" }); return [start, end]; };
  assert.deepEqual(span("last-month"), ["2025-12-01", "2025-12-31"]);
  assert.deepEqual(span("last-quarter"), ["2025-10-01", "2025-12-31"]);
});

test("all time spans the dated reports, and a custom range is checked", () => {
  const all = resolvePacingRange("all", { today, dataStart: "2026-01-01", dataEnd: "2026-10-19" });
  assert.deepEqual([all.start, all.end], ["2026-01-01", "2026-10-22"]);
  const good = resolvePacingRange("custom", { today, custom: { start: "2026-03-01", end: "2026-03-31" } });
  assert.deepEqual([good.start, good.end, good.error], ["2026-03-01", "2026-03-31", ""]);
  for (const custom of [{}, { start: "2026-03-31", end: "2026-03-01" }, { start: "2024-01-01", end: "2026-03-01" }, { start: "2026-02-30", end: "2026-03-01" }]) {
    const bad = resolvePacingRange("custom", { today, custom });
    assert.ok(bad.error);
    assert.deepEqual([bad.preset, bad.start, bad.end], ["30", "2026-09-23", "2026-10-22"]);
  }
});

test("a period shows every day in range: baseline throughout, spend only where reports cover", () => {
  const rows = [record("A — YouTube", [snap("2025-12-31", 0), snap("2026-01-10", 1000)], { spend: 1000, firstPartySpend: 1000 })];
  const detail = buildPacingDetail({ campaigns: rows, asOf: new Date("2026-01-20T12:00:00Z"), range: { preset: "14" } });
  assert.equal(detail.days.length, 14);
  assert.deepEqual([detail.days[0].date, detail.days.at(-1).date], ["2026-01-07", "2026-01-20"]);
  assert.deepEqual(detail.days.map(day => day.actual === null), [false, false, false, false, true, true, true, true, true, true, true, true, true, true]);
  assert.ok(detail.days.every(day => Math.abs(day.baseline - 10_000 / 31) < 1e-9));
  assert.equal(detail.period.daysWithData, 4);
  assert.equal(detail.period.actualTotal, 400);
  assert.equal(Math.round(detail.period.percent), Math.round(400 / (4 * 10_000 / 31) * 100));
});

test("a period with no reports has no spend figures but still reports its days", () => {
  const rows = [record("A", [snap("2025-12-31", 0), snap("2026-01-10", 1000)])];
  const detail = buildPacingDetail({ campaigns: rows, asOf: new Date("2026-06-01T12:00:00Z"), range: { preset: "7" } });
  assert.equal(detail.days.length, 7);
  assert.equal(detail.period.daysWithData, 0);
  assert.equal(detail.period.percent, null);
  assert.equal(detail.period.avgActual, null);
});
