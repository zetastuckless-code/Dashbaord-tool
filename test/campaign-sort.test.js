import test from "node:test";
import assert from "node:assert/strict";
import { sortCampaigns } from "../lib/campaign-sort.js";

const campaigns = [
  { name: "Zulu", spend: 50, firstPartySpend: 75, budget: 100, pacing: 120, dataAsOf: "2026-09-20" },
  { name: "Alpha", spend: 90, firstPartySpend: 60, budget: 100, pacing: 95, dataAsOf: "2026-09-25" },
  { name: "Bravo", spend: 10, firstPartySpend: 100, budget: 100, pacing: null, dataAsOf: null }
];

test("sorts campaigns by name and the selected spend source without mutation", () => {
  assert.deepEqual(sortCampaigns(campaigns, { mode: "name" }).map(item => item.name), ["Alpha", "Bravo", "Zulu"]);
  assert.deepEqual(sortCampaigns(campaigns, { mode: "spend", spendView: "first" }).map(item => item.name), ["Bravo", "Zulu", "Alpha"]);
  assert.deepEqual(campaigns.map(item => item.name), ["Zulu", "Alpha", "Bravo"]);
});

test("sorts pacing risk first and leaves unavailable pacing last", () => {
  assert.deepEqual(sortCampaigns(campaigns, { mode: "pacing-risk" }).map(item => item.name), ["Zulu", "Alpha", "Bravo"]);
});

test("sorts freshest dated campaigns first and preserves portfolio order by default", () => {
  assert.deepEqual(sortCampaigns(campaigns, { mode: "freshness" }).map(item => item.name), ["Alpha", "Zulu", "Bravo"]);
  assert.deepEqual(sortCampaigns(campaigns, { mode: "unsupported" }).map(item => item.name), ["Zulu", "Alpha", "Bravo"]);
});
