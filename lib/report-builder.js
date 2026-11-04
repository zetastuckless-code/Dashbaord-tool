// The report builder: each line's numbers day by day, rolled up over any date range by day, week, month, quarter, or
// the whole range, and grouped by client, campaign, or line. Days come from the line's DSP and DCM days where it has
// them, else its report totals spread evenly over the days between reports (marked as estimated).
import { campaignGroupName } from "./campaign-groups.js";

const DAY_MS = 86_400_000;
export const REPORT_METRICS = Object.freeze(["spend", "impressions", "clicks", "conversions", "revenue", "videoStarts", "videoCompletions"]);
const iso = time => new Date(time).toISOString().slice(0, 10);
const dayMs = day => Date.parse(`${day}T00:00:00Z`);
export const addDays = (day, count) => iso(dayMs(day) + count * DAY_MS);
const daysFrom = (from, to) => { const list = []; for (let day = from; day <= to; day = addDays(day, 1)) list.push(day); return list; };
const zero = () => Object.fromEntries(REPORT_METRICS.map(metric => [metric, 0]));
const lineLabel = record => String(record.name || "").includes(" — ") ? String(record.name).split(" — ").slice(1).join(" — ") : String(record.name || "");

export const REPORT_RANGES = Object.freeze([
  { id: "flight", label: "Whole flight" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7", label: "Past 7 days" },
  { id: "14", label: "Past 14 days" },
  { id: "30", label: "Past 30 days" },
  { id: "90", label: "Past 90 days" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "this-quarter", label: "This quarter" },
  { id: "last-quarter", label: "Last quarter" },
  { id: "ytd", label: "Year to date" },
  { id: "custom", label: "Custom dates" }
]);
export const REPORT_GRAINS = Object.freeze([
  { id: "total", label: "Whole range" },
  { id: "day", label: "Daily" },
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
  { id: "quarter", label: "Quarterly" }
]);

/** Start and end days for a range; "flight" runs from the earliest line start to the latest end (or today). */
export function resolveReportRange(id, { today, custom = {}, flight = {} } = {}) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  const monthStart = (y, m) => iso(Date.UTC(y, m, 1));
  const monthEnd = (y, m) => iso(Date.UTC(y, m + 1, 0));
  const quarter = Math.floor(month / 3) * 3;
  const yesterday = addDays(today, -1);
  const ranges = {
    yesterday: [yesterday, yesterday],
    "this-month": [monthStart(year, month), today],
    "last-month": [monthStart(year, month - 1), monthEnd(year, month - 1)],
    "this-quarter": [monthStart(year, quarter), today],
    "last-quarter": [monthStart(year, quarter - 3), monthEnd(year, quarter - 1)],
    ytd: [`${year}-01-01`, today],
    flight: [flight.start || addDays(today, -29), flight.end && flight.end < today ? flight.end : today]
  };
  if (id === "custom") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(custom.start || "") || !/^\d{4}-\d{2}-\d{2}$/.test(custom.end || "")) return { start: addDays(today, -6), end: today, error: "Choose a start and end date." };
    if (custom.start > custom.end) return { start: custom.end, end: custom.start, error: "" };
    return { start: custom.start, end: custom.end, error: "" };
  }
  if (/^\d+$/.test(String(id))) return { start: addDays(yesterday, -(Number(id) - 1)), end: yesterday, error: "" };
  const [start, end] = ranges[id] || ranges.flight;
  return { start, end, error: "" };
}

/** The bucket a day falls in: the day, the Monday its week starts, its month, its quarter, or the whole range. */
export function bucketOf(day, grain) {
  if (grain === "day") return day;
  if (grain === "week") { const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7; return addDays(day, -weekday); }
  if (grain === "month") return day.slice(0, 7);
  if (grain === "quarter") return `${day.slice(0, 4)}-Q${Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1}`;
  return "total";
}

