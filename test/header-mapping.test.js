import test from "node:test";
import assert from "node:assert/strict";
import { canonicalizeHeader, describeHeaderMappings, normalizeHeaderText } from "../lib/header-mapping.js";

test("normalizes punctuation and spacing in report headers", () => {
  assert.equal(normalizeHeaderText("  Pacing (%) "), "pacing");
  assert.equal(normalizeHeaderText("First Party Spend"), "first_party_spend");
});

test("maps common platform report aliases to canonical fields", () => {
  assert.equal(canonicalizeHeader("Advertiser Name"), "client");
  assert.equal(canonicalizeHeader("Campaign Name"), "campaign");
  assert.equal(canonicalizeHeader("Media Cost"), "spend");
  assert.equal(canonicalizeHeader("Goal"), "kpi_target");
  assert.equal(canonicalizeHeader("DSP Spend"), "first_party_spend");
});

test("maps platform campaign identifiers to the stable campaign ID", () => {
  assert.equal(canonicalizeHeader("CM360 Campaign ID"), "campaign_id");
  assert.equal(canonicalizeHeader("External Campaign ID"), "campaign_id");
});

test("maps campaign owner aliases", () => {
  assert.equal(canonicalizeHeader("Campaign Manager"), "owner");
  assert.equal(canonicalizeHeader("Media Buyer"), "owner");
});

test("maps campaign flight date aliases", () => {
  assert.equal(canonicalizeHeader("Flight Start Date"), "start_date");
  assert.equal(canonicalizeHeader("Campaign End"), "end_date");
});

test("maps report freshness date aliases", () => {
  assert.equal(canonicalizeHeader("Report Date"), "data_as_of");
  assert.equal(canonicalizeHeader("Data Through"), "data_as_of");
});

test("maps common raw performance metric aliases", () => {
  assert.equal(canonicalizeHeader("Imps"), "impressions");
  assert.equal(canonicalizeHeader("Completed Views"), "video_completions");
  assert.equal(canonicalizeHeader("Conversion Revenue"), "revenue");
});

test("preserves unknown normalized headers and describes only aliases", () => {
  assert.equal(canonicalizeHeader("Creative Size"), "creative_size");
  assert.deepEqual(describeHeaderMappings(["Client", "Media Cost", "Creative Size"]), [{ source: "Media Cost", normalized: "media_cost", canonical: "spend" }]);
});


test("maps campaign channel aliases", () => {
  assert.equal(canonicalizeHeader("Media Type"), "channel");
  assert.equal(canonicalizeHeader("Campaign Channel"), "channel");
});
