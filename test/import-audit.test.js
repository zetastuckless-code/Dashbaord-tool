import test from "node:test";
import assert from "node:assert/strict";
import { filterImportAudit, summarizeImportAudit } from "../lib/import-audit.js";

const history = [
  { fileName: "daily.csv", status: "Imported", fingerprint: "aaa" },
  { fileName: "weekly.xlsx", status: "Imported with warnings", warnings: ["Missing campaign ID"] },
  { fileName: "broken.csv", status: "Rejected", errors: ["Invalid spend"] },
  { fileName: "old.csv", status: "Superseded", fingerprint: "bbb" },
  { fileName: "undo.csv", status: "Reverted" }
];

test("filters import audit by operational status groups", () => {
  assert.equal(filterImportAudit(history, { status: "successful" }).length, 2);
  assert.deepEqual(filterImportAudit(history, { status: "attention" }).map(record => record.fileName), ["broken.csv"]);
  assert.equal(filterImportAudit(history, { status: "historical" }).length, 2);
});

test("searches file, status, fingerprint, warning, and error context", () => {
  assert.equal(filterImportAudit(history, { query: "missing campaign" })[0].fileName, "weekly.xlsx");
  assert.equal(filterImportAudit(history, { query: "aaa" })[0].fileName, "daily.csv");
  assert.equal(filterImportAudit(history, { status: "attention", query: "spend" })[0].fileName, "broken.csv");
});

test("summarizes retained audit activity", () => {
  assert.deepEqual(summarizeImportAudit(history), { total: 5, successful: 2, attention: 1, historical: 2 });
});
