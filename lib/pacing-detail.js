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

const flightText = unit => unit.startDate && unit.endDate ? `${unit.startDate} → ${unit.endDate}` : "";

/**
 * Everything the pacing detail view shows: the portfolio's pacing, spend against the spend a 100% pace would have
 * reached today, the budget, the daily spend against the flat daily amount a 100% pace needs, and each paced campaign.
 */
export function buildPacingDetail({ campaigns, totals = {}, spendView = "billing", asOf = new Date(), recentDays = 7 }) {
  const today = asOf.toISOString().slice(0, 10);
  const units = budgetUnits(campaigns, totals);
  const portfolio = calculatePortfolioPacing(units, asOf);
  const daily = dailySpendAcrossCampaigns(campaigns, { spendView });
  const baseline = dailyBaseline(units, daily.days.map(day => day.date));
  const days = daily.days.map((day, index) => ({ ...day, baseline: baseline.series[index].baseline }));
  const recent = days.slice(-recentDays);
  const recentActual = recent.length ? recent.reduce((sum, day) => sum + day.actual, 0) / recent.length : null;
  const recentBaseline = recent.length ? recent.reduce((sum, day) => sum + day.baseline, 0) / recent.length : null;
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
    recentActual,
    recentBaseline,
    recentPercent: recentBaseline > 0 ? recentActual / recentBaseline * 100 : null,
    withHistory: daily.withHistory,
    withoutHistory: daily.withoutHistory,
    skippedUnits: baseline.skippedUnits,
    rows
  };
}
