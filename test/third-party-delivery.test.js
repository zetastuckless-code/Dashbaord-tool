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
  assert.deepEqual(next[0].thirdPartyDelivery.CM360["2026-10-02"], { impressions: 1500, clicks: 15, spend: 6, conversions: 1, revenue: 50, videoStarts: null, videoCompletions: null });
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

test("DCM days after the latest report top up spend and delivery, and a newer report takes over", async () => {
  const { applyDcmTopUp } = await import("../lib/third-party-delivery.js");
  const days = Object.fromEntries(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map(date => [date, { impressions: 1000, clicks: 10, spend: 20, conversions: 1, revenue: 30 }]));
  const record = line("Display", {
    startDate: "2026-01-01", endDate: "2026-12-31", dataAsOf: "2026-10-02", spend: 500, firstPartySpend: 500, impressions: 50000, clicks: 400, conversions: 9, revenue: 100,
    thirdPartyDelivery: { CM360: days },
    performanceSnapshots: [{ date: "2026-09-30", source: "Zeta Global", spend: 480, impressions: 48000, clicks: 380, conversions: 8, revenue: 70 }, { date: "2026-10-02", source: "Zeta Global", spend: 500, impressions: 50000, clicks: 400, conversions: 9, revenue: 100 }]
  });
  const topped = applyDcmTopUp(record);
  // Over Oct 1–2 the report spent $20 where DCM priced $40, so DCM cost is scaled by 0.5.
  assert.equal(topped.dcmTopUp.factor, 0.5);
  assert.equal(topped.spend, 520);
  assert.equal(topped.firstPartySpend, 520);
  assert.equal(topped.impressions, 52000);
  assert.equal(topped.dataAsOf, "2026-10-04");
  assert.equal(topped.performanceSnapshots.filter(snapshot => snapshot.dcm).length, 2);
  // Applying again changes nothing.
  assert.deepEqual(applyDcmTopUp(topped), topped);
  // A newer report replaces the topped-up numbers and DCM only adds what comes after it.
  const fresh = applyDcmTopUp({ ...topped, dataAsOf: "2026-10-03", spend: 512, firstPartySpend: 512, impressions: 51200 });
  assert.equal(fresh.reportBase.spend, 512);
  assert.equal(fresh.dcmTopUp.from, "2026-10-04");
  assert.equal(fresh.spend, 522);
  // Removing the DCM data puts the report's own numbers back.
  const { thirdPartyDelivery, ...withoutDcm } = topped;
  const restored = applyDcmTopUp(withoutDcm);
  assert.equal(restored.spend, 500);
  assert.equal(restored.dataAsOf, "2026-10-02");
  assert.equal(restored.dcmTopUp, undefined);
});

test("a DSP export is read as DSP delivery split by line item, and fills in ahead of DCM", async () => {
  const { parseCsv } = await import("../lib/importer.js");
  const { detectDailyDelivery, parseDailyDelivery } = await import("../lib/daily-delivery-import.js");
  const { topUpSource } = await import("../lib/third-party-delivery.js");
  const rows = parseCsv([
    '"Advertisement","Campaign","Date","Line Item","Clicks","Impressions","Spend","Video Completions","Video Starts"',
    '"Spot A","ZCA-12572_Carter Streaming Audio","2026-10-01","AA Audio","0","5000","110.5","4900","4990"',
    '"Spot B","ZCA-12572_Carter Streaming Audio","2026-10-01","Hispanic Audio","1","6000","130","5900","5990"',
    '"Spot C","ZCA-12572_Carter Streaming Audio","2026-10-01","Hispanic Audio","0","1000","20","990","999"'
  ].join("\n"));
  const parsed = parseDailyDelivery(rows, detectDailyDelivery(rows), { fileName: "export_1.csv" });
  assert.equal(parsed.source, "DSP");
  assert.deepEqual(parsed.placements.map(row => [row.placement, row.impressions]), [["AA Audio", 5000], ["Hispanic Audio", 7000]]);
  assert.equal(parsed.placements[1].videoCompletions, 6890);
  assert.equal(topUpSource({ thirdPartyDelivery: { CM360: { "2026-10-01": {} }, DSP: { "2026-10-01": {} } } }), "DSP");
  assert.equal(topUpSource({ thirdPartyDelivery: { CM360: { "2026-10-01": {} } } }), "CM360");
});

