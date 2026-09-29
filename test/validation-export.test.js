import test from "node:test";
import assert from "node:assert/strict";
import { exportValidationIssuesCsv } from "../lib/validation-export.js";
import { parseCsv } from "../lib/importer.js";

test("exports actionable validation issues with file and severity context", () => {
  const [headers, first, second] = parseCsv(exportValidationIssuesCsv("weekly,report.csv", ["Row 2: spend is invalid.", "Missing campaign_id."], "warning", "2026-09-28T12:00:00Z"));
  assert.equal(first[headers.indexOf("file_name")], "weekly,report.csv");
  assert.equal(first[headers.indexOf("severity")], "warning");
  assert.equal(second[headers.indexOf("issue")], "Missing campaign_id.");
});

test("exports headers only when there are no issues", () => {
  assert.equal(parseCsv(exportValidationIssuesCsv("report.csv", [])).length, 1);
});
