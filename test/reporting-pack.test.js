import test from "node:test";
import assert from "node:assert/strict";
import { buildReportingPack, comparisonWindows, isPackDue, lastDueDate } from "../lib/reporting-pack.js";

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
  assert.match(pack.markdown, /This period: 2026-10-14 to 2026-10-20\. Period before: 2026-10-07 to 2026-10-13/);
  assert.match(pack.markdown, /- Underpacing · AA Audio: 70% pacing/);
  assert.match(pack.markdown, /- Send recap \(due 2026-10-24\)/);
  assert.equal(pack.dailyRows, 1);
  assert.match(pack.csv, /2026-10-19,Carter 2H 2026,AA Audio,DSP,10000,9,220/);
});

test("comparison windows: last 7 or 14 days, last full Monday–Sunday week, last full month", () => {
  assert.deepEqual(comparisonWindows("14", "2026-10-22"), { current: ["2026-10-09", "2026-10-22"], prior: ["2026-09-25", "2026-10-08"], label: "Last 14 days against the 14 before" });
  // Oct 22, 2026 is a Thursday; the last full week ended Sunday Oct 18.
  assert.deepEqual(comparisonWindows("week", "2026-10-22").current, ["2026-10-12", "2026-10-18"]);
  assert.deepEqual(comparisonWindows("week", "2026-10-18").current, ["2026-10-12", "2026-10-18"]);
  assert.deepEqual(comparisonWindows("month", "2026-10-22"), { current: ["2026-09-01", "2026-09-30"], prior: ["2026-08-01", "2026-08-31"], label: "Last full month against the month before" });
  assert.deepEqual(comparisonWindows("month", "2026-10-31").current, ["2026-10-01", "2026-10-31"]);
});

test("DCM rows become line, placement, creative, and size breakdowns, with data checks", () => {
  const rows = [];
  for (let day = 1; day <= 14; day += 1) {
    const date = `2026-10-${String(day).padStart(2, "0")}`;
    if (day === 9) continue;
    rows.push({ date, source: "CM360", line: "NSP 2026 — Display", campaign: "NSP 2026", placement: "Zeta_Display_Conversion_Lookalikes_300x250", creative: "NSP_MarineGlo_300x250", impressions: 1000, clicks: 2, spend: 4, revenue: day > 11 ? 1 : 10, conversions: 0 });
    rows.push({ date, source: "CM360", line: "NSP 2026 — Display", campaign: "NSP 2026", placement: "Zeta_Display_Conversion_Retargeting_728x90", creative: "NSP_ISB_728x90", impressions: 500, clicks: 1, spend: 2, revenue: 5, conversions: 1 });
  }
  const record = { client: "NSP", name: "NSP 2026 — Display", kpi: "ROAS", startDate: "2026-01-01", endDate: "2026-12-31", dataAsOf: "2026-10-10", spend: 100, impressions: 10000, clicks: 20 };
  const pack = buildReportingPack({ client: "NSP", records: [record], today: "2026-10-15", schedule: { window: "7" }, rawRows: rows });
  assert.match(pack.markdown, /This period: 2026-10-08 to 2026-10-14/);
  assert.match(pack.markdown, /### By placement\n\| Placement/);
  assert.match(pack.markdown, /\| NSP_MarineGlo \| 6,000 \| 7,000 \|/);
  assert.match(pack.markdown, /\| 300x250 \|/);
  assert.match(pack.markdown, /- DCM: no rows on 2026-10-09 inside this period\./);
  assert.match(pack.markdown, /Revenue on the last days looks low/);
  assert.match(pack.csv, /^date,campaign,line,source,placement_or_line_item,creative,/);
  assert.match(pack.csv, /2026-10-01,NSP 2026,Display,DCM,Zeta_Display_Conversion_Lookalikes_300x250,NSP_MarineGlo_300x250,1000,2,4,0,10/);
});