test("IO format names match DCM's: Standard Display, Native Display and Online Video, with added value kept apart", () => {
  const lines = ["Standard Display CPA", "Native Display CPA", "Online Video CPA", "Standard Display DE"].map(label => ({ name: `Highmark B2B — ${label}` }));
  const prefix = "COMM-2026 B2B BECAUSE LIFE CAMPAIGN-AWARE-";
  const { assigned, unassigned } = assignPlacements(lines, [
    `${prefix}DISPLAY-ZETA-TRAFFIC-PROS-CPA`,
    `${prefix}NATIVE-ZETA-TRAFFIC-PROS-CPA_N/A_N/A-A35:64_M/F_N/A_CONTEXTUAL, BEHAVIORAL AND COMPANY SIZE`,
    `${prefix}OLV-ZETA-TRAFFIC-PROS-CPA_N/A_N/A-A35:64_M/F_N/A_BEHAVIORAL AND COMPANY SIZE`,
    `${prefix}DISPLAY-ZETA-DE-ADDEDVALUE`
  ]);
  assert.deepEqual([...assigned.values()], [0, 1, 2]);
  assert.deepEqual(unassigned, [`${prefix}DISPLAY-ZETA-DE-ADDEDVALUE`]);
  // An added-value line still takes its own placements.
  const withAv = assignPlacements([...lines, { name: "Highmark B2B — Standard Display DE Added Value" }], [`${prefix}DISPLAY-ZETA-DE-ADDEDVALUE`]);
  assert.equal(withAv.assigned.get(`${prefix}DISPLAY-ZETA-DE-ADDEDVALUE`), 4);
});

test("placements picked by hand go on the chosen line, and remembered picks place later reports", async () => {
  const { planDelivery, placementChoiceKey, rememberPlacementLinks, LEAVE_OUT } = await import("../lib/third-party-delivery.js");
  const lines = [{ client: "Brand", name: "Brand 2026" }, { client: "Brand", name: "Brand 2026 — YouTube" }].map(record => ({ ...record, campaignGroup: "Brand 2026" }));
  const parsed = { source: "CM360", campaigns: [{ key: "123", sourceCampaignId: "123", sourceCampaignName: "Brand 2026" }], placements: [
    { sourceCampaignId: "123", placement: "Zeta_Display_Conversion_300x250", date: "2026-10-01", impressions: 10 },
    { sourceCampaignId: "123", placement: "Zeta_Display_Lookalikes_728x90", date: "2026-10-01", impressions: 5 },
    { sourceCampaignId: "123", placement: "YouTube_Bumper", date: "2026-10-01", impressions: 7 }
  ], records: [] };
  const target = "brand::brand 2026";
  const unpicked = planDelivery(lines, parsed, {}, { 123: target })[0];
  assert.deepEqual(unpicked.unassigned, ["Zeta_Display_Conversion_300x250", "Zeta_Display_Lookalikes_728x90"]);
  const choices = { [placementChoiceKey("123", "Zeta_Display_Conversion_300x250")]: "Brand 2026", [placementChoiceKey("123", "Zeta_Display_Lookalikes_728x90")]: LEAVE_OUT };
  const picked = planDelivery(lines, parsed, {}, { 123: target }, choices)[0];
  assert.equal(picked.assigned.get("Zeta_Display_Conversion_300x250"), 0);
  assert.deepEqual(picked.unassigned, ["Zeta_Display_Lookalikes_728x90"]);
  // Remembered, the next report places them the same way with nothing picked.
  const store = new Map();
  const links = rememberPlacementLinks({ setItem: (key, value) => store.set(key, value) }, {}, [picked], "CM360", choices);
  const later = planDelivery(lines, parsed, links, { 123: target })[0];
  assert.equal(later.assigned.get("Zeta_Display_Conversion_300x250"), 0);
  assert.equal(later.assigned.has("Zeta_Display_Lookalikes_728x90"), false);
  assert.equal(later.assigned.get("YouTube_Bumper"), 1);
});

test("days the report covers with no row for a line count as zero, and New York placements go on an NY line", async () => {
  const { planDelivery, applyDelivery } = await import("../lib/third-party-delivery.js");
  const lines = ["NY", "Chicago"].map(label => ({ client: "McMaster", name: `McMaster Q3 — ${label}`, startDate: "2026-07-06", endDate: "2026-10-30" }));
  const placement = (name, date, impressions) => ({ sourceCampaignId: "36221912", sourceCampaignName: "McMaster", placement: name, date, impressions });
  const parsed = { source: "CM360", coverage: { from: "2026-10-01", to: "2026-10-31" }, campaigns: [{ key: "36221912", sourceCampaignId: "36221912", sourceCampaignName: "McMaster" }], records: [], placements: [
    placement("Zeta Global_Standard Display_New York DMA_Prospecting_(300x250)", "2026-10-05", 100),
    placement("Zeta Global_Standard Display_Chicago DMA_Prospecting_(300x250)", "2026-10-06", 50)
  ] };
  const plan = planDelivery(lines, parsed, {}, { 36221912: "mcmaster::mcmaster q3" });
  assert.deepEqual(plan[0].unassigned, []);
  const { campaigns } = applyDelivery(lines, parsed, plan);
  const ny = campaigns[0].thirdPartyDelivery.CM360;
  assert.equal(ny["2026-10-05"].impressions, 100);
  assert.equal(ny["2026-10-01"].impressions, 0);
  // Covered through Oct 30, the line's last day; Oct 31 is after its flight.
  assert.equal(Object.keys(ny).length, 30);
});

