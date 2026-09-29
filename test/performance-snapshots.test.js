import test from "node:test";
import assert from "node:assert/strict";
import { campaignSnapshot, campaignSnapshotHistory, compareLatestSnapshots, exportPerformanceSnapshotsCsv, MAX_SNAPSHOTS_PER_SOURCE, mergePerformanceSnapshots, periodKpi, periodMetrics, periodSpend } from "../lib/performance-snapshots.js";
import { parseCsv } from "../lib/importer.js";

test("creates and chronologically appends dated campaign snapshots", () => {
  const first = { dataAsOf: "2026-09-20", source: "CM360", spend: 100, impressions: 1000 };
  const snapshots = mergePerformanceSnapshots({}, first);
  const merged = mergePerformanceSnapshots({ performanceSnapshots: snapshots }, { ...first, dataAsOf: "2026-09-25", spend: 175, impressions: 1600 });
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map(item => item.date), ["2026-09-20", "2026-09-25"]);
});

test("replaces a corrected snapshot for the same date and source", () => {
  const campaign = { performanceSnapshots: [campaignSnapshot({ dataAsOf: "2026-09-25", source: "CM360", spend: 100 })] };
  const merged = mergePerformanceSnapshots(campaign, { dataAsOf: "2026-09-25", source: "cm360", spend: 125 });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].spend, 125);
});

test("compares the latest two report totals without inventing missing metrics", () => {
  const comparison = compareLatestSnapshots({ performanceSnapshots: [
    campaignSnapshot({ dataAsOf: "2026-09-20", source: "CM360", spend: 100, clicks: 20 }),
    campaignSnapshot({ dataAsOf: "2026-09-25", source: "CM360", spend: 175, clicks: 35 })
  ] });
  assert.equal(comparison.changes.spend, 75);
  assert.equal(comparison.changes.clicks, 15);
  assert.equal(comparison.changes.impressions, null);
});

test("compares snapshots only within the same reporting source", () => {
  const comparison = compareLatestSnapshots({ performanceSnapshots: [
    campaignSnapshot({ dataAsOf: "2026-09-20", source: "CM360", spend: 100 }),
    campaignSnapshot({ dataAsOf: "2026-09-24", source: "DSP", spend: 500 }),
    campaignSnapshot({ dataAsOf: "2026-09-25", source: "CM360", spend: 175 })
  ] });
  assert.equal(comparison.previous.date, "2026-09-20");
  assert.equal(comparison.changes.spend, 75);
});

test("selects a period baseline from dated cumulative snapshots", () => {
  const performanceSnapshots = [
    campaignSnapshot({ dataAsOf: "2026-09-01", source: "CM360", spend: 100 }),
    campaignSnapshot({ dataAsOf: "2026-09-18", source: "CM360", spend: 300 }),
    campaignSnapshot({ dataAsOf: "2026-09-25", source: "CM360", spend: 475 })
  ];
  assert.equal(compareLatestSnapshots({ performanceSnapshots }, 7).previous.date, "2026-09-18");
  assert.equal(compareLatestSnapshots({ performanceSnapshots }, 30).previous.date, "2026-09-01");
});

test("returns selected-period spend only when comparable snapshots exist", () => {
  const campaign = { performanceSnapshots: [
    campaignSnapshot({ dataAsOf: "2026-09-18", source: "CM360", spend: 300 }),
    campaignSnapshot({ dataAsOf: "2026-09-25", source: "CM360", spend: 475 })
  ] };
  assert.equal(periodSpend(campaign, "7"), 175);
  assert.equal(periodSpend(campaign, "current"), null);
  assert.equal(periodSpend({}, "7"), null);
  assert.equal(periodMetrics(campaign, "7").spend, 175);
});

test("calculates a KPI from selected-period component deltas", () => {
  const campaign = { kpi: "CTR", performanceSnapshots: [
    campaignSnapshot({ dataAsOf: "2026-09-18", source: "CM360", impressions: 1000, clicks: 10 }),
    campaignSnapshot({ dataAsOf: "2026-09-25", source: "CM360", impressions: 2500, clicks: 40 })
  ] };
  assert.equal(periodKpi(campaign, "7").formatted, "2%");
  assert.equal(periodKpi(campaign, "current"), null);
});

test("bounds snapshot retention independently for each reporting source", () => {
  let campaign = { performanceSnapshots: [] };
  for (let day = 0; day < MAX_SNAPSHOTS_PER_SOURCE + 5; day += 1) {
    const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
    campaign = { performanceSnapshots: mergePerformanceSnapshots(campaign, { dataAsOf: date, source: "CM360", spend: day }) };
  }
  campaign = { performanceSnapshots: mergePerformanceSnapshots(campaign, { dataAsOf: "2026-01-01", source: "DSP", spend: 1 }) };
  assert.equal(campaign.performanceSnapshots.filter(snapshot => snapshot.source === "CM360").length, MAX_SNAPSHOTS_PER_SOURCE);
  assert.equal(campaign.performanceSnapshots.filter(snapshot => snapshot.source === "DSP").length, 1);
  assert.equal(campaign.performanceSnapshots.some(snapshot => snapshot.source === "CM360" && snapshot.date === "2026-01-01"), false);
});

test("lists newest snapshots first and exports an auditable CSV", () => {
  const campaign = { client: "Apex, Inc.", name: "Launch", campaignId: "CMP-1", performanceSnapshots: [
    { date: "2026-09-20", source: "DSP", spend: 100, impressions: 1000 },
    { date: "2026-09-25", source: "CM360", spend: 150, clicks: 20 }
  ] };
  assert.deepEqual(campaignSnapshotHistory(campaign).map(snapshot => snapshot.date), ["2026-09-25", "2026-09-20"]);
  const [headers, latest, previous] = parseCsv(exportPerformanceSnapshotsCsv(campaign));
  assert.equal(latest[headers.indexOf("data_as_of")], "2026-09-25");
  assert.equal(latest[headers.indexOf("clicks")], "20");
  assert.equal(previous[headers.indexOf("client")], "Apex, Inc.");
  assert.equal(previous[headers.indexOf("impressions")], "1000");
});
