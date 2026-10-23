import test from "node:test";
import assert from "node:assert/strict";
import { buildReportingPack, isPackDue, lastDueDate } from "../lib/reporting-pack.js";

test("a pack is due from its weekday, every other week, or its day of the month", () => {
  // 2026-10-23 is a Friday.
  assert.equal(lastDueDate({ cadence: "weekly", weekday: 1 }, "2026-10-23"), "2026-10-19");
  assert.equal(lastDueDate({ cadence: "weekly", weekday: 5 }, "2026-10-23"), "2026-10-23");
  assert.equal(lastDueDate({ cadence: "biweekly", weekday: 1, since: "2026-10-12" }, "2026-10-23"), "2026-10-12");
  assert.equal(lastDueDate({ cadence: "biweekly", weekday: 1, since: "2026-10-12" }, "2026-10-27"), "2026-10-26");
  assert.equal(lastDueDate({ cadence: "monthly", monthDay: 1 }, "2026-10-23"), "2026-10-01");
  assert.equal(lastDueDate({ cadence: "monthly", monthDay: 25 }, "2026-10-23"), "2026-09-25");
  assert.equal(lastDueDate({ cadence: "off" }, "2026-10-23"), null);
  assert.equal(isPackDue({ cadence: "weekly", weekday: 1, lastWritten: "2026-10-19" }, "2026-10-23"), false);
  assert.equal(isPackDue({ cadence: "weekly", weekday: 1, lastWritten: "2026-10-12" }, "2026-10-23"), true);
});

test("a pack has campaign, line, weekly, and monthly sections, and the daily CSV", () => {
  const snaps = [{ date: "2026-09-30", source: "Zeta Global", spend: 1000, impressions: 100000, clicks: 100 }, { date: "2026-10-06", source: "Zeta Global", spend: 1700, impressions: 170000, clicks: 170 }, { date: "2026-10-20", source: "Zeta Global", spend: 3100, impressions: 310000, clicks: 300 }];
  const record = { client: "Carter", name: "Carter 2H 2026 — AA Audio", kpi: "CTR", target: "0.10%", startDate: "2026-07-01", endDate: "2026-12-31", dataAsOf: "2026-10-20", spend: 3100, budget: 10000, impressions: 310000, clicks: 300, performanceSnapshots: snaps, thirdPartyDelivery: { DSP: { "2026-10-19": { impressions: 10000, clicks: 9, spend: 220 } } } };
  const pack = buildReportingPack({ client: "Carter", records: [record], today: "2026-10-23", alerts: [{ title: "Underpacing", detail: "70% pacing", campaign: record }], todos: [{ text: "Send recap", due: "2026-10-24" }] });
  assert.match(pack.markdown, /^# Reporting pack · Carter · 2026-10-23/);
  assert.match(pack.markdown, /## Campaigns\n\| Campaign \| Lines/);
  assert.match(pack.markdown, /\| Carter 2H 2026 \| AA Audio \| \$3,100/);
  assert.match(pack.markdown, /Last 7 days: 2026-10-14 to 2026-10-20/);
  assert.match(pack.markdown, /- Underpacing · AA Audio: 70% pacing/);
  assert.match(pack.markdown, /- Send recap \(due 2026-10-24\)/);
  assert.equal(pack.dailyRows, 1);
  assert.match(pack.csv, /2026-10-19,Carter 2H 2026,AA Audio,DSP,10000,9,220/);
});
