import test from "node:test";
import assert from "node:assert/strict";
import { createCampaign } from "../lib/campaign-creation.js";

const valid = { client: " Apex Athletics ", name: "Spring Launch", campaignId: " CM-1001 ", owner: " Jordan Davis ", channel: " Video ", startDate: "2027-03-01", endDate: "2027-05-31", budget: "$250,000", billingSource: "first", kpi: "vcr", target: "70%", reportCadence: "daily", ioFileName: "approved-io.pdf" };

test("creates a normalized campaign with an auditable IO reference", () => {
  const result = createCampaign(valid, "2026-09-24T12:00:00Z");
  assert.equal(result.valid, true);
  assert.equal(result.campaign.client, "Apex Athletics");
  assert.equal(result.campaign.budget, 250000);
  assert.equal(result.campaign.kpi, "VCR");
  assert.equal(result.campaign.target, "Target 70%");
  assert.equal(result.campaign.ioFileName, "approved-io.pdf");
  assert.equal(result.campaign.campaignId, "CM-1001");
  assert.equal(result.campaign.requiresMapping, false);
  assert.equal(result.campaign.owner, "Jordan Davis");
  assert.equal(result.campaign.channel, "Video");
  assert.equal(result.campaign.reportCadence, "daily");
  assert.match(result.campaign.id, /^manual-/);
});

test("rejects an end date before the start date", () => {
  const result = createCampaign({ ...valid, endDate: "2027-02-01" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("Campaign end date must be on or after its start date."));
});

test("rejects missing required campaign setup fields", () => {
  const result = createCampaign({});
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 8);
  assert.equal(result.campaign, null);
});

test("flags a campaign without a stable source ID for later mapping", () => {
  const result = createCampaign({ ...valid, campaignId: "", owner: "", reportCadence: "none" });
  assert.equal(result.valid, true);
  assert.equal(result.campaign.campaignId, null);
  assert.equal(result.campaign.requiresMapping, true);
  assert.equal(result.campaign.owner, null);
  assert.equal(result.campaign.reportCadence, "none");
});

test("rejects an unsupported report cadence atomically", () => {
  const result = createCampaign({ ...valid, reportCadence: "monthly" });
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ["Choose a valid report cadence."]);
  assert.equal(result.campaign, null);
});

test("manual budgets do not require an insertion order", () => {
  const result = createCampaign({ ...valid, ioFileName: "", budgetSource: "manual" });
  assert.equal(result.valid, true);
  assert.equal(result.campaign.budgetSource, "manual");
  assert.equal(result.campaign.ioFileName, null);
});

test("insertion-order budgets require the attached document", () => {
  const result = createCampaign({ ...valid, ioFileName: "", budgetSource: "io" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes("insertion order")));
  assert.equal(createCampaign(valid).campaign.budgetSource, "io");
});

test("report-sourced budgets may be left blank until a report supplies one", () => {
  const result = createCampaign({ ...valid, ioFileName: "", budget: "", budgetSource: "report" });
  assert.equal(result.valid, true);
  assert.equal(result.campaign.budget, null);
  assert.equal(result.campaign.pacing, null);
  assert.equal(createCampaign({ ...valid, budget: "", budgetSource: "manual" }).valid, false);
  assert.equal(createCampaign({ ...valid, budget: "abc", budgetSource: "report" }).valid, false);
});
