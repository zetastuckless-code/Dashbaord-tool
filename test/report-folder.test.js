import test from "node:test";
import assert from "node:assert/strict";
import { findNewReports, noteReport, openReportAt } from "../lib/report-folder.js";

const now = Date.parse("2026-10-24T12:00:00Z");
const DAY = 86_400_000;
const file = (name, age = 1) => ({ kind: "file", name, getFile: async () => ({ name, lastModified: now - age * DAY }) });
const dir = (name, children) => ({
  kind: "directory", name,
  values: async function* () { yield* children; },
  getDirectoryHandle: async child => children.find(entry => entry.kind === "directory" && entry.name === child),
  getFileHandle: async child => children.find(entry => entry.kind === "file" && entry.name === child)
});

// A shared SharePoint tree: reports sit in "Report" folders, next to IOs and creative.
const tree = dir("Indy", [
  dir("Crispin - Houston", [dir("Natures Sunshine Products Inc", [dir("2026", [
    dir("Report", [dir("Q3 Display", [dir("October", [file("Zeta Global Nature's Sunshine Display Report 10.23.26.xlsx"), file("~$Zeta Global Nature's Sunshine Display Report 10.23.26.xlsx")])]), file("Old report.xlsx", 90)]),
    dir("IO", [file("Media plan.xlsx")])
  ])])]),
  file("Team notes.csv")
]);

test("finds new reports in report folders, skipping lock files, old files, and other spreadsheets", async () => {
  const { files } = await findNewReports(tree, {}, { now });
  assert.deepEqual(files.map(entry => entry.key), ["Crispin - Houston/Natures Sunshine Products Inc/2026/Report/Q3 Display/October/Zeta Global Nature's Sunshine Display Report 10.23.26.xlsx"]);
  const everything = await findNewReports(tree, {}, { now, onlyReportFolders: false });
  assert.equal(everything.files.length, 3);
});

test("takes a file in once, again only when it changes, and forgets records after the retention period", async () => {
  const [found] = (await findNewReports(tree, {}, { now })).files;
  let ledger = noteReport({}, found.key, found.lastModified, "imported", { now });
  assert.equal((await findNewReports(tree, ledger, { now })).files.length, 0);
  ledger = noteReport(ledger, "old/file.xlsx", 1, "imported", { now: now - 200 * DAY });
  ledger = noteReport(ledger, "new/file.xlsx", 1, "imported", { now });
  assert.equal(ledger["old/file.xlsx"], undefined);
  assert.ok(await openReportAt(tree, found.key));
});
