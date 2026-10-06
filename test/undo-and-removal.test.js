import test from "node:test";
import assert from "node:assert/strict";
import { applyImportRollback, clearImportRollback, createImportRollback, createRemovalUndo, MAX_UNDO_ENTRIES, readImportRollback, readUndoStack, undoLabel, writeImportRollback } from "../lib/import-rollback.js";
import { removeDailySource, removeGroupRecords, removeLineItem, removeRecordAt, removeSnapshot } from "../lib/campaign-removal.js";
import { applyDailyDelivery, detectDailyDelivery, parseDailyDelivery } from "../lib/daily-delivery-import.js";

const memoryStorage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key), data }; };
const importPoint = (name, spend = 1) => createImportRollback({ campaigns: [{ name, spend }], importHistory: [], fileName: `${name}.csv`, fingerprint: `fp-${name}`, rowCount: 1, campaignKeys: [] });

test("undo steps back through several imports, newest first", () => {
  const storage = memoryStorage();
  ["one", "two", "three"].forEach(name => writeImportRollback(storage, importPoint(name)));
  assert.deepEqual(readUndoStack(storage).map(entry => entry.fileName), ["three.csv", "two.csv", "one.csv"]);
  assert.equal(readImportRollback(storage).fileName, "three.csv");
  clearImportRollback(storage);
  assert.equal(readImportRollback(storage).fileName, "two.csv");
  clearImportRollback(storage);
  clearImportRollback(storage);
  assert.equal(readImportRollback(storage), null);
  assert.equal(storage.data.has("northstar-undo-stack"), false);
});

test("the undo stack is bounded and survives corrupt or legacy storage", () => {
  const storage = memoryStorage();
  for (let index = 0; index < MAX_UNDO_ENTRIES + 3; index += 1) writeImportRollback(storage, importPoint(`n${index}`));
  assert.equal(readUndoStack(storage).length, MAX_UNDO_ENTRIES);
  assert.equal(readUndoStack(storage)[0].fileName, `n${MAX_UNDO_ENTRIES + 2}.csv`);
  storage.setItem("northstar-undo-stack", "{broken");
  assert.deepEqual(readUndoStack(storage), []);
  storage.setItem("northstar-last-import-rollback", JSON.stringify(importPoint("legacy")));
  assert.equal(readImportRollback(storage).fileName, "legacy.csv");
});

test("a removal restore point brings back campaigns and totals without adding a Reverted import record", () => {
  const point = createRemovalUndo({ campaigns: [{ name: "Keep" }], importHistory: [{ id: "h", status: "Imported" }], campaignTotals: { "a::b": { budget: 5 } }, label: "removing the Acme campaign" }, "2026-10-06T10:00:00Z");
  assert.equal(undoLabel(point), "removing the Acme campaign");
  assert.equal(undoLabel(importPoint("x")), "the import of x.csv");
  const restored = applyImportRollback(point);
  assert.deepEqual(restored.campaigns, [{ name: "Keep" }]);
  assert.deepEqual(restored.campaignTotals, { "a::b": { budget: 5 } });
  assert.equal(restored.importHistory.length, 1);
  assert.equal(restored.importHistory[0].status, "Imported");
});

test("removes a record, a whole campaign, or a single line item", () => {
  const records = [{ client: "A", name: "C — One" }, { client: "A", name: "C — Two" }, { client: "B", name: "Other" }];
  assert.deepEqual(removeRecordAt(records, 1).map(record => record.name), ["C — One", "Other"]);
  assert.deepEqual(removeGroupRecords(records, "a::c").map(record => record.name), ["Other"]);
  const record = { lineItems: [{ id: "1" }, { id: "2" }], lineItemFlights: [{ id: "2" }, { id: "3" }] };
  const result = removeLineItem(record, "2");
  assert.deepEqual([result.lineItems.map(item => item.id), result.lineItemFlights.map(item => item.id)], [["1"], ["3"]]);
});

const withHistory = {
  client: "A", name: "B", source: "Zeta Global", kpi: "CTR", value: "0.5%", spend: 300, firstPartySpend: 300, impressions: 3000, clicks: 15, dataAsOf: "2026-09-03",
  performanceSnapshots: [
    { date: "2026-09-01", source: "Zeta Global", spend: 100, impressions: 1000, clicks: 4 },
    { date: "2026-09-02", source: "Zeta Global", spend: 200, impressions: 2000, clicks: 9 },
    { date: "2026-09-03", source: "Zeta Global", spend: 300, impressions: 3000, clicks: 15 }
  ]
};

test("removing the newest report reverts the campaign to the previous report", () => {
  const next = removeSnapshot(withHistory, "2026-09-03", "Zeta Global");
  assert.equal(next.performanceSnapshots.length, 2);
  assert.deepEqual([next.spend, next.impressions, next.clicks, next.dataAsOf], [200, 2000, 9, "2026-09-02"]);
  assert.equal(next.value, "0.45%");
  assert.equal(withHistory.spend, 300);
});

test("removing an older report keeps current values and clears them when none remain", () => {
  const older = removeSnapshot(withHistory, "2026-09-01", "Zeta Global");
  assert.equal(older.spend, 300);
  assert.equal(older.performanceSnapshots.length, 2);
  const single = { ...withHistory, spend: 100, firstPartySpend: 100, impressions: 1000, clicks: 4, dataAsOf: "2026-09-01", performanceSnapshots: [withHistory.performanceSnapshots[0]] };
  const cleared = removeSnapshot(single, "2026-09-01", "Zeta Global");
  assert.deepEqual([cleared.spend, cleared.impressions, cleared.firstPartySpend, cleared.dataAsOf], [0, null, null, null]);
  assert.equal(removeSnapshot(withHistory, "2030-01-01", "Zeta Global"), withHistory);
});

test("removing a daily-delivery source drops its days, snapshots, and third-party spend", () => {
  const rows = [["Date", "Campaign", "Impressions", "Media Cost"], ["2026-09-01", "B", "1000", "5"]];
  const parsed = parseDailyDelivery(rows, detectDailyDelivery(rows), { source: "CM360" });
  const campaign = applyDailyDelivery([{ client: "A", name: "B", source: "Zeta Global", spend: 1, budget: 2 }], parsed).campaigns[0];
  assert.equal(campaign.thirdPartySpend, 5);
  const removed = removeDailySource(campaign, "CM360");
  assert.deepEqual([removed.thirdPartySpend, Object.keys(removed.dailyDelivery), removed.performanceSnapshots.length], [null, [], 0]);
  assert.equal(removed.sources.includes("CM360"), false);
});
