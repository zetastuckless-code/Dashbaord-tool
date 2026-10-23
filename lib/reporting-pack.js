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
const exactMoney = value => Number.isFinite(value) ? `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

/** How a client's reports compare periods: last 7 or 14 days, the last full Monday–Sunday week, or the last full month. */
export const WINDOWS = { "7": "Last 7 days against the 7 before", "14": "Last 14 days against the 14 before", week: "Last full Monday–Sunday week against the week before", month: "Last full month against the month before" };
export function comparisonWindows(kind = "7", through) {
  if (kind === "week") {
    // The latest Sunday on or before the data's last day closes the last complete week.
    const end = addDays(through, -weekday(through));
    return { current: [addDays(end, -6), end], prior: [addDays(end, -13), addDays(end, -7)], label: WINDOWS.week };
  }
  if (kind === "month") {
    const lastDay = addDays(through, 1).slice(8) === "01" ? through : addDays(`${through.slice(0, 7)}-01`, -1);
    const start = `${lastDay.slice(0, 7)}-01`;
    const priorEnd = addDays(start, -1);
    return { current: [start, lastDay], prior: [`${priorEnd.slice(0, 7)}-01`, priorEnd], label: WINDOWS.month };
  }
  const days = kind === "14" ? 14 : 7;
  return { current: [addDays(through, -(days - 1)), through], prior: [addDays(through, -(2 * days - 1)), addDays(through, -days)], label: WINDOWS[kind] || WINDOWS["7"] };
}
const between = (date, [from, to]) => date >= from && date <= to;
const SUMS = ["impressions", "clicks", "spend", "conversions", "revenue", "videoStarts", "videoCompletions"];
function sumRows(rows) {
  const total = Object.fromEntries(SUMS.map(key => [key, 0]));
  for (const row of rows) for (const key of SUMS) if (Number.isFinite(row[key])) total[key] += row[key];
  return total;
}
const ctrText = total => total.impressions ? `${(total.clicks / total.impressions * 100).toFixed(2)}%` : "—";
const roasText = total => total.spend && total.revenue ? `$${(total.revenue / total.spend).toFixed(2)}` : "—";
const sizeOf = text => /(\d{2,4}x\d{2,4})/i.exec(String(text))?.[1]?.toLowerCase() || "";
const creativeFamily = text => String(text || "").replace(/[_-]?\d{2,4}x\d{2,4}$/i, "") || "(none)";

/** Current against prior for one way of grouping the DCM or DSP rows, biggest current spend first. */
function breakdownTable(rows, window, keyOf, label, limit = 25) {
  const keys = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const entry = keys.get(key) || { current: [], prior: [] };
    if (between(row.date, window.current)) entry.current.push(row);
    else if (between(row.date, window.prior)) entry.prior.push(row);
    keys.set(key, entry);
  }
  const ranked = [...keys.entries()].map(([key, entry]) => [key, sumRows(entry.current), sumRows(entry.prior)]).filter(([, now, before]) => now.impressions || before.impressions).sort((a, b) => b[1].spend - a[1].spend || b[1].impressions - a[1].impressions);
  return table([label, "Impressions", "Before", "Clicks", "Before", "CTR", "CTR before", "Spend", "Spend before", "Revenue", "ROAS", "ROAS before", "Conversions"], ranked.slice(0, limit).map(([key, now, before]) => [key, count(now.impressions), count(before.impressions), count(now.clicks), count(before.clicks), ctrText(now), ctrText(before), exactMoney(now.spend), exactMoney(before.spend), exactMoney(now.revenue), roasText(now), roasText(before), count(now.conversions)])) + (ranked.length > limit ? `\n\n_${ranked.length - limit} more not shown; they're in the CSV._` : "");
}

