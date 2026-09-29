import test from "node:test";
import assert from "node:assert/strict";
import { filterCampaignsByAttention } from "../lib/campaign-attention.js";

const campaigns = [{ name: "At risk" }, { name: "Healthy" }, { name: "Also at risk" }];
const alerts = [{ campaign: campaigns[0] }, { campaign: campaigns[0] }, { campaign: campaigns[2] }];

test("filters campaigns with active alerts without duplicating campaigns", () => {
  assert.deepEqual(filterCampaignsByAttention(campaigns, alerts, "attention").map(item => item.name), ["At risk", "Also at risk"]);
});

test("filters clear campaigns and preserves all campaigns for unsupported modes", () => {
  assert.deepEqual(filterCampaignsByAttention(campaigns, alerts, "clear").map(item => item.name), ["Healthy"]);
  assert.deepEqual(filterCampaignsByAttention(campaigns, alerts, "all"), campaigns);
  assert.notEqual(filterCampaignsByAttention(campaigns, alerts, "all"), campaigns);
});
