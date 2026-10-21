import test from "node:test";
import assert from "node:assert/strict";
import { listClientDocuments, removeClientDocument, revertHistoryForFile } from "../lib/client-documents.js";
import { makeUpload, mergeUploads } from "../lib/uploads.js";
import { mergeCampaignImports } from "../lib/import-merge.js";
import { setCampaignTotals } from "../lib/campaign-totals.js";
import { applyDailyDelivery } from "../lib/daily-delivery-import.js";
import { applyLineItems } from "../lib/line-item-import.js";
import { hasSuccessfulFingerprint } from "../lib/import-history.js";

const line = (name, spend, dataAsOf, fileName) => ({ client: "Acme", name, short: "A", className: "x", source: "Zeta Global", spend, budget: 10_000, impressions: spend * 100, clicks: spend / 10, kpi: "CTR", value: "1%", target: "Target 1%", dataAsOf, sourceFile: fileName, uploads: [makeUpload({ kind: "report", fileName, source: "Zeta Global", date: dataAsOf, uploadedAt: `${dataAsOf}T12:00:00Z` })] });
const week1 = [line("Drive — Flight 1", 1000, "2026-09-14", "week1.xlsx"), line("Drive — Flight 2", 2000, "2026-09-14", "week1.xlsx")];
const week2 = [line("Drive — Flight 1", 1800, "2026-09-21", "week2.xlsx")];
const other = { ...line("Other", 50, "2026-09-14", "other.xlsx"), client: "Zed" };
const base = mergeCampaignImports(mergeCampaignImports([other], week1).campaigns, week2).campaigns;

test("a client's documents list each uploaded file once, newest first, for that client only", () => {
  const docs = listClientDocuments({ campaigns: base, client: "Acme" });
  assert.deepEqual(docs.map(doc => [doc.fileName, doc.kind, doc.lines]), [["week2.xlsx", "report", 1], ["week1.xlsx", "report", 2]]);
  assert.deepEqual(docs[1].campaigns, ["Drive"]);
  assert.equal(listClientDocuments({ campaigns: base, client: "Zed" }).length, 1);
});

test("removing the newest report rolls its lines back to the previous report", () => {
  const doc = listClientDocuments({ campaigns: base, client: "Acme" })[0];
  const result = removeClientDocument({ campaigns: base, client: "Acme", document: doc });
  const flight1 = result.campaigns.find(record => record.name === "Drive — Flight 1");
  assert.equal(flight1.spend, 1000);
  assert.equal(flight1.dataAsOf, "2026-09-14");
  assert.deepEqual(listClientDocuments({ campaigns: result.campaigns, client: "Acme" }).map(item => item.fileName), ["week1.xlsx"]);
  assert.equal(result.campaigns.filter(record => record.client === "Zed").length, 1);
});

test("removing the only report that brought a line in removes the line, and an older report's removal keeps later numbers", () => {
  const week1Doc = listClientDocuments({ campaigns: base, client: "Acme" }).find(doc => doc.fileName === "week1.xlsx");
  const result = removeClientDocument({ campaigns: base, client: "Acme", document: week1Doc });
  // Flight 1 was updated by week 2, so it stays at week 2's numbers; Flight 2 only came from week 1, so it is gone.
  assert.deepEqual(result.campaigns.filter(record => record.client === "Acme").map(record => [record.name, record.spend]), [["Drive — Flight 1", 1800]]);
  assert.equal(result.removedLines, 1);
});

test("a campaign set up first stays as an empty campaign when its report is removed", () => {
  const shell = { client: "Acme", name: "Drive", source: "Manual", spend: 0, budget: 10_000, kpi: "CTR", value: "—", target: "Target 1%", createdAt: "2026-09-01T00:00:00Z" };
  const merged = mergeCampaignImports([shell], [{ ...week1[0], name: "Drive" }]).campaigns;
  const doc = listClientDocuments({ campaigns: merged, client: "Acme" })[0];
  const [record] = removeClientDocument({ campaigns: merged, client: "Acme", document: doc }).campaigns;
  assert.deepEqual([record.name, record.source, record.spend, record.dataAsOf, record.value], ["Drive", "Manual", 0, null, "—"]);
  assert.equal(listClientDocuments({ campaigns: [record], client: "Acme" }).length, 0);
});

