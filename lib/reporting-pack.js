// Reporting packs: one Markdown file per client that a ChatGPT scheduled task reads to write insights and draft the
// client email, plus a CSV of the last 30 days of DCM and DSP by line. The dashboard writes them on each client's
// schedule, the first time it's open on or after the due day.
import { campaignGroupName, groupKey } from "./campaign-groups.js";
import { computeMetrics, formatMetric } from "./metric-catalog.js";
import { periodMetrics } from "./performance-snapshots.js";
import { calculateKpi } from "./metric-calculations.js";
import { kpiWatch } from "./kpi-watch.js";
import { deliveryComparison } from "./third-party-delivery.js";

export const REPORTING_KEY = "northstar-reporting";
export const PACK_FOLDER = "Reporting packs";
const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const CADENCES = { off: "Off", weekly: "Weekly", biweekly: "Every two weeks", monthly: "Monthly" };
export const weekdayName = day => WEEKDAYS[day];

export function readReporting(storage) {
  try {
    const value = JSON.parse(storage.getItem(REPORTING_KEY));
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
export function writeReporting(storage, value) {
  try { storage.setItem(REPORTING_KEY, JSON.stringify(value)); } catch { /* kept for this visit */ }
  return value;
}

const iso = time => new Date(time).toISOString().slice(0, 10);
const addDays = (day, count) => iso(Date.parse(`${day}T00:00:00Z`) + count * DAY_MS);
const weekday = day => new Date(`${day}T00:00:00Z`).getUTCDay();

/**
 * The most recent date a client's pack was due on or before today: the chosen weekday (every week, or every other
 * week counted from when the schedule was set), or the chosen day of the month (the month's last day if it's shorter).
 */
export function lastDueDate(schedule, today) {
  if (!schedule || schedule.cadence === "off" || !schedule.cadence) return null;
  if (schedule.cadence === "monthly") {
    const day = Math.min(Math.max(1, Number(schedule.monthDay) || 1), 28);
    const thisMonth = `${today.slice(0, 7)}-${String(day).padStart(2, "0")}`;
    if (thisMonth <= today) return thisMonth;
    const previous = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, day));
    return iso(previous.getTime());
  }
  const target = Number(schedule.weekday ?? 1);
  let due = addDays(today, -((weekday(today) - target + 7) % 7));
  if (schedule.cadence === "biweekly") {
    const anchor = schedule.since || due;
    const weeks = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${anchor}T00:00:00Z`)) / (7 * DAY_MS));
    if (weeks % 2 !== 0) due = addDays(due, -7);
  }
  return due;
}

export function isPackDue(schedule, today) {
  const due = lastDueDate(schedule, today);
  return Boolean(due) && (!schedule.lastWritten || schedule.lastWritten < due);
}

const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const packFileNames = (client, today) => ({ markdown: `reporting-pack-${slug(client)}-${today}.md`, csv: `reporting-pack-${slug(client)}-${today}-daily.csv` });

const lineLabel = record => String(record.name).includes(" — ") ? String(record.name).split(" — ").slice(1).join(" — ") : String(record.name);
const cell = value => String(value ?? "—").replace(/\|/g, "/").replace(/\n/g, " ");
const table = (headers, rows) => rows.length ? [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map(row => `| ${row.map(cell).join(" | ")} |`)].join("\n") : "_None._";
const kpiText = record => {
  const value = calculateKpi(record.kpi, record);
  return value ? `${value.formatted} ${value.metric}` : "—";
};
const periodRow = (record, from, to, today) => {
  const metrics = periodMetrics(record, `custom:${from}:${to}`, { today });
  if (!metrics) return null;
  const kpi = calculateKpi(record.kpi, metrics);
  return { spend: metrics.spend, impressions: metrics.impressions, clicks: metrics.clicks, conversions: metrics.conversions, kpi: kpi ? `${kpi.formatted} ${kpi.metric}` : "—" };
};
const money = value => formatMetric("spend", value);
const count = value => formatMetric("impressions", value);

/**
 * Builds a client's pack. `records` are the client's live and recently ended lines; `alerts` and `todos` are already
 * narrowed to the client.
 */
export function buildReportingPack({ client, records, totals = {}, alerts = [], todos = [], today, schedule = {}, kpiTolerance = 10 }) {
  const groups = [...new Map(records.map(record => [groupKey(record), campaignGroupName(record)])).entries()];
  const dataThrough = records.map(record => record.dataAsOf).filter(Boolean).sort().at(-1) || "unknown";
  const weekEnd = dataThrough !== "unknown" ? dataThrough : today;
  const lastWeek = [addDays(weekEnd, -6), weekEnd];
  const weekBefore = [addDays(weekEnd, -13), addDays(weekEnd, -7)];
  const watch = kpiWatch(records, { tolerance: kpiTolerance });
  const goalStatus = record => {
    const item = [...watch.off, ...watch.near, ...watch.on].find(entry => entry.record === record);
    if (!item) return record.target ? "no data" : "no goal";
    return `${item.goalText} goal, ${item.gap > kpiTolerance ? "off" : item.gap > 0 ? "close" : "on"} (${item.gap > 0 ? `${item.gap.toFixed(0)}% behind` : `${Math.abs(item.gap).toFixed(0)}% ahead`})`;
  };
  const sections = [];
  sections.push(`# Reporting pack · ${client} · ${today}`);
  sections.push(`Generated by the Zeta Campaign Pacing dashboard. Data through ${dataThrough}. ${schedule.note ? `Notes for this client: ${schedule.note}` : ""}`.trim());
  sections.push("## How to read this\n- Spend is billable spend. Pacing compares spend to a straight-line plan through today: 100% is on plan.\n- KPI goals come from each campaign's settings. \"Off\" means more than the alert tolerance from goal.\n- Daily DCM (ad server) and DSP numbers are in the CSV with the same date in its name.");
  sections.push(`## Campaigns\n${table(["Campaign", "Lines", "Flight", "Budget", "Spend", "Pacing", "KPI"], groups.map(([key, name]) => {
    const lines = records.filter(record => groupKey(record) === key);
    const metrics = computeMetrics(lines, { totals: totals[key] || null });
    const starts = lines.map(line => line.startDate).filter(Boolean).sort();
    const ends = lines.map(line => line.endDate).filter(Boolean).sort();
    return [name, lines.length, starts.length ? `${starts[0]} to ${ends.at(-1)}` : "—", money(metrics.budget), money(metrics.spend), formatMetric("pacing", metrics.pacing), metrics.kpi || "—"];
  }))}`);
  sections.push(`## Lines, flight to date\n${table(["Campaign", "Line", "Spend", "Impressions", "Clicks", "CTR", "Conversions", "KPI", "Goal", "Pacing"], records.map(record => {
    const metrics = computeMetrics([record]);
    return [campaignGroupName(record), lineLabel(record), money(metrics.spend), count(metrics.impressions), count(metrics.clicks), formatMetric("ctr", metrics.ctr), count(metrics.conversions), kpiText(record), goalStatus(record), formatMetric("pacing", metrics.pacing)];
  }))}`);
  sections.push(`## Last 7 days against the 7 before\nLast 7 days: ${lastWeek[0]} to ${lastWeek[1]}. Week before: ${weekBefore[0]} to ${weekBefore[1]}.\n\n${table(["Line", "Spend", "Spend before", "Impressions", "Impressions before", "Clicks", "Clicks before", "KPI", "KPI before"], records.flatMap(record => {
    const now = periodRow(record, ...lastWeek, today);
    const before = periodRow(record, ...weekBefore, today);
    if (!now && !before) return [];
    return [[lineLabel(record), money(now?.spend), money(before?.spend), count(now?.impressions), count(before?.impressions), count(now?.clicks), count(before?.clicks), now?.kpi || "—", before?.kpi || "—"]];
  }))}`);
  const months = [...new Set(records.flatMap(record => (record.performanceSnapshots || []).filter(snapshot => !snapshot.dcm).map(snapshot => snapshot.date.slice(0, 7))))].sort().slice(-6);
  sections.push(`## By month\n${table(["Line", ...months], records.map(record => [lineLabel(record), ...months.map(month => {
    const from = `${month}-01`;
    const to = addDays(iso(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)), -1);
    const metrics = periodRow(record, from, to < today ? to : today, today);
    return metrics ? `${money(metrics.spend)}, ${count(metrics.impressions)} imp` : "—";
  })]))}`);
  const comparisons = records.flatMap(record => ["CM360", "DSP"].map(source => [record, source, deliveryComparison(record, source)])).filter(([, , comparison]) => comparison);
  sections.push(`## DCM and DSP against the report (same days)\n${table(["Line", "Source", "Days", "Impressions gap", "Clicks gap", "Source conversions", "Source revenue"], comparisons.map(([record, source, comparison]) => [lineLabel(record), source === "CM360" ? "DCM" : "DSP", `${comparison.from} to ${comparison.to}`, comparison.gaps.impressions === null ? "—" : `${comparison.gaps.impressions.toFixed(1)}%`, comparison.gaps.clicks === null ? "—" : `${comparison.gaps.clicks.toFixed(1)}%`, count(comparison.adServer.conversions), money(comparison.adServer.revenue)]))}`);
  sections.push(`## Open alerts\n${alerts.length ? alerts.map(alert => `- ${alert.title} · ${lineLabel(alert.campaign)}: ${alert.detail}`).join("\n") : "_None._"}`);
  sections.push(`## Open to-dos\n${todos.length ? todos.map(item => `- ${item.text}${item.due ? ` (due ${item.due})` : ""}`).join("\n") : "_None._"}`);
  const csvRows = [["date", "campaign", "line", "source", "impressions", "clicks", "spend", "conversions", "revenue", "video_starts", "video_completions"]];
  const since = addDays(today, -30);
  for (const record of records) {
    for (const [source, days] of Object.entries(record.thirdPartyDelivery || {})) {
      for (const date of Object.keys(days).filter(day => day >= since).sort()) {
        const metrics = days[date];
        csvRows.push([date, campaignGroupName(record), lineLabel(record), source === "CM360" ? "DCM" : source, ...["impressions", "clicks", "spend", "conversions", "revenue", "videoStarts", "videoCompletions"].map(key => metrics[key] ?? "")]);
      }
    }
  }
  const csv = csvRows.map(row => row.map(value => /[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value)).join(",")).join("\n");
  return { markdown: `${sections.join("\n\n")}\n`, csv, dailyRows: csvRows.length - 1 };
}

// --- The ChatGPT side: answers to a few questions become a skill prompt and a scheduled-task prompt ---
export const PROMPT_INCLUDES = {
  pacing: "Pacing against plan, and what spend has to do to finish on budget",
  kpis: "KPIs against each campaign's goal",
  trends: "What changed in the last 7 days against the 7 before",
  months: "The month-by-month trend",
  sources: "Gaps between the report and DCM or DSP",
  alerts: "Open alerts on the dashboard",
  todos: "Open to-dos for the client",
  nextSteps: "Recommended next steps (optimizations to suggest)"
};
export const PROMPT_OUTPUTS = { insights: "A short list of insights for me", email: "A client email draft", file: "A trimmed report file" };
export const PROMPT_TONES = { direct: "short and direct", detailed: "detailed, with the numbers behind each point", executive: "an executive summary a client lead can skim in a minute" };
export const DEFAULT_PROMPT_ANSWERS = Object.freeze({ skillName: "Client reporting from dashboard packs", includes: ["pacing", "kpis", "trends", "alerts", "nextSteps"], outputs: ["insights", "email"], tone: "direct", insightCount: "3 to 5", signOff: "", emailExample: "", fileExample: "", attachExample: false, weekday: 1, time: "10:00" });

const quoted = text => text.trim().split("\n").map(line => `> ${line}`).join("\n");
const timeText = value => {
  const [hours = 10, minutes = 0] = String(value || "10:00").split(":").map(Number);
  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
};

/** The prompt that sets up the reusable reporting skill in ChatGPT. */
export function buildSkillPrompt(answers = {}) {
  const a = { ...DEFAULT_PROMPT_ANSWERS, ...answers };
  const includes = (a.includes || []).filter(key => PROMPT_INCLUDES[key]).map(key => `- ${PROMPT_INCLUDES[key]}`);
  const outputs = a.outputs || [];
  const parts = [`Create a skill named "${a.skillName}" (if skills aren't available here, save this as the project's instructions) with these instructions:`, "",
    "You turn a reporting pack from my Zeta Campaign Pacing dashboard into client reporting. A pack is a Markdown file named reporting-pack-<client>-<date>.md with campaign, line, weekly, monthly, DCM/DSP, alert, and to-do sections, plus a matching -daily.csv of DCM and DSP numbers by day. Treat the pack's numbers as the source of truth; don't invent figures, and say when something you'd want isn't in the pack.", "",
    "Cover these, in this order of importance:", ...(includes.length ? includes : ["- Pacing and KPIs against goal"]), "",
    `Style: ${PROMPT_TONES[a.tone] || PROMPT_TONES.direct}. Give ${a.insightCount || "3 to 5"} insights, leading with anything off goal or off pace. Trim lines with nothing new or worth saying. Read the pack's "Notes for this client" line and follow it.`];
  if (outputs.includes("insights")) parts.push("", "Output 1: the insights for me, each one sentence with its number.");
  if (outputs.includes("email")) {
    parts.push("", `Output ${outputs.includes("insights") ? 2 : 1}: a client email draft in my voice, ready for me to review. Don't send it.${a.signOff ? ` Sign it "${a.signOff}".` : ""}`);
    if (a.emailExample.trim()) parts.push("Match the length, structure, and tone of this email I've sent before (the numbers in it are old; use the pack's):", quoted(a.emailExample));
  }
  if (outputs.includes("file")) {
    parts.push("", `Output ${outputs.filter(key => key !== "file").length + 1}: a trimmed report file for the client${a.attachExample ? ", laid out like the example file I've attached" : ""}.`);
    if (a.fileExample.trim()) parts.push("The finished file looks like this:", quoted(a.fileExample));
  }
  if (a.attachExample) parts.push("", "I've attached an example of the finished report. Keep it with this skill and match it.");
  return parts.join("\n");
}

/** The scheduled task that runs the skill on each new pack. */
export function buildSchedulePrompt(answers = {}, { folder = "my morning brief folder" } = {}) {
  const a = { ...DEFAULT_PROMPT_ANSWERS, ...answers };
  const when = a.weekday === "weekdays" ? "Every weekday (Monday to Friday)" : `Every ${weekdayName(Number(a.weekday ?? 1))}`;
  return [`${when} at ${timeText(a.time)}, do this:`, "",
    `1. Open my OneDrive folder "${folder}/${PACK_FOLDER}" and find the reporting packs dated today (reporting-pack-<client>-<today's date>.md, with its -daily.csv).`,
    "2. If there are none dated today, reply \"No new reporting packs today.\" and stop. (The dashboard saves packs when it's opened on a client's scheduled day.)",
    `3. For each pack, use my "${a.skillName}" skill.`,
    "4. Reply with one section per client, in the skill's order."].join("\n");
}
