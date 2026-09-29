import test from "node:test";
import assert from "node:assert/strict";
import { buildMappingReview, exportMappingReviewCsv } from "../lib/mapping-review.js";
import { parseCsv } from "../lib/importer.js";

test("classifies direct, aliased, and unmapped report columns", () => {
  const review = buildMappingReview(["client", "Campaign Name", "Media Cost", "Custom Dimension", ""]);
  assert.deepEqual({ supported: review.supported, aliased: review.aliased, unmapped: review.unmapped }, { supported: 3, aliased: 2, unmapped: 1 });
  assert.deepEqual(review.columns.map(column => column.status), ["Direct", "Aliased", "Aliased", "Unmapped"]);
});

test("exports mapping review with source and canonical fields", () => {
  const review = buildMappingReview(["Advertiser Name", "Custom, Field"]);
  const [headers, aliased, unmapped] = parseCsv(exportMappingReviewCsv(review, "weekly,report.csv", "2026-09-28T12:00:00Z"));
  assert.equal(aliased[headers.indexOf("canonical_field")], "client");
  assert.equal(unmapped[headers.indexOf("mapping_status")], "Unmapped");
  assert.equal(aliased[headers.indexOf("file_name")], "weekly,report.csv");
});
