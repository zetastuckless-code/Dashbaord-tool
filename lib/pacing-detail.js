import { budgetUnits, unitsBudget } from "./campaign-totals.js";
import { calculatePortfolioPacing, calculateSpendPacing } from "./spend-pacing.js";
import { dailyActualSeries, dailyBaseline, daysBetween, requiredDailyFromToday } from "./daily-pacing.js";
import { campaignGroupName } from "./campaign-groups.js";
import { selectedSnapshots } from "./portfolio-trend.js";

const DAY_MS = 86_400_000;
const isoDay = ms => new Date(ms).toISOString().slice(0, 10);

/**
 * Spend per day across campaigns. Each campaign's days come from its own dated reports, so a campaign that first
 * appears in a late report adds nothing for the days before it (its whole spend to date is not one day's spend).
 * Days between two reports are averaged and marked `estimated`; days no report covers count as no spend.
 */
export function dailySpendAcrossCampaigns(campaigns, { spendView = "billing", maxDays = 400 } = {}) {
  const byDate = new Map();
  let withHistory = 0;
  for (const campaign of campaigns) {
    const points = selectedSnapshots(campaign, spendView).filter(snapshot => Number.isFinite(snapshot.spend)).map(snapshot => ({ date: snapshot.date, actual: snapshot.spend }));
    const series = dailyActualSeries(points, { maxDays: Infinity });
    if (!series.length) continue;
    withHistory += 1;
    for (const day of series) {
      const entry = byDate.get(day.date) || { date: day.date, actual: 0, estimated: false };
      entry.actual += day.actual;
      entry.estimated = entry.estimated || day.estimated;
      byDate.set(day.date, entry);
    }
  }
  const dates = [...byDate.keys()].sort();
  const days = [];
  if (dates.length) {
    for (let ms = Date.parse(`${dates[0]}T00:00:00Z`); ms <= Date.parse(`${dates.at(-1)}T00:00:00Z`); ms += DAY_MS) {
      const date = isoDay(ms);
      days.push(byDate.get(date) || { date, actual: 0, estimated: false });
    }
  }
  return { days: days.slice(-maxDays), withHistory, withoutHistory: campaigns.length - withHistory };
}

export const PACING_RANGES = Object.freeze([
  { id: "7", label: "Last 7 days" },
  { id: "14", label: "Last 14 days" },
  { id: "30", label: "Last 30 days" },
  { id: "60", label: "Last 60 days" },
  { id: "90", label: "Last 90 days" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "this-quarter", label: "This quarter" },
  { id: "last-quarter", label: "Last quarter" },
  { id: "ytd", label: "Year to date" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom range…" }
]);
export const DEFAULT_PACING_RANGE = "30";
export const MAX_RANGE_DAYS = 400;

const isIsoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "")) && isoDay(Date.parse(`${value}T00:00:00Z`)) === value;
const addDays = (iso, count) => isoDay(Date.parse(`${iso}T00:00:00Z`) + count * DAY_MS);
const monthStart = (year, month) => isoDay(Date.UTC(year, month, 1));
const monthEnd = (year, month) => isoDay(Date.UTC(year, month + 1, 0));

/**
 * The first and last day a period covers. "Last N days" end today; calendar months and quarters cover the whole
 * period (days still to come show the 100% pace with no spend yet); "all time" spans the dated reports.
 * An unusable custom range falls back to the last 30 days and says why in `error`.
 */
export function resolvePacingRange(preset, { today, custom = {}, dataStart = null, dataEnd = null } = {}) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  const quarterStart = Math.floor(month / 3) * 3;
  const fixed = {
    "this-month": [monthStart(year, month), monthEnd(year, month)],
    "last-month": [monthStart(year, month - 1), monthEnd(year, month - 1)],
    "this-quarter": [monthStart(year, quarterStart), monthEnd(year, quarterStart + 2)],
    "last-quarter": [monthStart(year, quarterStart - 3), monthEnd(year, quarterStart - 1)],
    ytd: [`${year}-01-01`, today],
    all: dataStart ? [dataStart, dataEnd > today ? dataEnd : today] : [addDays(today, -29), today]
  };
  const label = PACING_RANGES.find(item => item.id === preset)?.label || "Last 30 days";
  let start;
  let end;
  let error = "";
  if (preset === "custom") {
    if (!isIsoDate(custom.start) || !isIsoDate(custom.end)) error = "Choose a start and end date.";
    else if (custom.start > custom.end) error = "The start date must be on or before the end date.";
    else if (daysBetween(custom.start, custom.end) + 1 > MAX_RANGE_DAYS) error = `Choose a range of ${MAX_RANGE_DAYS} days or fewer.`;
    if (!error) [start, end] = [custom.start, custom.end];
  } else if (fixed[preset]) {
    [start, end] = fixed[preset];
  } else if (/^\d+$/.test(String(preset)) && Number(preset) > 0) {
    [start, end] = [addDays(today, -(Number(preset) - 1)), today];
  }
  if (!start) [start, end] = [addDays(today, -29), today];
  // A very long span (all time over several years) shows its most recent days.
  const clipped = daysBetween(start, end) + 1 > MAX_RANGE_DAYS;
  if (clipped) start = addDays(end, -(MAX_RANGE_DAYS - 1));
  return { preset: error ? DEFAULT_PACING_RANGE : preset, start, end, label: error ? "Last 30 days" : label, error, clipped };
}

