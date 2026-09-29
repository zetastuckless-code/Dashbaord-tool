import test from "node:test";
import assert from "node:assert/strict";
import { dashboardFlightStatus, filterCampaigns } from "../lib/campaign-filters.js";

const asOf = new Date("2026-09-25T12:00:00Z");
const campaigns = [
  { client: "Apex", owner: "Jordan", channel: "Video", name: "Live", startDate: "2026-09-01", endDate: "2026-09-30" },
  { client: "Apex", name: "Future", startDate: "2026-10-01", endDate: "2026-10-31" },
  { client: "Nova", name: "Complete", startDate: "2026-08-01", endDate: "2026-08-31" },
  { client: "Nova", name: "Legacy" },
  { client: "Nova", name: "Archived", archivedAt: "2026-09-20T12:00:00Z" }
];

test("treats undated legacy campaigns as live in dashboard filters", () => {
  assert.equal(dashboardFlightStatus(campaigns[3], asOf), "live");
});

test("classifies archived campaigns separately from their flight state", () => {
  assert.equal(dashboardFlightStatus(campaigns[4], asOf), "archived");
  assert.deepEqual(filterCampaigns(campaigns, { status: "archived" }, asOf).map(campaign => campaign.name), ["Archived"]);
});

test("combines client and flight-status filters", () => {
  assert.deepEqual(filterCampaigns(campaigns, { client: "Apex", status: "live" }, asOf).map(campaign => campaign.name), ["Live"]);
  assert.deepEqual(filterCampaigns(campaigns, { client: "all", status: "completed" }, asOf).map(campaign => campaign.name), ["Complete"]);
  assert.deepEqual(filterCampaigns(campaigns, { client: "Nova", status: "all" }, asOf).map(campaign => campaign.name), ["Complete", "Legacy"]);
});

test("combines campaign owner with existing filters", () => {
  assert.deepEqual(filterCampaigns(campaigns, { owner: "Jordan", status: "live" }, asOf).map(campaign => campaign.name), ["Live"]);
  assert.deepEqual(filterCampaigns(campaigns, { owner: "Missing" }, asOf), []);
});


test("combines channel with client, status, and owner filters", () => {
  assert.deepEqual(filterCampaigns(campaigns, { client: "Apex", status: "live", owner: "Jordan", channel: "Video" }, asOf).map(campaign => campaign.name), ["Live"]);
  assert.deepEqual(filterCampaigns(campaigns, { channel: "Display" }, asOf), []);
});


test("searches campaign identity and operational metadata case-insensitively", () => {
  assert.deepEqual(filterCampaigns(campaigns, { query: "live" }, asOf).map(campaign => campaign.name), ["Live"]);
  assert.deepEqual(filterCampaigns(campaigns, { query: "jOrDaN" }, asOf).map(campaign => campaign.name), ["Live"]);
  assert.deepEqual(filterCampaigns([{ client: "Apex", name: "Launch", campaignId: "CM-42", source: "DSP", sources: ["DSP", "CM360"] }], { query: "cm360" }, asOf).map(campaign => campaign.name), ["Launch"]);
  assert.deepEqual(filterCampaigns(campaigns, { client: "Nova", query: "future" }, asOf), []);
});
