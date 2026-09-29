import test from "node:test";
import assert from "node:assert/strict";
import { buildPortfolioSpendTrend, exportPortfolioSpendTrendCsv } from "../lib/portfolio-trend.js";
import { parseCsv } from "../lib/importer.js";

test("aggregates cumulative campaign snapshots with carry-forward values", () => {
  const campaigns = [
    { source: "CM360", startDate: "2026-09-01", endDate: "2026-09-10", budget: 1000, spend: 400, performanceSnapshots: [{ date: "2026-09-02", source: "CM360", spend: 100 }, { date: "2026-09-04", source: "CM360", spend: 350 }] },
    { source: "DSP", startDate: "2026-09-01", endDate: "2026-09-10", budget: 500, spend: 200, performanceSnapshots: [{ date: "2026-09-03", source: "DSP", spend: 50 }] }
  ];
  assert.deepEqual(buildPortfolioSpendTrend(campaigns), [
    { date: "2026-09-02", actual: 100, planned: 200, actualCampaigns: 1, plannedCampaigns: 1, historyCampaigns: 2, totalCampaigns: 2 },
    { date: "2026-09-03", actual: 150, planned: 450, actualCampaigns: 2, plannedCampaigns: 2, historyCampaigns: 2, totalCampaigns: 2 },
    { date: "2026-09-04", actual: 400, planned: 600, actualCampaigns: 2, plannedCampaigns: 2, historyCampaigns: 2, totalCampaigns: 2 }
  ]);
});

test("compares actual and planned spend over the same source-covered campaigns", () => {
  const covered = { source: "DSP", startDate: "2026-09-01", endDate: "2026-09-10", budget: 1000, spend: 100, performanceSnapshots: [{ date: "2026-09-02", source: "DSP", spend: 100 }] };
  const missing = { source: "DSP", startDate: "2026-09-01", endDate: "2026-09-10", budget: 5000, spend: 0 };
  assert.deepEqual(buildPortfolioSpendTrend([covered, missing])[0], { date: "2026-09-02", actual: 100, planned: 200, actualCampaigns: 1, plannedCampaigns: 1, historyCampaigns: 1, totalCampaigns: 2 });
});

test("uses one reporting-source history per campaign and handles no history", () => {
  const campaign = { source: "CM360", performanceSnapshots: [{ date: "2026-09-01", source: "DSP", spend: 20 }, { date: "2026-09-02", source: "CM360", spend: 30 }] };
  assert.deepEqual(buildPortfolioSpendTrend([campaign]).map(point => [point.date, point.actual]), [["2026-09-02", 30]]);
  assert.deepEqual(buildPortfolioSpendTrend([{ source: "DSP" }]), []);
});

test("selects first- or third-party trend history from the active spend view", () => {
  const campaign = { source: "DSP", billingSource: "CM360", performanceSnapshots: [
    { date: "2026-09-01", source: "DSP", spend: 20 },
    { date: "2026-09-01", source: "CM360", spend: 30 },
    { date: "2026-09-02", source: "Flashtalking", spend: 40 }
  ] };
  assert.deepEqual(buildPortfolioSpendTrend([campaign], { spendView: "first" }).map(point => point.actual), [20]);
  assert.deepEqual(buildPortfolioSpendTrend([campaign], { spendView: "third" }).map(point => point.actual), [30, 40]);
  assert.deepEqual(buildPortfolioSpendTrend([campaign], { spendView: "billing" }).map(point => point.actual), [30, 40]);
  assert.deepEqual(buildPortfolioSpendTrend([{ ...campaign, performanceSnapshots: campaign.performanceSnapshots.slice(1) }], { spendView: "first" }), []);
});

test("exports spend trend values, variance, pacing, and coverage", () => {
  const points = [{ date: "2026-09-02", actual: 120, planned: 100, actualCampaigns: 2, plannedCampaigns: 2, historyCampaigns: 2, totalCampaigns: 3 }];
  const [headers, row] = parseCsv(exportPortfolioSpendTrendCsv(points, "third"));
  assert.equal(row[headers.indexOf("spend_view")], "third");
  assert.equal(row[headers.indexOf("spend_variance")], "20");
  assert.equal(row[headers.indexOf("pacing_percent")], "120");
  assert.equal(row[headers.indexOf("campaigns_with_history")], "2");
  assert.equal(row[headers.indexOf("total_campaigns")], "3");
});
