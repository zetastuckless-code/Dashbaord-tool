import test from "node:test";
import assert from "node:assert/strict";
import { buildPacingDetail, dailySpendAcrossCampaigns } from "../lib/pacing-detail.js";
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
  assert.equal(Math.round(detail.recentPercent), 150);
  assert.equal(detail.rows[0].daysLeft, 22);
  assert.equal(Math.round(detail.requiredDaily), 73);
});

test("falls back to reported pacing when a campaign has no flight dates", () => {
  const detail = buildPacingDetail({ campaigns: [record("A", [], { startDate: null, endDate: null, pacing: 90, spend: 900, performanceSnapshots: [] })], asOf: new Date("2026-01-10T12:00:00Z") });
  assert.equal(detail.rows[0].pacing, 90);
  assert.equal(detail.days.length, 0);
  assert.equal(detail.skippedUnits, 1);
});
