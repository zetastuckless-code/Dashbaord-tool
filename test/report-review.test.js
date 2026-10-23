import test from "node:test";
import assert from "node:assert/strict";
import { importClients, pendingImportReviews } from "../lib/report-review.js";

const record = (id, fileName, status, keys = []) => ({ id, fileName, status, campaignKeys: keys });

test("warnings, partial imports and failures wait for review until marked", () => {
  const history = [record("3", "c.xlsx", "Imported"), record("2", "b.xlsx", "Imported with warnings"), record("1", "a.csv", "Rejected"), record("0", "d.csv", "Duplicate")];
  assert.deepEqual(pendingImportReviews(history).map(item => item.id), ["2", "1"]);
  assert.deepEqual(pendingImportReviews(history, ["2"]).map(item => item.id), ["1"]);
});

test("a file that later imported cleanly no longer needs review", () => {
  const history = [record("2", "a.csv", "Imported"), record("1", "a.csv", "Rejected")];
  assert.deepEqual(pendingImportReviews(history), []);
});

test("import clients come back in their dashboard spelling", () => {
  assert.deepEqual(importClients(record("1", "a", "Imported", ["rent a center::rac q4::zeta global", "unknown co::x::y"]), ["Rent A Center"]), ["Rent A Center", "unknown co"]);
});