/** Things to check before any number goes out: latest day, missing days, recent-day lag, and placement shifts. */
function dataChecks(rows, window) {
  const lines = [];
  for (const source of [...new Set(rows.map(row => row.source))]) {
    const mine = rows.filter(row => row.source === source);
    const label = source === "CM360" ? "DCM" : source;
    const dates = [...new Set(mine.map(row => row.date))].sort();
    if (!dates.length) continue;
    lines.push(`- ${label}: latest day with rows is ${dates.at(-1)}.`);
    const expected = [];
    for (let day = window.current[0]; day <= window.current[1]; day = addDays(day, 1)) expected.push(day);
    const missing = expected.filter(day => !dates.includes(day) && day >= dates[0]);
    lines.push(missing.length ? `- ${label}: no rows on ${missing.join(", ")} inside this period.` : `- ${label}: every day in this period has rows.`);
    const inWindow = mine.filter(row => between(row.date, window.current));
    const windowDays = [...new Set(inWindow.map(row => row.date))].sort();
    if (windowDays.length >= 6) {
      const recent = windowDays.slice(-3);
      const earlier = windowDays.slice(0, -3);
      const perDay = (dayList, key) => dayList.reduce((sum, day) => sum + inWindow.filter(row => row.date === day).reduce((total, row) => total + (Number(row[key]) || 0), 0), 0) / dayList.length;
      const spendRecent = perDay(recent, "spend");
      const spendEarlier = perDay(earlier, "spend");
      const revenueRecent = perDay(recent, "revenue");
      const revenueEarlier = perDay(earlier, "revenue");
      const placements = dayList => dayList.reduce((sum, day) => sum + new Set(inWindow.filter(row => row.date === day).map(row => row.placement)).size, 0) / dayList.length;
      lines.push(`- ${label}: last 3 days average ${exactMoney(spendRecent)} spend and ${exactMoney(revenueRecent)} revenue a day, against ${exactMoney(spendEarlier)} and ${exactMoney(revenueEarlier)} earlier in the period.${revenueEarlier > 0 && revenueRecent < revenueEarlier * 0.6 ? " Revenue on the last days looks low; it may still be filling in (attribution lag)." : ""}`);
      const before = placements(earlier);
      const after = placements(recent);
      if (before && Math.abs(after - before) / before > 0.25) lines.push(`- ${label}: active placements went from about ${before.toFixed(0)} a day to ${after.toFixed(0)} a day. Check for a budget or setup change.`);
    }
  }
  return lines.length ? lines.join("\n") : "_No DCM or DSP rows for this client yet._";
}
const count = value => formatMetric("impressions", value);

/**
 * Builds a client's pack. `records` are the client's live and recently ended lines; `alerts` and `todos` are already
 * narrowed to the client.
 */
