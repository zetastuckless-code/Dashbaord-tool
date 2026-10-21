import test from "node:test";
import assert from "node:assert/strict";
import { campaignGroupName, groupCampaigns, groupKey, linesForRecord } from "../lib/campaign-groups.js";
import { metricsForCampaign, normalizeMetricPrefs, readMetricPrefs, reorderMetrics, resetCampaignMetrics, setCampaignMetrics, writeMetricPrefs } from "../lib/campaign-metric-prefs.js";

const asOf = new Date("2026-09-16T12:00:00Z");
const rec = (name, extra = {}) => ({ client: "Highmark", name, spend: 1, budget: 2, startDate: "2026-09-01", endDate: "2026-09-30", ...extra });

test("derives the campaign from the 'Campaign — Line' naming and groups sibling lines", () => {
  const groups = groupCampaigns([rec("B2B — Standard Display"), rec("B2B — OLV"), rec("Other Campaign")], asOf);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].name, "B2B");
  assert.deepEqual(groups[0].lines.map(line => line.name), ["Standard Display", "OLV"]);
  assert.equal(groups[1].lines.length, 1);
});

test("an explicit campaignGroup overrides the name and the key is case-insensitive", () => {
  assert.equal(campaignGroupName(rec("X — Y", { campaignGroup: "Custom" })), "Custom");
  assert.equal(groupKey(rec("B2B — A")), groupKey({ ...rec("b2b — B"), client: "HIGHMARK" }));
});

test("group status is live if any line is live and dates span the lines", () => {
  const [group] = groupCampaigns([rec("C — A", { startDate: "2026-01-01", endDate: "2026-02-01" }), rec("C — B", { endDate: "2026-12-31" })], asOf);
  assert.equal(group.status, "live");
  assert.equal(group.startDate, "2026-01-01");
  assert.equal(group.endDate, "2026-12-31");
});

test("expanded lines merge imported line items with planned flights by id or name", () => {
  const record = rec("Solo", {
    lineItems: [{ id: "832", name: "Hispanic Audio", spend: 10, impressions: 100 }],
    lineItemFlights: [{ id: "832", name: "Hispanic Audio", startDate: "2026-10-01", endDate: "2026-10-25", budget: 6250 }, { id: "999", name: "AA Audio", startDate: "2026-10-01", endDate: "2026-10-31", budget: 3361 }]
  });
  const lines = linesForRecord(record);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].spend, 10);
  assert.equal(lines[0].budget, 6250);
  assert.equal(lines[0].endDate, "2026-10-25");
  assert.equal(lines[1].kind, "flight");
});

test("metric preferences are per campaign with defaults and a reset", () => {
  let prefs = normalizeMetricPrefs(null);
  assert.deepEqual(metricsForCampaign(prefs, "a"), prefs.defaults);
  prefs = setCampaignMetrics(prefs, "a", ["spend", "impressions", "clicks", "roas"]);
  prefs = setCampaignMetrics(prefs, "b", ["impressions", "vcr", "spend"]);
  assert.deepEqual(metricsForCampaign(prefs, "a"), ["spend", "impressions", "clicks", "roas"]);
  assert.deepEqual(metricsForCampaign(prefs, "b"), ["impressions", "vcr", "spend"]);
  assert.deepEqual(metricsForCampaign(resetCampaignMetrics(prefs, "a"), "a"), prefs.defaults);
  const everywhere = setCampaignMetrics(prefs, null, ["spend", "ctr"]);
  assert.deepEqual(everywhere.byCampaign, {});
  assert.deepEqual(metricsForCampaign(everywhere, "b"), ["spend", "ctr"]);
});

test("preferences persist and survive corrupt storage", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  writeMetricPrefs(storage, setCampaignMetrics(normalizeMetricPrefs(null), "a", ["spend", "vcr"]));
  assert.deepEqual(readMetricPrefs(storage).byCampaign.a, ["spend", "vcr"]);
  storage.setItem("northstar-campaign-metrics", "{nope");
  assert.deepEqual(readMetricPrefs(storage).byCampaign, {});
});

test("reorders a metric before or after another and ignores unknown keys", () => {
  const list = ["spend", "impressions", "clicks", "roas"];
  assert.deepEqual(reorderMetrics(list, "roas", "spend"), ["roas", "spend", "impressions", "clicks"]);
  assert.deepEqual(reorderMetrics(list, "spend", "clicks", true), ["impressions", "clicks", "spend", "roas"]);
  assert.deepEqual(reorderMetrics(list, "spend", "impressions", false), list);
  assert.deepEqual(reorderMetrics(list, "ctr", "spend"), list);
  assert.deepEqual(reorderMetrics(list, "spend", "spend"), list);
  assert.deepEqual(list, ["spend", "impressions", "clicks", "roas"]);
});