test("removing a report lets the same file be uploaded again", () => {
  const history = [{ fileName: "week2.xlsx", fingerprint: "abc", status: "Imported" }, { fileName: "week1.xlsx", fingerprint: "def", status: "Superseded" }];
  const doc = listClientDocuments({ campaigns: base, client: "Acme" })[0];
  const result = removeClientDocument({ campaigns: base, importHistory: history, client: "Acme", document: doc });
  assert.equal(hasSuccessfulFingerprint(result.importHistory, "abc"), false);
  assert.equal(hasSuccessfulFingerprint(result.importHistory, "def"), true);
  assert.equal(revertHistoryForFile(history, "week1.xlsx")[1].status, "Reverted");
});

test("uploading the same file again, or a corrected report for the same date, replaces the earlier entry", () => {
  const first = [makeUpload({ kind: "report", fileName: "a.xlsx", source: "Zeta", date: "2026-09-14" })];
  const second = mergeUploads(first.map(item => ({ ...item, created: true })), [makeUpload({ kind: "report", fileName: "a-corrected.xlsx", source: "Zeta", date: "2026-09-14" })]);
  assert.deepEqual(second.map(item => [item.fileName, item.created]), [["a-corrected.xlsx", true]]);
  const days = mergeUploads([makeUpload({ kind: "daily", fileName: "d1.csv", source: "CM360", days: ["2026-09-01", "2026-09-02"] })], [makeUpload({ kind: "daily", fileName: "d2.csv", source: "CM360", days: ["2026-09-02", "2026-09-03"] })]);
  assert.deepEqual(days.map(item => [item.fileName, item.days]), [["d1.csv", ["2026-09-01"]], ["d2.csv", ["2026-09-02", "2026-09-03"]]]);
});

test("daily delivery uploads list by file, and removing one takes only its days", () => {
  const campaign = { client: "Acme", name: "Drive", short: "A", className: "x", source: "Zeta Global", spend: 100, budget: 1000, kpi: "CTR", value: "1%", target: "Target 1%", startDate: "2026-09-01", endDate: "2026-12-01" };
  const parsed = (source, dates) => ({ source, campaigns: [{ key: "k", sourceCampaignId: "k", sourceCampaignName: "Drive", days: dates.length }], records: dates.map(date => ({ date, sourceCampaignId: "k", sourceCampaignName: "Drive", impressions: 1000, clicks: 10, spend: 5 })) });
  const first = applyDailyDelivery([campaign], parsed("CM360", ["2026-09-01", "2026-09-02"]), { "CM360::k": 0 }, { fileName: "cm-1.csv" }).campaigns;
  const second = applyDailyDelivery(first, parsed("CM360", ["2026-09-03"]), { "CM360::k": 0 }, { fileName: "cm-2.csv" }).campaigns;
  assert.deepEqual(listClientDocuments({ campaigns: second, client: "Acme" }).map(doc => [doc.fileName, doc.kind]).sort(), [["cm-1.csv", "daily"], ["cm-2.csv", "daily"]]);
  const doc = listClientDocuments({ campaigns: second, client: "Acme" }).find(item => item.fileName === "cm-2.csv");
  const removed = removeClientDocument({ campaigns: second, client: "Acme", document: doc }).campaigns[0];
  assert.deepEqual(Object.keys(removed.dailyDelivery.CM360), ["2026-09-01", "2026-09-02"]);
  assert.equal(removed.thirdPartySpend, 10);
  const none = removeClientDocument({ campaigns: removed ? [removed] : [], client: "Acme", document: listClientDocuments({ campaigns: [removed], client: "Acme" })[0] }).campaigns[0];
  assert.deepEqual([Object.keys(none.dailyDelivery), none.uploads], [[], []]);
});