const flightText = unit => unit.startDate && unit.endDate ? `${unit.startDate} → ${unit.endDate}` : "";

/**
 * Everything the pacing detail view shows: the portfolio's pacing, spend against the spend a 100% pace would have
 * reached today, the budget, the daily spend against the flat daily amount a 100% pace needs, and each paced campaign.
 */
export function buildPacingDetail({ campaigns, totals = {}, spendView = "billing", asOf = new Date(), range = null }) {
  const today = asOf.toISOString().slice(0, 10);
  const units = budgetUnits(campaigns, totals);
  const portfolio = calculatePortfolioPacing(units, asOf);
  const daily = dailySpendAcrossCampaigns(campaigns, { spendView, maxDays: Infinity });
  const dataByDate = new Map(daily.days.map(day => [day.date, day]));
  const resolved = range ? resolvePacingRange(range.preset, { today, custom: range.custom, dataStart: daily.days[0]?.date ?? null, dataEnd: daily.days.at(-1)?.date ?? null }) : null;
  const dates = resolved ? Array.from({ length: daysBetween(resolved.start, resolved.end) + 1 }, (_, index) => addDays(resolved.start, index)) : daily.days.map(day => day.date).slice(-400);
  const baseline = dailyBaseline(units, dates);
  // A day outside the dated reports has no spend figure (null), which is different from a day with zero spend.
  const days = dates.map((date, index) => ({ date, actual: dataByDate.get(date)?.actual ?? null, estimated: dataByDate.get(date)?.estimated ?? false, baseline: baseline.series[index].baseline }));
  const covered = days.filter(day => day.actual !== null);
  const actualTotal = covered.reduce((sum, day) => sum + day.actual, 0);
  const baselineTotal = covered.reduce((sum, day) => sum + day.baseline, 0);
  const period = {
    totalDays: days.length,
    daysWithData: covered.length,
    actualTotal,
    baselineTotal,
    avgActual: covered.length ? actualTotal / covered.length : null,
    avgBaseline: covered.length ? baselineTotal / covered.length : null,
    percent: baselineTotal > 0 ? actualTotal / baselineTotal * 100 : null
  };
  const rows = units.map(unit => {
    const first = unit.records[0];
    const calc = calculateSpendPacing({ budget: unit.budget, spend: unit.spend, startDate: unit.startDate, endDate: unit.endDate }, asOf);
    const reported = Number(unit.pacing);
    return {
      name: unit.key ? campaignGroupName(first) : first.name,
      client: first.client,
      lines: unit.records.length,
      spend: unit.spend,
      budget: Number.isFinite(unit.budget) && unit.budget > 0 ? unit.budget : null,
      startDate: unit.startDate || null,
      endDate: unit.endDate || null,
      flight: flightText(unit),
      expected: calc ? calc.expectedSpend : null,
      pacing: calc ? calc.pacing : Number.isFinite(reported) && reported >= 0 && unit.pacing !== null && String(unit.pacing).trim() !== "" ? reported : null,
      daysLeft: unit.endDate && unit.endDate >= today ? daysBetween(today, unit.endDate) + 1 : null,
      fromOrder: unit.hasTotals
    };
  }).sort((a, b) => (b.pacing ?? -1) - (a.pacing ?? -1) || a.name.localeCompare(b.name));
  return {
    pacing: portfolio.pacing,
    spend: units.reduce((sum, unit) => sum + (Number(unit.spend) || 0), 0),
    expected: portfolio.expectedSpend,
    budget: unitsBudget(units),
    requiredDaily: requiredDailyFromToday(units, today),
    days,
    period,
    range: resolved,
    withHistory: daily.withHistory,
    withoutHistory: daily.withoutHistory,
    skippedUnits: baseline.skippedUnits,
    rows
  };
}
