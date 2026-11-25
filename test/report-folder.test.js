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

test("Downloads: only new files at the top, from after it was connected", async () => {
  const downloads = dir("Downloads", [file("Carter_blood_care_daily_report_9.csv", 0.1), file("Old export.csv", 2), dir("Taxes", [file("2025.xlsx", 0.1)])]);
  const { files } = await findNewReports(downloads, {}, { now, onlyReportFolders: false, lookbackDays: 3, maxDepth: 0, since: now - DAY });
  assert.deepEqual(files.map(entry => entry.key), ["Carter_blood_care_daily_report_9.csv"]);
});

test("a subfolder or file that can't be opened is skipped, and the rest of the folder still comes in", async () => {
  const notFound = () => { throw Object.assign(new Error("A requested file or directory could not be found at the time an operation was processed."), { name: "NotFoundError" }); };
  const gone = { kind: "directory", name: "Moved Report", values: async function* () { notFound(); } };
  const offline = { kind: "file", name: "Online-only report.csv", getFile: async () => notFound() };
  const shared = dir("Shared", [gone, dir("Report", [offline, file("Weekly report.csv")])]);
  const scan = await findNewReports(shared, {}, { now });
  assert.deepEqual(scan.files.map(entry => entry.key), ["Report/Weekly report.csv"]);
  assert.deepEqual(scan.skipped.map(entry => entry.path), ["Moved Report", "Report/Online-only report.csv"]);
  // The watched folder itself failing to open is still an error.
  await assert.rejects(findNewReports({ kind: "directory", name: "Gone", values: async function* () { notFound(); } }, {}, { now }));
});

test("a file OneDrive never hands over is skipped after the time limit, and the newest file date is reported", async () => {
  const { withTimeout } = await import("../lib/report-folder.js");
  const stuck = { kind: "file", name: "Stuck report.csv", getFile: () => new Promise(() => {}) };
  const scan = await findNewReports(dir("DCM", [stuck, file("Daily report.csv", 2), file("Older report.csv", 5)]), {}, { now, onlyReportFolders: false, fileTimeoutMs: 20 });
  assert.deepEqual(scan.files.map(entry => entry.name), ["Older report.csv", "Daily report.csv"]);
  assert.deepEqual(scan.skipped.map(entry => entry.path), ["Stuck report.csv"]);
  assert.equal(scan.newest, now - 2 * DAY);
  await assert.rejects(withTimeout(new Promise(() => {}), 10, "too slow"), { name: "TimeoutError", message: "too slow" });
  assert.equal(await withTimeout(Promise.resolve(5), 10, "too slow"), 5);
});

test("a listing that breaks part-way keeps what it read; one that gives up nothing is still an error", async () => {
  const notFound = () => Object.assign(new Error("A requested file or directory could not be found at the time an operation was processed."), { name: "NotFoundError" });
  const breaksAfter = (name, children) => ({ kind: "directory", name, values: async function* () { yield* children; throw notFound(); } });
  const scan = await findNewReports(breaksAfter("OneDrive-SharedLibraries-ZetaGlobal", [dir("Indy Report", [file("Weekly report.csv")])]), {}, { now });
  assert.deepEqual(scan.files.map(entry => entry.key), ["Indy Report/Weekly report.csv"]);
  assert.equal(scan.skipped.length, 1);
  assert.match(scan.skipped[0].path, /the rest of/);
  await assert.rejects(findNewReports(breaksAfter("Empty", []), {}, { now }), { name: "NotFoundError" });
});
