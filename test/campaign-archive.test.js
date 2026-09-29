import test from "node:test";
import assert from "node:assert/strict";
import { isCampaignArchived, setCampaignArchived } from "../lib/campaign-archive.js";

test("archives and restores a campaign without mutating its source record", () => {
  const campaign = { name: "Launch", budget: 100 };
  const archived = setCampaignArchived(campaign, true, "2026-09-28T12:00:00Z");
  assert.equal(isCampaignArchived(archived), true);
  assert.equal(archived.archivedAt, "2026-09-28T12:00:00Z");
  assert.equal(campaign.archivedAt, undefined);
  assert.equal(isCampaignArchived(setCampaignArchived(archived, false)), false);
});
