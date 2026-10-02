import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCsv } from "../lib/importer.js";
import { applyDailyDelivery, coverageWarning, detectDailyDelivery, exportDailyDeliveryCsv, matchSourceCampaign, parseDailyDelivery, parseDeliveryDate } from "../lib/daily-delivery-import.js";

const load = (name, options = {}) => {
  const rows = parseCsv(readFileSync(new URL(`../templates/alpha/${name}`, import.meta.url), "utf8"));
  const detection = detectDailyDelivery(rows);
  return { detection, parsed: detection && parseDailyDelivery(rows, detection, { fileName: name, ...options }) };
};
const alpha = { client: "Alpha", name: "Alpha Retargeting", campaignId: "900001", spend: 5000, budget: 9000, source: "Zeta Global", startDate: "2026-09-01", firstPartySpend: 4000, thirdPartySpend: null };

test("parses a CM360 report with a metadata block and sums placements per day", () => {
  const { detection, parsed } = load("05-cm360-daily.csv");
  assert.equal(detection.hasReportFields, true);
  assert.equal(parsed.source, "CM360");
  assert.equal(parsed.valid, true);
  const day = parsed.records.find(record => record.sourceCampaignId === "900001" && record.date === "2026-09-01");
  assert.equal(day.impressions, 150000);
  assert.equal(day.spend, 630);
  assert.equal(parsed.campaigns.length, 2);
});

test("parses a Flashtalking export with US dates and infers the source from the file name", () => {
  const { parsed } = load("06-flashtalking-daily.csv");
  assert.equal(parsed.source, "Flashtalking");
  assert.deepEqual(parsed.records.map(record => record.date), ["2026-09-01", "2026-09-02"]);
});

test("does not detect campaign-summary layouts as daily delivery", () => {
  const rows = [["Client", "Campaign", "Spend", "Budget", "Pacing", "KPI", "KPI Value", "KPI Target", "Source"], ["A", "B", 1, 2, 3, "CTR", "1%", "1%", "CM360"]];
  assert.equal(detectDailyDelivery(rows), null);
});

test("accepts Excel dates and rejects unparseable ones", () => {
  assert.equal(parseDeliveryDate(new Date("2026-09-24T00:00:00Z")), "2026-09-24");
  assert.equal(parseDeliveryDate("9/4/26"), "2026-09-04");
  assert.equal(parseDeliveryDate("2026-02-31"), null);
  const rows = [["Date", "Campaign", "Impressions"], ["soon", "X", "5"]];
  const parsed = parseDailyDelivery(rows, detectDailyDelivery(rows));
  assert.equal(parsed.valid, false);
  assert.match(parsed.errors[0], /not a valid date/);
});

test("rolls matched days into third-party spend and cumulative snapshots; reports unmatched campaigns", () => {
  const { parsed } = load("05-cm360-daily.csv");
  const result = applyDailyDelivery([alpha], parsed);
  assert.equal(result.matched.length, 1);
  assert.equal(result.unmatched[0].sourceCampaignId, "900777");
  const [campaign] = result.campaigns;
  assert.equal(campaign.thirdPartySpend, 1510);
  assert.equal(campaign.dataAsOf, "2026-09-03");
  assert.equal(campaign.performanceSnapshots.at(-1).spend, 1510);
  assert.equal(campaign.performanceSnapshots.length, 3);
  assert.equal(campaign.sourceIds.CM360.includes("900001"), true);
});

test("re-importing overlapping days is idempotent and later reports extend history", () => {
  const { parsed } = load("05-cm360-daily.csv");
  const once = applyDailyDelivery([alpha], parsed).campaigns;
  const twice = applyDailyDelivery(once, parsed).campaigns;
  assert.equal(twice[0].thirdPartySpend, 1510);
  assert.equal(Object.keys(twice[0].dailyDelivery.CM360).length, 3);
  const rows = [["Date", "Campaign", "Campaign ID", "Impressions", "Clicks", "Media Cost"], ["2026-09-03", "Alpha Retargeting", "900001", "100000", "300", "400"], ["2026-09-04", "Alpha Retargeting", "900001", "10000", "30", "40"]];
  const correction = parseDailyDelivery(rows, detectDailyDelivery(rows), { source: "CM360" });
  const extended = applyDailyDelivery(twice, correction).campaigns[0];
  assert.equal(extended.thirdPartySpend, 630 + 500 + 400 + 40);
});

test("derives spend from a billing CPM when the report has no cost column and warns about late coverage", () => {
  const rows = [["Date", "Campaign", "Impressions", "Clicks"], ["2026-09-10", "Alpha Retargeting", "200000", "500"]];
  const parsed = parseDailyDelivery(rows, detectDailyDelivery(rows), { source: "CM360" });
  const withCpm = applyDailyDelivery([{ ...alpha, billingCpm: 5 }], parsed);
  assert.equal(withCpm.campaigns[0].thirdPartySpend, 1000);
  assert.match(withCpm.warnings[0], /may be understated/);
  const noCpm = applyDailyDelivery([alpha], parsed).campaigns[0];
  assert.equal(noCpm.thirdPartySpend, null);
  assert.equal(coverageWarning(noCpm, "Flashtalking"), null);
});

test("matches by saved link, stable ID, and unambiguous name only", () => {
  const campaigns = [alpha, { ...alpha, name: "Alpha Prospecting", campaignId: "900002" }];
  assert.equal(matchSourceCampaign(campaigns, { sourceCampaignId: "900002", sourceCampaignName: "" }, "CM360"), 1);
  assert.equal(matchSourceCampaign(campaigns, { sourceCampaignId: "", sourceCampaignName: "alpha" }, "CM360"), -1);
  assert.equal(matchSourceCampaign(campaigns, { sourceCampaignId: "5", sourceCampaignName: "Brand X" }, "CM360", { "CM360::5": 1 }), 1);
});

test("exports stored daily delivery to CSV", () => {
  const { parsed } = load("05-cm360-daily.csv");
  const csv = exportDailyDeliveryCsv(applyDailyDelivery([alpha], parsed).campaigns[0]);
  assert.equal(csv.split("\n").length, 4);
  assert.match(csv.split("\n")[1], /^Alpha,Alpha Retargeting,900001,CM360,2026-09-01,150000/);
});
