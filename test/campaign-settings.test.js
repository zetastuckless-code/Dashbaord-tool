import test from "node:test";
import assert from "node:assert/strict";
import { applyCampaignSettings } from "../lib/campaign-settings.js";

const campaign = { client: "Apex", name: "Old name", kpi: "CTR", value: "1%", target: "Target 2%", billingSource: "first" };

test("applies normalized editable campaign settings without losing source data", () => {
  const result = applyCampaignSettings(campaign, { name: "  New name  ", kpi: "vcr", value: "74%", target: "70%", billingSource: "third" });
  assert.equal(result.valid, true);
  assert.deepEqual(result.campaign, { client: "Apex", name: "New name", kpi: "VCR", value: "74%", target: "Target 70%", billingSource: "third", reportCadence: "none", owner: null, channel: null });
});

test("preserves an explicitly labelled target", () => {
  const result = applyCampaignSettings(campaign, { name: "Name", kpi: "CPA", value: "$42", target: "Target $40", billingSource: "reported" });
  assert.equal(result.campaign.target, "Target $40");
});

test("rejects blank fields and unsupported billing sources atomically", () => {
  const result = applyCampaignSettings(campaign, { name: "", kpi: "", value: "", target: "", billingSource: "CM360" });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 5);
  assert.equal(result.campaign, campaign);
});

test("saves an expected report cadence", () => {
  const result = applyCampaignSettings({ name: "Campaign" }, { name: "Campaign", billingSource: "reported", reportCadence: "daily", kpi: "CTR", value: "1%", target: "1%" });
  assert.equal(result.valid, true);
  assert.equal(result.campaign.reportCadence, "daily");
  assert.equal(applyCampaignSettings({}, { name: "Campaign", billingSource: "reported", reportCadence: "hourly", kpi: "CTR", value: "1%", target: "1%" }).valid, false);
});

test("resolves an imported campaign mapping with a stable source ID", () => {
  const result = applyCampaignSettings({ name: "Campaign", requiresMapping: true }, { name: "Campaign", campaignId: " CMP-42 ", billingSource: "reported", kpi: "CTR", value: "1%", target: "1%" });
  assert.equal(result.campaign.campaignId, "CMP-42");
  assert.equal(result.campaign.requiresMapping, false);
});
