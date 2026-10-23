// The KPI watcher: every live line with a primary KPI and a goal, how far its KPI is from that goal, and which miss it.
import { calculateKpi } from "./metric-calculations.js";
import { resolveSpend } from "./source-comparison.js";

const LOWER_IS_BETTER = new Set(["CPA", "CPC", "CPM", "CPL", "CPI", "CPV"]);
const number = value => {
  const parsed = Number(String(value ?? "").replace(/^target\s*/i, "").replace(/[$,%x×\s]/gi, ""));
  return String(value ?? "").trim() && Number.isFinite(parsed) ? parsed : null;
};

/**
 * Sorts lines into off goal (worse than the goal by more than the tolerance), near (worse, but within it), on goal, no
 * goal, and no data. `gap` is how far the KPI is from the goal in percent, positive when it's worse.
 */
export function kpiWatch(records, { tolerance = 10 } = {}) {
  const groups = { off: [], near: [], on: [], noGoal: [], noData: [] };
  for (const record of records) {
    const metric = String(record.kpi || "").toUpperCase();
    const goal = number(record.target);
    if (!metric || goal === null || goal === 0) { groups.noGoal.push({ record, metric }); continue; }
    const calculated = calculateKpi(metric, { ...record, spend: resolveSpend(record, "billing") });
    const actual = calculated?.value ?? number(record.value);
    if (actual === null) { groups.noData.push({ record, metric, goal }); continue; }
    const lowerIsBetter = LOWER_IS_BETTER.has(metric);
    const gap = (lowerIsBetter ? actual - goal : goal - actual) / Math.abs(goal) * 100;
    const item = { record, metric, goal, actual, formatted: calculated?.formatted || String(record.value), goalText: String(record.target).replace(/^target\s*/i, ""), gap, lowerIsBetter };
    groups[gap > tolerance ? "off" : gap > 0 ? "near" : "on"].push(item);
  }
  groups.off.sort((a, b) => b.gap - a.gap);
  groups.near.sort((a, b) => b.gap - a.gap);
  groups.on.sort((a, b) => a.gap - b.gap);
  return { ...groups, watched: groups.off.length + groups.near.length + groups.on.length };
}