test("placements named with flight dates go on Flight 1, Flight 2… lines, from the IO's flights or in date order", async () => {
  const { assignByFlight } = await import("../lib/third-party-delivery.js");
  const lines = [1, 2, 3].map(number => ({ name: `RAC Hyperlocal — Flight ${number}`, startDate: "2026-04-26", endDate: "2026-10-24" }));
  const names = ["P3F0ZKV_P3F0ZKV_Cross Screen Standard Display - CRM_160 x 600_2026-04-26_2026-05-30", "P3F0ZTP_P3F0ZTP_Cross Screen Standard Display - CRM_160 x 600_2026-05-31_2026-06-27", "P3F102B_P3F102B_Cross Screen Standard Display - CRM_160 x 600_2026-09-27_2026-10-24"];
  const flights = [{ startDate: "2026-04-26", endDate: "2026-05-30" }, { startDate: "2026-05-31", endDate: "2026-06-27" }, { startDate: "2026-09-27", endDate: "2026-10-24" }];
  assert.deepEqual([...assignByFlight(lines, names, flights).values()], [0, 1, 2]);
  // With no IO, three date ranges for three flight lines go in date order.
  assert.deepEqual([...assignByFlight(lines, names).values()], [0, 1, 2]);
  // A line whose own dates are the flight takes it, whatever it's called.
  const own = [{ name: "RAC — Fall", startDate: "2026-09-27", endDate: "2026-10-24" }, { name: "RAC — Spring", startDate: "2026-04-26", endDate: "2026-05-30" }];
  assert.deepEqual([...assignByFlight(own, [names[2], names[0]])], [[names[2], 0], [names[0], 1]]);
  // Two ranges for three flight lines, with no IO, isn't guessed.
  assert.equal(assignByFlight(lines, names.slice(0, 2)).size, 0);
});

test("a DCM campaign skipped indefinitely stays skipped in later reports until a campaign is picked for it", async () => {
  const { planDelivery, rememberThirdPartyLinks, SKIP_ALWAYS } = await import("../lib/third-party-delivery.js");
  const storage = { items: {}, setItem(key, value) { this.items[key] = value; } };
  const lines = [{ client: "RAC", name: "RAC National OLA Q2 2026", campaignGroup: "RAC National OLA Q2 2026" }];
  const parsed = { source: "CM360", campaigns: [{ key: "35351866", sourceCampaignId: "35351866", sourceCampaignName: "RAC_National_OLA_Q2_2026" }], placements: [{ sourceCampaignId: "35351866", placement: "Display_300x250", date: "2026-10-27", impressions: 10 }], records: [] };
  const entry = parsed.campaigns[0];
  // Ticked: saved as a standing skip.
  let links = rememberThirdPartyLinks(storage, {}, [{ entry, target: null, skipped: true, skipAlways: true }], "CM360");
  assert.equal(links["CM360::35351866"], SKIP_ALWAYS);
  const later = planDelivery(lines, parsed, links)[0];
  assert.equal(later.skipped, true);
  assert.equal(later.skippedAlways, true);
  assert.equal(later.target, null);
  // Skipped just this once leaves no link behind; unticking a standing skip removes it.
  assert.equal(rememberThirdPartyLinks(storage, {}, [{ entry, target: null, skipped: true, skipAlways: false }], "CM360")["CM360::35351866"], undefined);
  links = rememberThirdPartyLinks(storage, links, [{ entry, target: null, skipped: true, skipAlways: false }], "CM360");
  assert.equal(links["CM360::35351866"], undefined);
  // Picking a campaign by hand wins over the standing skip.
  const picked = planDelivery(lines, parsed, { "CM360::35351866": SKIP_ALWAYS }, { 35351866: "rac::rac national ola q2 2026" })[0];
  assert.equal(picked.skipped, undefined);
  assert.equal(picked.target, "rac::rac national ola q2 2026");
});
