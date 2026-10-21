import test from "node:test";
import assert from "node:assert/strict";
import { addImportRecord, createImportRecord, exportImportHistoryCsv, fingerprintText, hasSuccessfulFingerprint, readImportHistory, writeImportHistory } from "../lib/import-history.js";
import { parseCsv } from "../lib/importer.js";

test("fingerprintText returns a stable SHA-256 fingerprint", async () => {
  const fingerprint = await fingerprintText("campaign report");
  assert.equal(fingerprint, "7a48c800b986afebb505adbaa5a4364ad042c2c4123c0d091da5f90b590bd8fd");
});

test("imported and superseded fingerprints are duplicates but rejected attempts can be retried", () => {
  const history = [
    createImportRecord({ fileName: "valid.csv", fingerprint: "abc", status: "Imported" }),
    createImportRecord({ fileName: "old.csv", fingerprint: "old", status: "Superseded" }),
    createImportRecord({ fileName: "invalid.csv", fingerprint: "def", status: "Rejected" })
  ];
  assert.equal(hasSuccessfulFingerprint(history, "abc"), true);
  assert.equal(hasSuccessfulFingerprint(history, "old"), true);
  assert.equal(hasSuccessfulFingerprint(history, "def"), false);
});

test("a corrected import supersedes the prior import for the same sorted scope", () => {
  const original = createImportRecord({ fileName: "daily-v1.csv", fingerprint: "one", status: "Imported", campaignKeys: ["apex::2::cm360", "apex::1::cm360"], importedAt: "2026-09-24T10:00:00Z" });
  const correction = createImportRecord({ fileName: "daily-v2.csv", fingerprint: "two", status: "Imported", campaignKeys: ["apex::1::cm360", "apex::2::cm360"], importedAt: "2026-09-24T11:00:00Z" });
  const history = addImportRecord([original], correction);
  assert.equal(history[0].status, "Imported");
  assert.equal(history[1].status, "Superseded");
  assert.equal(history[1].supersededBy, correction.id);
});

test("an import with a different campaign scope leaves prior imports active", () => {
  const original = createImportRecord({ fileName: "apex.csv", fingerprint: "one", status: "Imported", campaignKeys: ["apex::1::cm360"] });
  const other = createImportRecord({ fileName: "nova.csv", fingerprint: "two", status: "Imported", campaignKeys: ["nova::1::cm360"] });
  const history = addImportRecord([original], other);
  assert.equal(history[1].status, "Imported");
  assert.equal(history[1].supersededBy, undefined);
});

test("imports with warnings participate in duplicate detection and supersession", () => {
  const original = createImportRecord({ fileName: "old.csv", fingerprint: "old", status: "Imported with warnings", warnings: ["Missing dates"], campaignKeys: ["apex::1::cm360"] });
  assert.equal(hasSuccessfulFingerprint([original], "old"), true);
  const correction = createImportRecord({ fileName: "new.csv", fingerprint: "new", status: "Imported", campaignKeys: ["apex::1::cm360"] });
  const history = addImportRecord([original], correction);
  assert.equal(history[1].status, "Superseded");
  assert.equal(history[1].warnings[0], "Missing dates");
});

test("history remains newest-first and is limited to ten entries", () => {
  let history = [];
  for (let index = 0; index < 12; index += 1) {
    history = addImportRecord(history, createImportRecord({ fileName: `${index}.csv`, fingerprint: `${index}`.repeat(8), status: "Imported", importedAt: `2026-09-24T00:00:${String(index).padStart(2, "0")}Z` }));
  }
  assert.equal(history.length, 10);
  assert.equal(history[0].fileName, "11.csv");
  assert.equal(history[9].fileName, "2.csv");
});

test("history storage gracefully handles corrupt values", () => {
  const values = new Map([["northstar-import-history", "not-json"]]);
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(readImportHistory(storage), []);
  const history = [createImportRecord({ fileName: "report.csv", fingerprint: "12345678", status: "Imported" })];
  writeImportHistory(storage, history);
  assert.deepEqual(readImportHistory(storage), history);
});

test("exports the complete retained import audit trail", () => {
  const record = { id: "import-1", importedAt: "2026-09-28T12:00:00Z", fileName: "weekly,report.csv", status: "Imported with warnings", rowCount: 2, fingerprint: "abc123", campaignKeys: ["apex::cmp-1::dsp"], warnings: ["Missing flight dates."], errors: [], supersededBy: "import-2" };
  const [headers, row] = parseCsv(exportImportHistoryCsv([record], "2026-09-28T13:00:00Z"));
  assert.equal(row[headers.indexOf("file_name")], "weekly,report.csv");
  assert.equal(row[headers.indexOf("warnings")], "Missing flight dates.");
  assert.equal(row[headers.indexOf("superseded_by")], "import-2");
  assert.equal(row[headers.indexOf("exported_at")], "2026-09-28T13:00:00Z");
});
