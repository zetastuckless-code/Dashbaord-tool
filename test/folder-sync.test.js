import test from "node:test";
import assert from "node:assert/strict";
import { addLedgerEntries, isCandidateReportName, isProcessed, ledgerKey, listReportFiles, planAutoImport, readLedger, resolveFileHandle, reviewItems, writeLedger } from "../lib/folder-sync.js";
import { detectDailyDelivery, parseDailyDelivery } from "../lib/daily-delivery-import.js";

const memoryStorage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
const campaign = { client: "Alpha", name: "Alpha Retargeting", campaignId: "900001", spend: 1, budget: 10, source: "DSP" };
const dailyReport = rows => ({ kind: "daily-delivery", parsed: parseDailyDelivery(rows, detectDailyDelivery(rows), { source: "CM360" }) });

test("accepts only csv and xlsx reports and skips Excel lock and hidden files", () => {
  assert.equal(isCandidateReportName("report.XLSX"), true);
  assert.equal(isCandidateReportName("daily.csv"), true);
  assert.equal(isCandidateReportName("~$report.xlsx"), false);
  assert.equal(isCandidateReportName(".hidden.csv"), false);
  assert.equal(isCandidateReportName("notes.pdf"), false);
});

test("ledger identifies a file version by path, size, and modified time and stays bounded", () => {
  const key = ledgerKey("inbox/a.csv", { size: 10, lastModified: 5 });
  assert.equal(key, "inbox/a.csv|10|5");
  let ledger = addLedgerEntries([], [{ key, status: "imported" }]);
  assert.equal(isProcessed(ledger, key), true);
  assert.equal(isProcessed(ledger, "other"), false);
  ledger = addLedgerEntries(ledger, [{ key, status: "review" }]);
  assert.equal(ledger.length, 1);
  assert.equal(isProcessed(ledger, key), false);
  assert.equal(reviewItems(ledger).length, 1);
  const many = addLedgerEntries([], Array.from({ length: 5 }, (_, index) => ({ key: String(index), status: "imported" })), 3);
  assert.deepEqual(many.map(entry => entry.key), ["0", "1", "2"]);
});

test("ledger persists through storage and ignores corrupt data", () => {
  const storage = memoryStorage();
  assert.deepEqual(readLedger(storage), []);
  writeLedger(storage, [{ key: "a", status: "imported" }]);
  assert.equal(readLedger(storage).length, 1);
  storage.setItem("northstar-folder-ledger", "{oops");
  assert.deepEqual(readLedger(storage), []);
});

test("auto-applies a daily report only when every campaign matches", () => {
  const rows = [["Date", "Campaign", "Campaign ID", "Impressions", "Media Cost"], ["2026-09-01", "Alpha Retargeting", "900001", "1000", "5"]];
  const plan = planAutoImport(dailyReport(rows), [campaign]);
  assert.equal(plan.status, "apply");
  assert.equal(plan.campaigns[0].thirdPartySpend, 5);
  const mixed = [...rows, ["2026-09-01", "Mystery", "777", "10", "1"]];
  const review = planAutoImport(dailyReport(mixed), [campaign]);
  assert.equal(review.status, "review");
  assert.match(review.reason, /needs linking: Mystery/);
  assert.equal(planAutoImport(dailyReport(rows), []).status, "review");
});

test("sends unusable reports to rejected and valid summaries to apply", () => {
  assert.equal(planAutoImport({ kind: "daily-delivery", parsed: { valid: false, errors: ["bad date"] } }, []).status, "rejected");
  const header = "client,campaign,spend,budget,pacing,kpi,kpi_value,kpi_target,source";
  assert.equal(planAutoImport({ csvText: `${header}\nA,B,x,2,3,CTR,1%,1%,DSP` }, []).status, "rejected");
  const plan = planAutoImport({ csvText: `${header}\nA,B,1,2,50,CTR,1%,1%,DSP` }, []);
  assert.equal(plan.status, "apply");
  assert.equal(plan.campaigns.length, 1);
});

function fakeDirectory(tree) {
  return {
    kind: "directory",
    async *entries() { for (const [name, value] of Object.entries(tree)) yield [name, value.kind ? value : fakeDirectory(value)]; },
    async getDirectoryHandle(name) { return fakeDirectory(tree[name]); },
    async getFileHandle(name) { return tree[name]; }
  };
}

test("lists candidate files up to two folders deep and resolves them by path", async () => {
  const file = { kind: "file" };
  const root = fakeDirectory({ "a.csv": file, "notes.txt": file, "~$a.xlsx": file, inbox: { "b.xlsx": file, deep: { "c.csv": file, deeper: { "d.csv": file, deepest: { "e.csv": file } } } } });
  const found = await listReportFiles(root);
  assert.deepEqual(found.map(item => item.path).sort(), ["a.csv", "inbox/b.xlsx", "inbox/deep/c.csv"]);
  assert.equal(await resolveFileHandle(root, "inbox/b.xlsx"), file);
});