export function buildReportingPack({ client, records, totals = {}, alerts = [], todos = [], today, schedule = {}, kpiTolerance = 10, rawRows = [] }) {
  const groups = [...new Map(records.map(record => [groupKey(record), campaignGroupName(record)])).entries()];
  const dataThrough = records.map(record => record.dataAsOf).filter(Boolean).sort().at(-1) || "unknown";
  // DCM and DSP usually run ahead of the client's report, so the comparison ends on the latest day either has.
  const rawThrough = rawRows.map(row => row.date).sort().at(-1);
  const through = [dataThrough !== "unknown" ? dataThrough : null, rawThrough].filter(Boolean).sort().at(-1) || today;
  const window = comparisonWindows(schedule.window || "7", through);
  const watch = kpiWatch(records, { tolerance: kpiTolerance });
  const goalStatus = record => {
    const item = [...watch.off, ...watch.near, ...watch.on].find(entry => entry.record === record);
    if (!item) return record.target ? "no data" : "no goal";
    return `${item.goalText} goal, ${item.gap > kpiTolerance ? "off" : item.gap > 0 ? "close" : "on"} (${item.gap > 0 ? `${item.gap.toFixed(0)}% behind` : `${Math.abs(item.gap).toFixed(0)}% ahead`})`;
  };
  const sections = [];
  sections.push(`# Reporting pack · ${client} · ${today}`);
  sections.push(`Generated by the Zeta Campaign Pacing dashboard. Data through ${dataThrough}. ${schedule.note ? `Notes for this client: ${schedule.note}` : ""}`.trim());
  sections.push("## How to read this\n- Spend is billable spend. Pacing compares spend to a straight-line plan through today: 100% is on plan.\n- KPI goals come from each campaign's settings. \"Off\" means more than the alert tolerance from goal.\n- DCM (ad server) and DSP sections are exact sums of their day-level rows; the CSV with the same date in its name has every row from the last 30 days (by placement or line item, and creative).");
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
  sections.push(`## Data checks\nRun these before any number goes in an email.\n\n${dataChecks(rawRows, window)}`);
  sections.push(`## This period against the one before\n${window.label}. This period: ${window.current[0]} to ${window.current[1]}. Period before: ${window.prior[0]} to ${window.prior[1]}. Line totals come from the client's report; where the report's dates don't fall on the period's edges, they're spread evenly by day.\n\n${table(["Line", "Spend", "Spend before", "Impressions", "Impressions before", "Clicks", "Clicks before", "KPI", "KPI before"], records.flatMap(record => {
    const now = periodRow(record, ...window.current, today);
    const before = periodRow(record, ...window.prior, today);
    if (!now && !before) return [];
    return [[lineLabel(record), money(now?.spend), money(before?.spend), count(now?.impressions), count(before?.impressions), count(now?.clicks), count(before?.clicks), now?.kpi || "—", before?.kpi || "—"]];
  }))}`);
  for (const source of [...new Set(rawRows.map(row => row.source))]) {
    const mine = rawRows.filter(row => row.source === source);
    const label = source === "CM360" ? "DCM" : source;
    const itemName = source === "DSP" ? "Line item" : "Placement";
    sections.push(`## ${label} by day-level rows: this period against the one before\nExact sums of the ${label} rows for ${window.current[0]} to ${window.current[1]} against ${window.prior[0]} to ${window.prior[1]}.\n\n### By dashboard line\n${breakdownTable(mine, window, row => lineLabel({ name: row.line }), "Line")}\n\n### By ${itemName.toLowerCase()}\n${breakdownTable(mine, window, row => row.placement, itemName)}\n\n### By creative (size removed)\n${breakdownTable(mine, window, row => creativeFamily(row.creative), "Creative")}\n\n### By ad size\n${breakdownTable(mine, window, row => sizeOf(row.placement) || sizeOf(row.creative), "Size")}`);
  }
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
  const since = addDays(today, -30);
  const csvRows = rawRows.length ? [["date", "campaign", "line", "source", "placement_or_line_item", "creative", "impressions", "clicks", "spend", "conversions", "revenue", "video_starts", "video_completions"]] : [["date", "campaign", "line", "source", "impressions", "clicks", "spend", "conversions", "revenue", "video_starts", "video_completions"]];
  for (const row of rawRows.filter(item => item.date >= since).sort((a, b) => a.date.localeCompare(b.date))) {
    csvRows.push([row.date, row.campaign || "", lineLabel({ name: row.line }), row.source === "CM360" ? "DCM" : row.source, row.placement || "", row.creative || "", ...SUMS.map(key => row[key] ?? "")]);
  }
  for (const record of rawRows.length ? [] : records) {
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

// --- The ChatGPT side: answers to a few questions become a skill, a scheduled task, or an update to a skill you have ---
export const PROMPT_INCLUDES = {
  pacing: "Pacing against plan, and what spend has to do to finish on budget",
  kpis: "KPIs against each campaign's goal",
  trends: "This period against the one before",
  months: "The month-by-month trend",
  sources: "Gaps between the client's report and DCM or DSP",
  alerts: "Open alerts on the dashboard",
  todos: "Open to-dos for the client",
  nextSteps: "Recommended next steps (optimizations to suggest)"
};
export const PROMPT_BREAKDOWNS = { line: "Dashboard line", placement: "Placement or line item (audience is in the name)", creative: "Creative", size: "Ad size" };
export const PROMPT_OUTPUTS = { insights: "A short list of insights for me", email: "A client email draft", file: "A trimmed report file" };
export const PROMPT_TONES = { direct: "short and direct", detailed: "detailed, with the numbers behind each point", executive: "an executive summary a client lead can skim in a minute" };
export const PROMPT_SOURCES = { report: "the client's report (the Zeta export)", dcm: "DCM (ad server)", dsp: "the DSP" };
export const DEFAULT_PROMPT_ANSWERS = Object.freeze({ skillName: "", includes: ["pacing", "kpis", "trends", "alerts"], breakdowns: ["line", "placement", "creative"], outputs: ["insights", "email"], tone: "direct", insightCount: "3 to 5", declines: "noDips", source: "report", subject: "", greeting: "Hi [Name],", closing: "Let us know if you have any questions!", signOff: "", privateNotes: true, emailExample: "", fileExample: "", attachExample: false, extraRules: "", existingSkill: "", weekday: 1, time: "10:00" });

const quoted = text => text.trim().split("\n").map(line => `> ${line}`).join("\n");
const timeText = value => {
  const [hours = 10, minutes = 0] = String(value || "10:00").split(":").map(Number);
  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
};
export const defaultSkillName = client => client ? `${client} reporting` : "Client reporting from dashboard packs";
const skillSlug = name => String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The skill itself, laid out like a hand-written one: inputs, data checks, windows, analysis, how to word declines,
 * the email, and notes back to you. `client` is blank for one skill shared by every client.
 */
export function buildSkillText(answers = {}, { client = "", schedule = {}, owner = "me" } = {}) {
  const a = { ...DEFAULT_PROMPT_ANSWERS, ...answers };
  const name = a.skillName || defaultSkillName(client);
  const who = a.signOff || owner;
  const subjectClient = client || "<client>";
  const cadence = { weekly: "weekly", biweekly: "biweekly", monthly: "monthly" }[schedule.cadence] || "recurring";
  const window = WINDOWS[schedule.window || a.window || "7"];
  const includes = (a.includes || []).filter(key => PROMPT_INCLUDES[key]);
  const breakdowns = (a.breakdowns || []).filter(key => PROMPT_BREAKDOWNS[key]).map(key => PROMPT_BREAKDOWNS[key].toLowerCase());
  const outputs = a.outputs || [];
  const lines = ["---", `name: "${skillSlug(name)}"`, `description: "Build ${who === "me" ? "my" : `${who}'s`} ${cadence} ${client || "client"} update from the Zeta Campaign Pacing dashboard's reporting pack. Use when a new pack for ${client || "a client"} is in the Reporting packs folder, or when asked for the ${client || "client"} update."`, "---", "", `# ${client ? `${client} reporting` : "Client reporting"} from the dashboard pack`, ""];
  lines.push("## Inputs", "", `- The newest reporting pack: \`reporting-pack-${client ? skillSlug(client) : "<client>"}-<date>.md\` in the OneDrive "Reporting packs" folder, with its \`-daily.csv\` (every DCM and DSP row from the last 30 days, by placement or line item and creative).`, "- The pack's numbers are the source of truth. Don't invent figures; if something you'd want isn't in the pack, say so in the notes.", "- Read the pack's \"Notes for this client\" line and follow it.", "");
  lines.push("## Step 1: Data checks (before any number goes in the email)", "", "- Read the pack's \"Data checks\" section first.", "- State the latest day the numbers cover. If DCM, DSP, and the client's report end on different days, say each one.", "- Flag missing days, recent-day lag, and placement shifts to me in the notes, not in the client email.", "");
  lines.push("## Step 2: Windows", "", `- ${window}. Use the pack's "This period against the one before" and its DCM and DSP sections, which use the same dates.`, "- Don't compare a partial period's totals against a full one.", "");
  lines.push("## Step 3: Analysis", "", `- Client-facing delivery numbers come from: ${PROMPT_SOURCES[a.source] || PROMPT_SOURCES.report}.`, ...includes.map(key => `- ${PROMPT_INCLUDES[key]}.`), ...(breakdowns.length ? [`- Break results down by ${breakdowns.join(", ")}, current against prior. Skip rows with tiny spend.`] : []), `- Give ${a.insightCount || "3 to 5"} insights, leading with what's working. Style: ${PROMPT_TONES[a.tone] || PROMPT_TONES.direct}.`, "- ROAS is revenue divided by spend, written with a dollar sign, like $2.50 ROAS. CTR is clicks divided by impressions.", "");
  if (a.declines === "noDips") lines.push("## Step 4: Declines (decide per metric)", "", "- Improved or flat: include the comparison (\"improved to $2.81 from $1.28\", \"holding at 73%\").", "- Declined: report the current number alone. No \"down from\", no benchmark or goal comparison, no softening phrases. Lower is better for CPM, CPV, CPC, and CPA, so a rise in those is a decline.", "- Treat any decline as a decline, even a small one. List declines for me in the notes.", "");
  else lines.push("## Step 4: Changes", "", "- Show each metric with its change against the prior period, up or down, plainly.", "");
  if (outputs.includes("email")) {
    lines.push("## Step 5: Email", "", `- Subject: ${a.subject || `${subjectClient} reporting M/D/YY`}`, `- Open with "${a.greeting || "Hi [Name],"}" and one sentence on what the update covers and the date it reflects.`, "- Bullets lead with the number, then a short note. Don't explain why results happened, and don't add closing reassurance.", `- Close with "${a.closing || "Let us know if you have any questions!"}" and sign "Thanks," / "${a.signOff || "[your name]"}".`, "- Draft only. Don't send it.");
    if (a.emailExample.trim()) lines.push("- Match the length, structure, and tone of this email (its numbers are old; use the pack's):", "", quoted(a.emailExample));
    lines.push("");
  }
  if (outputs.includes("file")) {
    lines.push("## Output file", "", `- Make a trimmed report file for the client${a.attachExample ? ", laid out like the attached example" : ""}.`);
    if (a.fileExample.trim()) lines.push("- The finished file looks like this:", "", quoted(a.fileExample));
    lines.push("");
  }
  if (outputs.includes("insights")) lines.push("## Insights for me", "", "- Before the email, list the insights, each one sentence with its number.", "");
  if (a.privateNotes) lines.push("## Notes back to me (outside the email)", "", "End with a short numbered list to check before sending: the dates used, metrics that declined (as plain numbers), spend or placement shifts, recent-day lag, and missing days.", "");
  if (a.extraRules.trim()) lines.push("## Client-specific rules", "", ...a.extraRules.trim().split("\n").map(line => line.trim().startsWith("-") ? line.trim() : `- ${line.trim()}`), "");
  if (a.attachExample) lines.push("I've attached an example of the finished report. Keep it with this skill and match it.", "");
  return lines.join("\n").trim();
}

/** The prompt that creates the skill in ChatGPT. */
export function buildSkillPrompt(answers = {}, options = {}) {
  return `Create a skill from the text below${answers.attachExample ? ", and keep the example report I've attached with it" : ""}. If skills aren't available here, save it as this project's instructions.\n\n${buildSkillText(answers, options)}`;
}

/** The prompt that updates a skill you already have so it reads the pack instead of exported workbooks. */
export function buildAdapterPrompt(answers = {}, { client = "" } = {}) {
  const a = { ...DEFAULT_PROMPT_ANSWERS, ...answers };
  if (!a.existingSkill.trim()) return "";
  return [`Update my skill below so it gets its numbers from my Zeta Campaign Pacing dashboard's reporting pack instead of exported workbooks. Keep its format, voice, windows, and rules the same. Return the full updated skill.`, "",
    "Where things are in the pack:",
    `- The pack is \`reporting-pack-${client ? skillSlug(client) : "<client>"}-<date>.md\` in the OneDrive "Reporting packs" folder, with a \`-daily.csv\` holding every DCM and DSP row from the last 30 days (date, placement or line item, creative, impressions, clicks, spend, conversions, revenue, video starts and completions).`,
    "- Raw Data / DCM Data / DSP Data tabs: use the CSV and the pack's DCM and DSP sections (by line, placement, creative, and ad size, this period against the one before).",
    "- Date and quality checks (max date, missing days, recent-day lag, placement shifts): the pack's \"Data checks\" section.",
    "- Pacing, budget, and KPIs against goal: the pack's \"Campaigns\" and \"Lines, flight to date\" sections. Monthly figures: \"By month\".",
    "- Keep asking me to upload anything the pack doesn't have, like site lists, unique users, or YouTube placement and creative tables (matched conversions are already in the pack as each line's conversions), and keep the skill's steps for those files.",
    "", "My skill:", "", quoted(a.existingSkill)].join("\n");
}

/** The scheduled task that runs the skill on each new pack. */
export function buildSchedulePrompt(answers = {}, { folder = "my morning brief folder", client = "" } = {}) {
  const a = { ...DEFAULT_PROMPT_ANSWERS, ...answers };
  const name = a.skillName || defaultSkillName(client);
  const when = a.weekday === "weekdays" ? "Every weekday (Monday to Friday)" : `Every ${weekdayName(Number(a.weekday ?? 1))}`;
  return [`${when} at ${timeText(a.time)}, do this:`, "",
    `1. Open my OneDrive folder "${folder}/${PACK_FOLDER}" and find ${client ? `the ${client} reporting pack dated today (reporting-pack-${skillSlug(client)}-<today's date>.md, with its -daily.csv)` : "the reporting packs dated today (reporting-pack-<client>-<today's date>.md, with its -daily.csv)"}.`,
    `2. If there ${client ? "isn't one" : "are none"} dated today, reply "No new reporting packs today." and stop. (The dashboard saves packs when it's opened on a client's scheduled day.)`,
    `3. ${client ? "Use" : "For each pack, use"} my "${name}" skill.`,
    `4. Reply with ${client ? "the skill's output" : "one section per client, in the skill's order"}.`].join("\n");
}
