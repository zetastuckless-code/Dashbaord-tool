import test from "node:test";
import assert from "node:assert/strict";
import { campaignStatusRow, logItems, statusDue, statusPrompt, statusRowTsv, statusWeeks } from "../lib/status-doc.js";

test("on a Monday, this week is the Monday to Sunday just ended", () => {
  assert.deepEqual(statusWeeks("2026-10-26"), { thisWeek: { from: "2026-10-19", to: "2026-10-25" }, lastWeek: { from: "2026-10-12", to: "2026-10-18" } });
  assert.deepEqual(statusWeeks("2026-10-28").thisWeek, { from: "2026-10-19", to: "2026-10-25" });
});

test("the brief log keeps each item once and remembers when it was checked off", () => {
  let log = logItems([], [{ client: "McMaster", text: "Send recap", source: "Email", tag: "urgent" }], "2026-10-20");
  log = logItems(log, [{ client: "McMaster", text: "Send recap.", done: true }, { client: "McMaster", text: "Paused the weak line" }], "2026-10-22");
  assert.equal(log.length, 2);
  assert.deepEqual([log[0].date, log[0].done, log[0].doneOn], ["2026-10-20", true, "2026-10-22"]);
});

test("a campaign's status row: the week's KPI against last week, pacing, the call, and notes from the briefs", () => {
  const snapshots = [{ date: "2026-10-11", source: "Zeta", spend: 7000, impressions: 7_000_000, clicks: 7000 }, { date: "2026-10-18", source: "Zeta", spend: 14000, impressions: 14_000_000, clicks: 14000 }, { date: "2026-10-25", source: "Zeta", spend: 21000, impressions: 21_000_000, clicks: 23800 }];
  const record = { client: "McMaster", name: "McMaster Q4 — Display", kpi: "CTR", target: "0.1%", startDate: "2026-10-05", endDate: "2026-11-01", budget: 28000, spend: 21000, dataAsOf: "2026-10-25", performanceSnapshots: snapshots, source: "Zeta" };
  const log = [
    { date: "2026-10-21", client: "McMaster", text: "Shifted budget to the retargeting line", source: "Slack", done: false },
    { date: "2026-10-22", client: "McMaster", text: "Sent the biweekly report to Kelley", source: "Email from Kelley", done: true, doneOn: "2026-10-22" },
    { date: "2026-10-01", client: "McMaster", text: "Old item", source: "Email" }
  ];
  const row = campaignStatusRow({ group: { key: "mcmaster::q4", client: "McMaster", name: "McMaster Q4", status: "live", records: [record] }, log, today: "2026-10-26" });
  assert.equal(row.lastWeek, "CTR 0.1%");
  assert.equal(row.thisWeek, "CTR 0.14%");
  assert.equal(row.change, "CTR up 40% (better)");
  assert.equal(row.track, "On Track");
  assert.match(row.performance, /Pacing 95%/);
  assert.match(row.performance, /meeting the 0.1% goal/);
  assert.match(row.performance, /Shifted budget/);
  assert.match(row.notes, /Sent the biweekly report/);
  assert.doesNotMatch(row.notes, /Old item/);
  const tsv = statusRowTsv(row);
  assert.equal(tsv.split("\t").length, 7);
  assert.match(tsv, /\t10\/26\/2026\t/);
  assert.match(statusPrompt([row], "2026-10-26"), /McMaster Q4 \(McMaster\)/);
});

test("the status doc is due Monday and Tuesday until the week is marked done", () => {
  assert.equal(statusDue({}, "2026-10-26"), true);
  assert.equal(statusDue({ "2026-10-25": { doneAt: "x" } }, "2026-10-26"), false);
  assert.equal(statusDue({}, "2026-10-28"), false);
});
