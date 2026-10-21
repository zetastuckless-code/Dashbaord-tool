const DAY_MS = 86_400_000;

const utcMs = date => Date.parse(`${date}T00:00:00Z`);
const isoDay = ms => new Date(ms).toISOString().slice(0, 10);
export const daysBetween = (from, to) => Math.round((utcMs(to) - utcMs(from)) / DAY_MS);

/**
 * Turns a cumulative spend trend into spend per day. Reports are often weekly, so the spend between two reports
 * is spread evenly over the days between them (`estimated` marks those days). The first report has no earlier
 * report to compare with and starts the series.
 */
export function dailyActualSeries(points, { maxDays = 120 } = {}) {
  const dated = points.filter(point => Number.isFinite(point.actual)).sort((a, b) => a.date.localeCompare(b.date));
  const series = [];
  for (let index = 1; index < dated.length; index += 1) {
    const previous = dated[index - 1];
    const current = dated[index];
    const span = daysBetween(previous.date, current.date);
    if (span <= 0) continue;
    const perDay = Math.max(0, (current.actual - previous.actual) / span);
    for (let offset = 1; offset <= span; offset += 1) series.push({ date: isoDay(utcMs(previous.date) + offset * DAY_MS), actual: perDay, estimated: span > 1 });
  }
  return series.slice(-maxDays);
}

/**
 * The flat daily spend a flight needs to land on budget: budget ÷ flight days for every unit live on that date.
 * Units without a budget or valid flight dates cannot contribute and are counted so the chart can say so.
 */
export function dailyBaseline(units, dates) {
  const usable = units.filter(unit => Number.isFinite(unit.budget) && unit.budget > 0 && unit.startDate && unit.endDate && unit.endDate >= unit.startDate);
  const perDay = unit => unit.budget / (daysBetween(unit.startDate, unit.endDate) + 1);
  return {
    series: dates.map(date => ({ date, baseline: usable.reduce((sum, unit) => sum + (date >= unit.startDate && date <= unit.endDate ? perDay(unit) : 0), 0) })),
    usableUnits: usable.length,
    skippedUnits: units.length - usable.length
  };
}

/** Spend per day still needed, from `today` to each flight's end, to use up the remaining budget. */
export function requiredDailyFromToday(units, today) {
  let total = 0;
  let counted = 0;
  for (const unit of units) {
    if (!(Number.isFinite(unit.budget) && unit.budget > 0) || !unit.endDate || unit.endDate < today) continue;
    const remaining = Math.max(unit.budget - (Number(unit.spend) || 0), 0);
    total += remaining / (daysBetween(today > (unit.startDate || today) ? today : unit.startDate, unit.endDate) + 1);
    counted += 1;
  }
  return counted ? total : null;
}

/** Joins actual and baseline by date and summarizes the most recent days against the baseline. */
export function dailyPacingView(points, units, { today = isoDay(Date.now()), recentDays = 7 } = {}) {
  const actual = dailyActualSeries(points);
  const baseline = dailyBaseline(units, actual.map(day => day.date));
  const days = actual.map((day, index) => ({ ...day, baseline: baseline.series[index].baseline }));
  const recent = days.slice(-recentDays);
  const recentActual = recent.length ? recent.reduce((sum, day) => sum + day.actual, 0) / recent.length : null;
  const recentBaseline = recent.length ? recent.reduce((sum, day) => sum + day.baseline, 0) / recent.length : null;
  return {
    days,
    usableUnits: baseline.usableUnits,
    skippedUnits: baseline.skippedUnits,
    recentActual,
    recentBaseline,
    recentPercent: recentBaseline > 0 ? recentActual / recentBaseline * 100 : null,
    requiredFromToday: requiredDailyFromToday(units, today)
  };
}
