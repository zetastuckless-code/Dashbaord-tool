import test from "node:test";
import assert from "node:assert/strict";
import { applyImportRollback, clearImportRollback, createImportRollback, readImportRollback, writeImportRollback } from "../lib/import-rollback.js";

test("captures and restores campaign and import-history snapshots", () => {
  const campaigns = [{ name: "Before", spend: 10 }];
  const history = [{ id: "older", status: "Imported" }];
  const rollback = createImportRollback({ campaigns, importHistory: history, fileName: "daily.csv", fingerprint: "abcdef123456", rowCount: 1, campaignKeys: ["apex::1::cm360"] }, "2026-09-28T10:00:00Z");
  campaigns[0].spend = 99;
  history[0].status = "Superseded";
  const restored = applyImportRollback(rollback, "2026-09-28T11:00:00Z");
  assert.equal(restored.campaigns[0].spend, 10);
  assert.equal(restored.importHistory[0].status, "Reverted");
  assert.equal(restored.importHistory[1].status, "Imported");
});

test("persists, reads, clears, and rejects malformed rollback state", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const rollback = createImportRollback({ campaigns: [], importHistory: [], fileName: "daily.csv", fingerprint: "abc", rowCount: 0, campaignKeys: [] });
  writeImportRollback(storage, rollback);
  assert.equal(readImportRollback(storage).fileName, "daily.csv");
  clearImportRollback(storage);
  assert.equal(readImportRollback(storage), null);
  values.set("northstar-last-import-rollback", "not json");
  assert.equal(readImportRollback(storage), null);
});
