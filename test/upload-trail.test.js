import test from "node:test";
import assert from "node:assert/strict";
import { addTrailEntry, filterTrail, groupTrailByDay, readUploadTrail, seedUploadTrail, writeUploadTrail } from "../lib/upload-trail.js";

const storage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };

test("keeps every upload, newest first, and saves it", () => {
  let trail = [];
  trail = addTrailEntry(trail, { fileName: "a.csv", clients: ["Client A"], campaigns: ["Spring"], detail: "4 lines", at: "2026-10-28T14:00:00Z" });
  trail = addTrailEntry(trail, { fileName: "a.csv", clients: ["Client A"], campaigns: ["Spring"], detail: "4 lines", at: "2026-10-29T14:00:00Z" });
  assert.deepEqual(trail.map(entry => entry.at), ["2026-10-29T14:00:00Z", "2026-10-28T14:00:00Z"]);
  const store = storage();
  writeUploadTrail(store, trail);
  assert.equal(readUploadTrail(store).length, 2);
});

test("groups the trail by day and counts what didn't import", () => {
  let trail = [];
  trail = addTrailEntry(trail, { fileName: "io.pdf", kind: "io", at: "2026-10-28T15:00:00" });
  trail = addTrailEntry(trail, { fileName: "dcm.csv", kind: "dcm", at: "2026-10-29T09:00:00" });
  trail = addTrailEntry(trail, { fileName: "dcm.csv", kind: "dcm", status: "Duplicate", at: "2026-10-29T10:00:00" });
  const days = groupTrailByDay(trail);
  assert.deepEqual(days.map(day => [day.day, day.imported, day.duplicates, day.failed]), [["2026-10-29", 1, 1, 0], ["2026-10-28", 1, 0, 0]]);
  assert.deepEqual(days[0].entries.map(entry => entry.status), ["Duplicate", "Imported"]);
});

test("filters by client, type, and text", () => {
  let trail = [];
  trail = addTrailEntry(trail, { fileName: "billing.xlsx", kind: "billing", clients: ["Client A"] });
  trail = addTrailEntry(trail, { fileName: "report.csv", kind: "report", clients: ["Client B"], campaigns: ["Holiday"] });
  assert.deepEqual(filterTrail(trail, { client: "Client A" }).map(entry => entry.fileName), ["billing.xlsx"]);
  assert.deepEqual(filterTrail(trail, { kind: "report" }).map(entry => entry.fileName), ["report.csv"]);
  assert.deepEqual(filterTrail(trail, { query: "holiday" }).map(entry => entry.fileName), ["report.csv"]);
});

test("seeds an empty trail once from saved uploads and import history", () => {
  const docs = [{ fileName: "io.pdf", kind: "io-order", client: "Client A", campaigns: ["Spring"], uploadedAt: "2026-10-20T10:00:00Z" }, { fileName: "old.csv", kind: "report", client: "Client A", campaigns: [], uploadedAt: null }];
  const importHistory = [{ fileName: "dcm.csv", status: "Imported", importedAt: "2026-10-21T10:00:00Z", campaignKeys: ["client a::x::dsp::cm360"] }, { fileName: "io.pdf", status: "Imported", importedAt: "2026-10-20T10:00:30Z", campaignKeys: [] }];
  const seeded = seedUploadTrail([], { docs, importHistory });
  assert.deepEqual(seeded.map(entry => [entry.fileName, entry.kind, entry.backfilled]), [["dcm.csv", "dcm", true], ["io.pdf", "io", true]]);
  const existing = addTrailEntry([], { fileName: "new.csv" });
  assert.equal(seedUploadTrail(existing, { docs, importHistory }), existing);
});

test("a client's file history adds DCM files, billing files and folder imports the uploads list doesn't show", async () => {
  const { clientFileHistory } = await import("../lib/upload-trail.js");
  let trail = [];
  trail = addTrailEntry(trail, { fileName: "10.27_Report.xlsx", kind: "report", clients: ["McMaster"], at: "2026-10-27T11:53:00Z" });
  trail = addTrailEntry(trail, { fileName: "2253817_McMaster_DCM.zip", kind: "dcm", clients: ["McMaster"], detail: "9 lines · from the watched folder", at: "2026-11-01T08:00:00Z" });
  trail = addTrailEntry(trail, { fileName: "2253817_McMaster_DCM.zip", kind: "dcm", status: "Duplicate", clients: ["McMaster"], at: "2026-11-01T09:00:00Z" });
  trail = addTrailEntry(trail, { fileName: "McMaster_Billing_September.xlsx", kind: "billing", clients: ["McMaster"], at: "2026-10-20T10:00:00Z" });
  trail = addTrailEntry(trail, { fileName: "other.csv", kind: "report", clients: ["Carter"], at: "2026-10-28T10:00:00Z" });
  const campaigns = [{ client: "McMaster", name: "McMaster — NY", thirdPartyFiles: ["2253817_McMaster_DCM.zip", "old_dcm_0915.csv"] }];
  const history = clientFileHistory(trail, "McMaster", { docs: [{ fileName: "10.27_Report.xlsx" }], campaigns });
  assert.equal(history[0].status, "Imported");
  assert.deepEqual(history.map(item => [item.fileName, item.kind, item.times, item.automatic]), [
    ["2253817_McMaster_DCM.zip", "dcm", 2, true],
    ["McMaster_Billing_September.xlsx", "billing", 1, false],
    ["old_dcm_0915.csv", "delivery", 1, false]
  ]);
});
