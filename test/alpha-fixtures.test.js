import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateCampaignCsv } from "../lib/importer.js";
import { mergeCampaignImports } from "../lib/import-merge.js";

const fixture = name => readFile(new URL(`../templates/alpha/${name}`, import.meta.url), "utf8");

test("alpha source fixtures validate and reconcile by stable campaign ID", async () => {
  const first = validateCampaignCsv(await fixture("01-first-party-daily.csv"));
  const third = validateCampaignCsv(await fixture("02-third-party-daily.csv"));
  assert.equal(first.valid, true);
  assert.equal(third.valid, true);
  const merged = mergeCampaignImports(first.campaigns, third.campaigns);
  assert.equal(merged.campaigns.length, 2);
  assert.equal(merged.updated, 2);
  assert.equal(merged.campaigns[0].firstPartySpend, 42000);
  assert.equal(merged.campaigns[0].thirdPartySpend, 45500);
});

test("alpha corrected fixture updates scope and invalid fixture is rejected", async () => {
  const corrected = validateCampaignCsv(await fixture("03-corrected-first-party.csv"));
  const invalid = validateCampaignCsv(await fixture("04-invalid-negative-spend.csv"));
  assert.equal(corrected.valid, true);
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(" "), /spend and pacing cannot be negative/i);
});
