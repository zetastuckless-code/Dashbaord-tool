import test from "node:test";
import assert from "node:assert/strict";
import { filterUploads, groupUploads, listAllUploads, summarizeUploads } from "../lib/data-sources.js";

const upload = (kind, fileName, uploadedAt, extra = {}) => ({ id: `${kind}|${fileName}`, kind, fileName, source: "Zeta Global", date: "2026-10-06", uploadedAt, ...extra });
const record = (client, name, uploads, extra = {}) => ({ client, name, source: "Zeta Global", uploads, ...extra });

const campaigns = [
  record("Acme", "Spring — YouTube", [upload("report", "acme-oct.xlsx", "2026-10-20T15:00:00Z")]),
  record("Acme", "Spring — YouTube (Video Views)", [upload("report", "acme-oct.xlsx", "2026-10-20T15:00:00Z")]),
  record("Acme", "Fall — Display", [upload("daily", "acme-daily.csv", "2026-10-21T09:00:00Z")]),
  record("Zed", "Brand — Display", [upload("report", "zed.xlsx", "2026-10-19T09:00:00Z")]),
  record("Old", "Gone — Display", [upload("report", "old.xlsx", "2026-01-01T00:00:00Z")], { archivedAt: "2026-02-01T00:00:00Z" })
];

test("lists every upload across clients, newest first, with its client", () => {
  const docs = listAllUploads({ campaigns });
  assert.deepEqual(docs.map(doc => [doc.client, doc.fileName]), [["Acme", "acme-daily.csv"], ["Acme", "acme-oct.xlsx"], ["Zed", "zed.xlsx"]]);
  assert.deepEqual(docs.find(doc => doc.fileName === "acme-oct.xlsx").campaigns, ["Spring"]);
  assert.equal(docs.find(doc => doc.fileName === "acme-oct.xlsx").lines, 2);
});

test("falls back to the import history for uploads saved before times were tracked", () => {
  const legacy = [record("Acme", "Spring — YouTube", [], { sourceFile: "legacy.xlsx", dataAsOf: "2026-09-30" })];
  const history = [{ fileName: "legacy.xlsx", status: "Rejected", importedAt: "2026-09-01T00:00:00Z" }, { fileName: "Legacy.xlsx", status: "Imported", importedAt: "2026-10-01T12:00:00Z" }];
  assert.equal(listAllUploads({ campaigns: legacy, importHistory: history })[0].uploadedAt, "2026-10-01T12:00:00Z");
  assert.equal(listAllUploads({ campaigns: legacy })[0].uploadedAt, null);
});

test("includes insertion orders with the time they were applied", () => {
  const rows = [record("Acme", "Spring — YouTube", [])];
  const totals = { "acme::spring": { orders: [{ order: "O-1", budget: 5000, startDate: "2026-01-01", endDate: "2026-12-31", fileName: "io.pdf", appliedAt: "2026-10-05T10:00:00Z", placements: [] }] } };
  const [doc] = listAllUploads({ campaigns: rows, totals });
  assert.deepEqual([doc.kind, doc.fileName, doc.uploadedAt, doc.client], ["io-order", "io.pdf", "2026-10-05T10:00:00Z", "Acme"]);
});

test("filters by client, type and search text", () => {
  const docs = listAllUploads({ campaigns });
  assert.equal(filterUploads(docs, { client: "Zed" }).length, 1);
  assert.deepEqual(filterUploads(docs, { kind: "daily" }).map(doc => doc.fileName), ["acme-daily.csv"]);
  assert.deepEqual(filterUploads(docs, { query: "SPRING" }).map(doc => doc.fileName), ["acme-oct.xlsx"]);
  assert.equal(filterUploads(docs, { kind: "io" }).length, 0);
});

test("groups by client or by campaign, listing a shared upload under each campaign it fed", () => {
  const shared = [record("Acme", "Spring — YouTube", [upload("report", "both.xlsx", "2026-10-20T15:00:00Z")]), record("Acme", "Fall — Display", [upload("report", "both.xlsx", "2026-10-20T15:00:00Z")])];
  const docs = listAllUploads({ campaigns: shared });
  assert.deepEqual(groupUploads(docs, "client").map(group => [group.label, group.docs.length]), [["Acme", 1]]);
  assert.deepEqual(groupUploads(docs, "campaign").map(group => [group.label, group.docs.length]), [["Fall", 1], ["Spring", 1]]);
});

test("summarizes the uploads", () => {
  const summary = summarizeUploads(listAllUploads({ campaigns }));
  assert.deepEqual(summary, { total: 3, clients: 2, latest: "2026-10-21T09:00:00Z", undated: 0 });
});