test("DSP line-item uploads list by file and removing one takes only its line items", () => {
  const campaign = { client: "Acme", name: "Drive", short: "A", className: "x", source: "Zeta Global", spend: 100, budget: 1000, kpi: "CTR", value: "1%", target: "Target 1%", lineItems: [{ id: "keep", name: "Keep" }] };
  const parsed = { campaigns: [{ key: "k", sourceName: "Drive", lineItems: [{ id: "L1", name: "One" }, { id: "L2", name: "Two" }] }] };
  const applied = applyLineItems([campaign], parsed, { k: 0 }, { fileName: "dsp.csv" });
  const campaigns = applied.campaigns;
  assert.equal(campaigns[0].lineItems.length, 3);
  const doc = listClientDocuments({ campaigns, client: "Acme" }).find(item => item.kind === "line-items");
  assert.equal(doc.fileName, "dsp.csv");
  assert.deepEqual(removeClientDocument({ campaigns, client: "Acme", document: doc }).campaigns[0].lineItems.map(item => item.id), ["keep"]);
});

test("insertion orders list by order and removing one clears its totals and file reference", () => {
  const record = { client: "Acme", name: "Drive — Flight 1", source: "Zeta Global", spend: 10, budget: 100, kpi: "CTR", value: "1%", target: "Target 1%", ioFileName: "io-1.pdf" };
  const key = "acme::drive";
  const totals = setCampaignTotals({}, key, { orderNumber: "O-1", revision: "R1", budget: 500, startDate: "2026-09-01", endDate: "2026-12-31", lineItems: [] }, "io-1.pdf");
  const docs = listClientDocuments({ campaigns: [record], totals, client: "Acme" });
  const order = docs.find(doc => doc.kind === "io-order");
  assert.deepEqual([order.fileName, order.order, order.budget], ["io-1.pdf", "O-1-R1", 500]);
  const result = removeClientDocument({ campaigns: [record], totals, client: "Acme", document: order });
  assert.deepEqual([Object.keys(result.totals), result.campaigns[0].ioFileName], [[], null]);
});

test("insertion-order flights are removed without touching flights added by hand", () => {
  const record = { client: "Acme", name: "Drive", source: "Zeta Global", spend: 10, budget: 100, kpi: "CTR", value: "1%", target: "Target 1%", ioFileName: "io-2.pdf", ioOrder: "O-2", lineItemFlights: [{ id: "A", source: "io" }, { id: "B", name: "Manual flight" }] };
  const doc = listClientDocuments({ campaigns: [record], client: "Acme" }).find(item => item.kind === "io-flights");
  assert.equal(doc.lines, 1);
  const [after] = removeClientDocument({ campaigns: [record], client: "Acme", document: doc }).campaigns;
  assert.deepEqual([after.lineItemFlights.map(flight => flight.id), after.ioFileName], [["B"], null]);
});

test("lines imported before uploads were tracked are listed by the file they came from", () => {
  const legacy = { client: "Acme", name: "Old", source: "Zeta Global", spend: 5, kpi: "CTR", value: "1%", target: "Target 1%", sourceFile: "old.xlsx", dataAsOf: "2026-08-01" };
  const docs = listClientDocuments({ campaigns: [legacy], client: "Acme" });
  assert.deepEqual([docs[0].fileName, docs[0].legacy], ["old.xlsx", true]);
  assert.equal(removeClientDocument({ campaigns: [legacy], client: "Acme", document: docs[0] }).campaigns.length, 0);
});

test("a removed report does not come back as an old upload, even for a line that keeps its place", () => {
  const record = { ...line("Solo", 100, "2026-09-14", "solo.xlsx"), uploads: [{ ...makeUpload({ kind: "report", fileName: "solo.xlsx", source: "Zeta Global", date: "2026-09-14" }), created: false }] };
  const [doc] = listClientDocuments({ campaigns: [record], client: "Acme" });
  const result = removeClientDocument({ campaigns: [record], client: "Acme", document: doc });
  assert.equal(result.campaigns.length, 1);
  assert.equal(listClientDocuments({ campaigns: result.campaigns, client: "Acme" }).length, 0);
});