export function bucketLabel(bucket, grain) {
  const short = day => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  if (grain === "day") return short(bucket);
  if (grain === "week") return `Week of ${short(bucket)}`;
  if (grain === "month") return new Date(`${bucket}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  if (grain === "quarter") return bucket.replace("-", " ");
  return "Total";
}

/**
 * One line's numbers for each day it has any, as { date: { ...metrics, estimated } }. DSP days come first (they carry
 * spend), then DCM days; days neither covers take the line's report totals spread evenly between report dates.
 * Spend is billable (delivered value at the line's rate, where it has one) or media (what the DSP or report says).
 */
export function lineDays(record, { spendView = "billable" } = {}) {
  const days = {};
  const rate = record.deliveredRate?.rate > 0 ? record.deliveredRate : null;
  const billable = metrics => rate ? (rate.type === "cpv" ? (metrics.videoCompletions || 0) * rate.rate : (metrics.impressions || 0) * rate.rate / 1000) : null;
  for (const source of ["DSP", "CM360"]) {
    for (const [date, metrics] of Object.entries(record.thirdPartyDelivery?.[source] || {})) {
      if (days[date]) continue;
      const day = { ...zero(), estimated: false, source };
      for (const metric of REPORT_METRICS) if (Number.isFinite(metrics[metric])) day[metric] = metrics[metric];
      // DCM days carry no cost; a billable view prices them at the line's rate.
      const value = spendView === "billable" ? billable(day) : null;
      if (value !== null) day.spend = value;
      days[date] = day;
    }
  }
  // Report totals: the change between two dated totals is spread evenly over the days between them.
  const snapshots = [...new Map((record.performanceSnapshots || []).filter(snapshot => !snapshot.dcm).map(snapshot => [snapshot.date, snapshot])).values()].sort((a, b) => a.date.localeCompare(b.date));
  const start = record.deliveryStart || record.startDate;
  const points = start && snapshots.length && addDays(start, -1) < snapshots[0].date ? [{ date: addDays(start, -1), ...zero() }, ...snapshots] : snapshots;
  for (let index = 1; index < points.length; index += 1) {
    const before = points[index - 1];
    const after = points[index];
    const span = daysFrom(addDays(before.date, 1), after.date);
    if (!span.length) continue;
    for (const date of span) {
      if (days[date]) continue;
      const day = { ...zero(), estimated: span.length > 1, source: "report" };
      for (const metric of REPORT_METRICS) day[metric] = Math.max(0, (Number(after[metric]) || 0) - (Number(before[metric]) || 0)) / span.length;
      const value = spendView === "billable" ? billable(day) : null;
      if (value !== null) day.spend = value;
      days[date] = day;
    }
  }
  return days;
}

/** CTR, CPM, CPC, CPA, ROAS, and VCR worked out from summed components. */
export function withRates(totals) {
  const share = (top, bottom, scale = 1) => bottom > 0 ? top / bottom * scale : null;
  return { ...totals, ctr: share(totals.clicks, totals.impressions, 100), cpm: share(totals.spend, totals.impressions, 1000), cpc: share(totals.spend, totals.clicks), cpa: share(totals.spend, totals.conversions), roas: share(totals.revenue, totals.spend), vcr: share(totals.videoCompletions, totals.videoStarts, 100) };
}

const groupOf = (record, by) => by === "client" ? record.client : by === "campaign" ? `${record.client} · ${campaignGroupName(record)}` : by === "line" ? `${campaignGroupName(record)} · ${lineLabel(record)}` : "All";

/**
 * The report: one row per group and bucket in the range, with totals for each group and overall. Rows note how many of
 * their days were estimated from report totals, so a reader knows which numbers are exact.
 */
export function buildReport(records, { start, end, grain = "total", groupBy = "campaign", spendView = "billable" } = {}) {
  const cells = new Map();
  const groups = new Map();
  const buckets = new Set();
  const allDays = new Set();
  const allEstimated = new Set();
  let first = null;
  let last = null;
  for (const record of records) {
    const group = groupOf(record, groupBy);
    for (const [date, day] of Object.entries(lineDays(record, { spendView }))) {
      if (date < start || date > end) continue;
      allDays.add(date);
      if (day.estimated) allEstimated.add(date);
      first = !first || date < first ? date : first;
      last = !last || date > last ? date : last;
      const bucket = bucketOf(date, grain);
      buckets.add(bucket);
      const key = `${group}\u0000${bucket}`;
      const cell = cells.get(key) || { group, bucket, ...zero(), days: new Set(), estimatedDays: new Set() };
      for (const metric of REPORT_METRICS) cell[metric] += day[metric] || 0;
      cell.days.add(date);
      if (day.estimated) cell.estimatedDays.add(date);
      cells.set(key, cell);
      const total = groups.get(group) || { group, ...zero(), days: new Set(), estimatedDays: new Set() };
      for (const metric of REPORT_METRICS) total[metric] += day[metric] || 0;
      total.days.add(date);
      if (day.estimated) total.estimatedDays.add(date);
      groups.set(group, total);
    }
  }
  const finish = cell => withRates({ ...cell, days: cell.days.size, estimatedDays: cell.estimatedDays.size });
  const groupTotals = [...groups.values()].map(finish).sort((a, b) => b.spend - a.spend || b.impressions - a.impressions || a.group.localeCompare(b.group));
  const order = new Map(groupTotals.map((total, index) => [total.group, index]));
  const sortedBuckets = [...buckets].sort();
  const rows = [...cells.values()].map(finish).sort((a, b) => a.bucket.localeCompare(b.bucket) || order.get(a.group) - order.get(b.group));
  const overall = finish(groupTotals.reduce((sum, total) => { for (const metric of REPORT_METRICS) sum[metric] += total[metric]; return sum; }, { group: "Total", ...zero(), days: new Set(), estimatedDays: new Set() }));
  overall.days = allDays.size;
  overall.estimatedDays = allEstimated.size;
  return { start, end, grain, groupBy, buckets: sortedBuckets, rows, groups: groupTotals, total: overall, dataStart: first, dataEnd: last };
}

/** A pivot: groups down, buckets across, one metric in the cells, with row and column totals. */
export function pivotReport(report, metric) {
  const rated = ["ctr", "cpm", "cpc", "cpa", "roas", "vcr"].includes(metric);
  const cell = (group, bucket) => report.rows.find(row => row.group === group && row.bucket === bucket);
  const columnTotal = bucket => {
    const summed = report.rows.filter(row => row.bucket === bucket).reduce((sum, row) => { for (const name of REPORT_METRICS) sum[name] += row[name]; return sum; }, zero());
    return withRates(summed)[metric];
  };
  return {
    metric,
    columns: report.buckets,
    rows: report.groups.map(total => ({ group: total.group, values: report.buckets.map(bucket => cell(total.group, bucket)?.[metric] ?? null), total: total[metric] })),
    totals: report.buckets.map(columnTotal),
    grand: report.total[metric],
    rated
  };
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Days to optimize around: each weekday's average day, and the best and worst single days by a metric (days with too
 * little delivery to judge are left out). Lower is better for cost metrics (CPA, CPC, CPM); higher for the rest.
 */
export function bestDays(records, { start, end, metric = "ctr", spendView = "billable", minImpressions = 1000, top = 5 } = {}) {
  const byDate = new Map();
  for (const record of records) {
    for (const [date, day] of Object.entries(lineDays(record, { spendView }))) {
      if (date < start || date > end) continue;
      const total = byDate.get(date) || zero();
      for (const name of REPORT_METRICS) total[name] += day[name] || 0;
      byDate.set(date, total);
    }
  }
  const lowerIsBetter = ["cpa", "cpc", "cpm"].includes(metric);
  const days = [...byDate].map(([date, totals]) => ({ date, ...withRates(totals) })).filter(day => day.impressions >= minImpressions && Number.isFinite(day[metric]));
  const sorted = [...days].sort((a, b) => lowerIsBetter ? a[metric] - b[metric] : b[metric] - a[metric]);
  const weekdays = WEEKDAYS.map((name, index) => {
    // Days too small to judge would swing a weekday's average, so they're left out here too.
    const mine = [...byDate].filter(([date, totals]) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7 === index && totals.impressions >= minImpressions).map(([, totals]) => totals);
    const summed = mine.reduce((sum, totals) => { for (const metricName of REPORT_METRICS) sum[metricName] += totals[metricName]; return sum; }, zero());
    const average = Object.fromEntries(REPORT_METRICS.map(metricName => [metricName, mine.length ? summed[metricName] / mine.length : 0]));
    return { weekday: name, days: mine.length, ...withRates(average), [metric]: withRates(summed)[metric] };
  });
  const judged = weekdays.filter(day => day.days && Number.isFinite(day[metric]));
  const best = judged.length ? [...judged].sort((a, b) => lowerIsBetter ? a[metric] - b[metric] : b[metric] - a[metric])[0].weekday : null;
  const worst = judged.length > 1 ? [...judged].sort((a, b) => lowerIsBetter ? b[metric] - a[metric] : a[metric] - b[metric])[0].weekday : null;
  return { metric, lowerIsBetter, weekdays, best, worst, topDays: sorted.slice(0, top), bottomDays: sorted.slice(-top).reverse(), judgedDays: days.length };
}

/**
 * Spend against plan for each day in a range. `units` are the budgets pacing is measured on (an IO's budget and flight,
 * or a line's own): each spreads its budget evenly over its flight's days. Cumulative figures count from the range's
 * first day, so a later range compares what was spent in it with what the plan called for in it.
 */
export function pacingSeries(records, units, { start, end, spendView = "billable" } = {}) {
  const actual = new Map();
  for (const record of records) {
    for (const [date, day] of Object.entries(lineDays(record, { spendView }))) {
      if (date < start || date > end) continue;
      actual.set(date, (actual.get(date) || 0) + (day.spend || 0));
    }
  }
  const lastData = [...actual.keys()].sort().at(-1) || null;
  let runningActual = 0;
  let runningPlan = 0;
  return daysFrom(start, end).map(date => {
    const planned = units.reduce((sum, unit) => {
      if (!(unit.budget > 0) || !unit.startDate || !unit.endDate || date < unit.startDate || date > unit.endDate) return sum;
      return sum + unit.budget / (Math.round((dayMs(unit.endDate) - dayMs(unit.startDate)) / DAY_MS) + 1);
    }, 0);
    // Days after the newest data have no actual yet; they still count toward the plan.
    const spent = lastData && date <= lastData ? actual.get(date) || 0 : null;
    if (spent !== null) runningActual += spent;
    runningPlan += planned;
    return { date, actual: spent, planned, cumulativeActual: spent === null ? null : runningActual, cumulativePlanned: runningPlan };
  });
}
