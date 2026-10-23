import test from "node:test";
import assert from "node:assert/strict";
import { groupKey } from "../lib/campaign-groups.js";
import { applyDelivery, assignPlacements, deliveryComparison, deliveryGap, planDelivery } from "../lib/third-party-delivery.js";

const line = (label, extra = {}) => ({ client: "Nature's Sunshine", name: `Nature's Sunshine 2026 — ${label}`, ...extra });

test("placements go to the line whose name they carry, the most specific line winning", () => {
  const lines = [line("Display"), line("YouTube"), line("YouTube (Video Views)")];
  const { assigned, unassigned } = assignPlacements(lines, ["Zeta_Display_Conversion_Lookalikes_160x600", "Zeta_YouTube_Awareness_Beets_2026_30s_1x1", "Zeta_YouTube_Awareness_Video_Views_Beets_2026_30s_1x1", "Zeta_CTV_Spot_30s"]);
  assert.equal(assigned.get("Zeta_Display_Conversion_Lookalikes_160x600"), 0);
  assert.equal(assigned.get("Zeta_YouTube_Awareness_Beets_2026_30s_1x1"), 1);
  assert.equal(assigned.get("Zeta_YouTube_Awareness_Video_Views_Beets_2026_30s_1x1"), 2);
  assert.deepEqual(unassigned, ["Zeta_CTV_Spot_30s"]);
});

const parsed = {
  source: "CM360",
  campaigns: [{ key: "34720547", sourceCampaignId: "34720547", sourceCampaignName: "Nature's Sunshine 2026" }],
  records: [],
  placements: ["2026-10-01", "2026-10-02", "2026-10-03"].flatMap(date => [
    { date, sourceCampaignId: "34720547", sourceCampaignName: "Nature's Sunshine 2026", placement: "Zeta_Display_A_300x250", impressions: 1000, clicks: 10, spend: 4, conversions: 1, revenue: 50 },
    { date, sourceCampaignId: "34720547", sourceCampaignName: "Nature's Sunshine 2026", placement: "Zeta_Display_B_728x90", impressions: 500, clicks: 5, spend: 2, conversions: 0, revenue: 0 }
  ])
};

test("a DCM campaign matches by name and stores each line's days without touching its own numbers", () => {
  const campaigns = [line("Display", { spend: 900, dataAsOf: "2026-09-30" }), line("YouTube", { spend: 100 })];
  const plan = planDelivery(campaigns, parsed);
  assert.equal(plan[0].target, groupKey(campaigns[0]));
  const { campaigns: next, lineCount } = applyDelivery(campaigns, parsed, plan);
  assert.equal(lineCount, 1);
  assert.deepEqual(next[0].thirdPartyDelivery.CM360["2026-10-02"], { impressions: 1500, clicks: 15, spend: 6, conversions: 1, revenue: 50 });
  assert.equal(next[0].spend, 900);
  assert.equal(next[0].dataAsOf, "2026-09-30");
  // A later month-to-date file replaces the same days instead of adding to them.
  const again = applyDelivery(next, parsed, planDelivery(next, parsed));
  assert.equal(again.campaigns[0].thirdPartyDelivery.CM360["2026-10-02"].impressions, 1500);
});

test("the comparison covers only the days both sources have, and flags a gap over the limit", () => {
  const days = Object.fromEntries(["2026-10-01", "2026-10-02", "2026-10-03"].map(date => [date, { impressions: 1500, clicks: 150, spend: 6, conversions: 1, revenue: 50 }]));
  const record = line("Display", { thirdPartyDelivery: { CM360: days }, performanceSnapshots: [
    { date: "2026-09-30", source: "Zeta Global", impressions: 10000, clicks: 100, spend: 40, conversions: 5, revenue: 0 },
    { date: "2026-10-03", source: "Zeta Global", impressions: 15400, clicks: 600, spend: 70, conversions: 9, revenue: 0 }
  ] });
  const comparison = deliveryComparison(record);
  assert.equal(comparison.from, "2026-10-01");
  assert.equal(comparison.to, "2026-10-03");
  assert.equal(comparison.adServer.impressions, 4500);
  assert.equal(comparison.report.impressions, 5400);
  assert.equal(Math.round(comparison.gaps.impressions), 20);
  assert.equal(comparison.cpa, 10);
  assert.equal(deliveryGap(comparison).metric, "impressions");
  // A missing DCM day inside the window means no comparison, rather than a wrong one.
  const gappy = { ...record, thirdPartyDelivery: { CM360: { "2026-10-01": days["2026-10-01"], "2026-10-03": days["2026-10-03"] } } };
  assert.equal(deliveryComparison(gappy), null);
});
