import { calculateKpi } from "./metric-calculations.js";
import { periodMetrics } from "./performance-snapshots.js";
import { calculateSpendPacing } from "./spend-pacing.js";

// The team status doc, updated each Monday: for every live campaign, last week's and this week's KPI, the change, whether
// it's on track, performance notes and optimizations, and notes on what happened with the client. The dashboard drafts
// each from the week's numbers and from what the morning briefs said; you edit and paste them into the doc.

export const BRIEF_LOG_KEY = "northstar-brief-log";
export const STATUS_DRAFTS_KEY = "northstar-status-drafts";
const LOG_KEEP_DAYS = 35;
const DAY_MS = 86_400_000;
const iso = time => new Date(time).toISOString().slice(0, 10);
const addDays = (day, count) => iso(Date.parse(`${day}T00:00:00Z`) + count * DAY_MS);
const squash = text => String(text ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const short = day => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

export function readJson(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return value && typeof value === typeof fallback && Array.isArray(value) === Array.isArray(fallback) ? value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Each brief replaces the last one's open items, so the dashboard keeps its own log of everything the briefs said (and
 * what you checked off), for the week's notes. The same item on several days is kept once, at its first day.
 */
export function logItems(log, items, date) {
  const next = [...log];
  for (const item of items) {
    if (!item?.client || !item.text) continue;
    const existing = next.find(entry => entry.client === item.client && squash(entry.text) === squash(item.text));
    if (existing) { if (item.done && !existing.done) Object.assign(existing, { done: true, doneOn: item.doneAt || date }); continue; }
    next.push({ date, client: item.client, text: item.text, source: item.source || "", tag: item.tag || "todo", done: Boolean(item.done), doneOn: item.done ? item.doneAt || date : null });
  }
  const cutoff = addDays(date, -LOG_KEEP_DAYS);
  return next.filter(entry => entry.date >= cutoff || (entry.doneOn && entry.doneOn >= cutoff));
}

/** On a Monday, "this week" is the seven days just ended (Monday to Sunday) and "last week" the seven before. */
export function statusWeeks(today) {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const thisEnd = addDays(today, -(weekday === 0 ? 7 : weekday));
  const thisStart = addDays(thisEnd, -6);
  return { thisWeek: { from: thisStart, to: thisEnd }, lastWeek: { from: addDays(thisStart, -7), to: addDays(thisStart, -1) } };
}
export const weekKey = today => statusWeeks(today).thisWeek.to;

const LOWER_IS_BETTER = new Set(["CPA", "CPC", "CPM", "CPL", "CPV"]);
const numberIn = value => { const match = /-?\d+(?:\.\d+)?/.exec(String(value ?? "").replace(/,/g, "")); return match ? Number(match[0]) : null; };
const money = value => `$${Math.round(value).toLocaleString("en-US")}`;
const sum = (rows, metric) => rows.reduce((total, row) => total + (Number.isFinite(row?.[metric]) ? row[metric] : 0), 0);
const METRICS = ["spend", "impressions", "clicks", "conversions", "revenue", "videoStarts", "videoCompletions"];
const totalsOf = rows => Object.fromEntries(METRICS.map(metric => [metric, sum(rows, metric)]));
const lineName = record => String(record.name).includes(" — ") ? String(record.name).split(" — ").slice(1).join(" — ") : String(record.name);

// Words that say an item was an optimization or a delivery change, rather than client communication.
const OPTIMIZATION = /optimi|shift|reallocat|paus|bid|budget|creative|swap|launch|adjust|increas|decreas|exclu|allowlist|blocklist|geo|audience|frequency|pixel|kpi|pacing|line item|targeting|refresh/i;

/** The week's KPI for a campaign: its lines' delivery over the week, summed, then the KPI from the totals. */
const weekDays = week => { const list = []; for (let day = week.from; day <= week.to; day = addDays(day, 1)) list.push(day); return list; };
const daySums = (days, list) => Object.fromEntries(METRICS.map(metric => [metric, list.reduce((total, day) => total + (Number.isFinite(days[day]?.[metric]) ? days[day][metric] : 0), 0)]));

/**
 * One line's delivery over a week. DSP and DCM days come first (Rent-A-Center lives on DCM days between reports), with
 * DCM's conversions and revenue, the ones the client counts; otherwise the line's reports, spread by day. DCM has no
 * spend, so a week from DCM alone takes its spend from the report, or prices its impressions at the IO's CPM (`rate`).
 */
export function lineWeek(record, week, today, rate = null) {
  const days = weekDays(week);
  const dsp = record.thirdPartyDelivery?.DSP || {};
  const dcm = record.thirdPartyDelivery?.CM360 || {};
  const dspDays = days.filter(day => dsp[day]);
  const dcmDays = days.filter(day => dcm[day]);
  const report = periodMetrics(record, `custom:${week.from}:${week.to}`, { today });
  if (!dspDays.length && !dcmDays.length) return report;
  const totals = dspDays.length ? daySums(dsp, dspDays) : daySums(dcm, dcmDays);
  if (dspDays.length && dcmDays.length) { const fromDcm = daySums(dcm, dcmDays); totals.conversions = fromDcm.conversions; totals.revenue = fromDcm.revenue; }
  if (!(totals.spend > 0)) totals.spend = report?.spend > 0 ? report.spend : rate > 0 ? totals.impressions * rate / 1000 : 0;
  return totals;
}

/** A line's spend to date: its reported spend, or what its DSP and DCM days add up to when that's more current. */
function spendToDate(record, rate = null) {
  const dspSpend = Object.values(record.thirdPartyDelivery?.DSP || {}).reduce((total, day) => total + (Number(day.spend) || 0), 0);
  const dcmValue = rate > 0 ? Object.values(record.thirdPartyDelivery?.CM360 || {}).reduce((total, day) => total + (Number(day.impressions) || 0), 0) * rate / 1000 : 0;
  // A CPM or CPV line paces on what it delivered at its billing rate, like the rest of the dashboard.
  if (Number.isFinite(record.deliveredValue)) return Math.max(record.deliveredValue, dcmValue);
  return Math.max(Number(record.spend) || 0, dspSpend, dcmValue);
}

// CPA, ROAS and CPC mean nothing without spend: a week with none has no KPI rather than "$0".
const weekKpiValue = (kpi, totals) => ["CPA", "ROAS", "CPC"].includes(kpi) && !(totals.spend > 0) ? null : calculateKpi(kpi, totals);

function weekKpi(records, kpi, week, today, rates = {}) {
  const rows = records.map(record => lineWeek(record, week, today, rates[record.name]));
  if (rows.every(row => !row)) return null;
  const totals = totalsOf(rows);
  return { totals, kpi: weekKpiValue(kpi, totals) };
}

const goalText = (kpi, target) => kpi === "CPA" || kpi === "CPC" || kpi === "ROAS" ? `$${target}` : /CTR|VCR/.test(kpi) ? `${target}%` : String(target);
const mostCommon = values => [...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

/**
 * One campaign's row for the doc. `group` is a dashboard campaign (its lines in `records`); `log` is the brief log;
 * `alerts` are its open alerts. Returns the seven columns from LAST WEEK through NOTES, plus the facts behind them.
 */
export function campaignStatusRow({ group, log = [], alerts = [], today, kpiTolerance = 10, io = null, rates = {} }) {
  const { thisWeek, lastWeek } = statusWeeks(today);
  const records = group.records.filter(record => record.source !== "Manual" || Number(record.spend) > 0);
  const kpiName = String(mostCommon(records.map(record => record.kpi).filter(Boolean)) || "CTR").toUpperCase();
  const target = numberIn(mostCommon(records.map(record => record.target).filter(value => numberIn(value) !== null)));
  const now = weekKpi(records, kpiName, thisWeek, today, rates);
  const before = weekKpi(records, kpiName, lastWeek, today, rates);
  const lowerBetter = LOWER_IS_BETTER.has(kpiName);

  // Week over week.
  let change = "";
  if (now?.kpi && before?.kpi && before.kpi.value) {
    const delta = (now.kpi.value - before.kpi.value) / before.kpi.value * 100;
    const better = lowerBetter ? delta < 0 : delta > 0;
    change = Math.abs(delta) < 3 ? `${kpiName} steady` : `${kpiName} ${delta > 0 ? "up" : "down"} ${Math.abs(Math.round(delta))}% (${better ? "better" : "worse"})`;
  }
  if (now && before && before.totals.spend > 0) {
    const spendDelta = (now.totals.spend - before.totals.spend) / before.totals.spend * 100;
    if (Math.abs(spendDelta) >= 15) change = [change, `spend ${spendDelta > 0 ? "up" : "down"} ${Math.abs(Math.round(spendDelta))}%`].filter(Boolean).join(", ");
  }

  // Pacing across the campaign's lines, against their budgets to date.
  // A campaign on an IO paces its lines' spend together against the IO; otherwise each line against its own budget.
  const asOf = new Date(`${today}T12:00:00Z`);
  const spends = new Map(records.map(record => [record, spendToDate(record, rates[record.name])]));
  const totalSpend = records.reduce((total, record) => total + spends.get(record), 0);
  const ioPacing = io?.budget > 0 ? calculateSpendPacing({ budget: io.budget, spend: totalSpend, startDate: io.startDate, endDate: io.endDate }, asOf) : null;
  const pacingParts = ioPacing ? [] : records.map(record => ({ record, pacing: calculateSpendPacing({ ...record, spend: spends.get(record) }, asOf) })).filter(part => part.pacing);
  const spent = ioPacing ? totalSpend : pacingParts.reduce((total, part) => total + spends.get(part.record), 0);
  const expected = ioPacing ? ioPacing.expectedSpend : pacingParts.reduce((total, part) => total + part.pacing.expectedSpend, 0);
  const pacing = expected > 0 ? spent / expected * 100 : null;
  const budget = ioPacing ? io.budget : sum(pacingParts.map(part => ({ spend: Number(part.record.budget) })), "spend");

  // On track: pacing between 90% and 110% and the KPI within tolerance of its target.
  const kpiValue = now?.kpi?.value ?? null;
  const kpiOff = kpiValue !== null && target !== null ? (lowerBetter ? kpiValue > target * (1 + kpiTolerance / 100) : kpiValue < target * (1 - kpiTolerance / 100)) : false;
  const paceOff = pacing !== null && (pacing < 90 || pacing > 110);
  const paceFar = pacing !== null && (pacing < 80 || pacing > 120);
  const track = group.status === "completed" ? "Not Tracking" : (kpiOff && paceOff) || paceFar ? "Off Track" : kpiOff || paceOff ? "Watch" : "On Track";

  // Line by line this week, best and weakest on the KPI.
  const lineKpis = records.map(record => ({ name: lineName(record), kpi: weekKpiValue(kpiName, lineWeek(record, thisWeek, today, rates[record.name]) || {}) })).filter(line => line.kpi);
  const ranked = [...lineKpis].sort((a, b) => lowerBetter ? a.kpi.value - b.kpi.value : b.kpi.value - a.kpi.value);

  const weekItems = log.filter(entry => entry.client === group.client && ((entry.date >= thisWeek.from && entry.date <= today) || (entry.doneOn && entry.doneOn >= thisWeek.from)));
  const optimizations = weekItems.filter(entry => OPTIMIZATION.test(entry.text));
  const communication = weekItems.filter(entry => !OPTIMIZATION.test(entry.text));

  const performance = [];
  if (pacing !== null) performance.push(`Pacing ${Math.round(pacing)}% (${money(spent)} of ${money(budget)} spent).`);
  if (now?.kpi) performance.push(`${kpiName} ${now.kpi.formatted} this week${before?.kpi ? ` vs ${before.kpi.formatted} last week` : ""}${target !== null ? `, ${kpiOff ? "behind" : "meeting"} the ${goalText(kpiName, target)} goal` : ""}.`);
  if (ranked.length > 1 && ranked[0].kpi.value !== ranked.at(-1).kpi.value) performance.push(`Strongest: ${ranked[0].name} (${ranked[0].kpi.formatted}). Weakest: ${ranked.at(-1).name} (${ranked.at(-1).kpi.formatted}).`);
  for (const alert of alerts.slice(0, 2)) performance.push(`${alert.title}${alert.campaign && records.length > 1 ? ` on ${lineName(alert.campaign)}` : ""}: ${alert.detail}.`);
  for (const entry of optimizations.slice(0, 4)) performance.push(`${entry.done ? "Done" : short(entry.date)}: ${entry.text.replace(/\.$/, "")}.`);

  const notes = communication.slice(0, 5).map(entry => {
    const tags = [entry.done ? "done" : "", entry.source && !/morning brief/i.test(entry.source) ? entry.source.split(/\s+[·-]\s+/)[0] : ""].filter(Boolean);
    return `${short(entry.done && entry.doneOn ? entry.doneOn : entry.date)}: ${entry.text.replace(/\.$/, "")}${tags.length ? ` (${tags.join(", ")})` : ""}.`;
  });

  return {
    key: group.key, client: group.client, name: group.name, status: group.status,
    lastWeek: before?.kpi ? `${kpiName} ${before.kpi.formatted}` : "",
    thisWeek: now?.kpi ? `${kpiName} ${now.kpi.formatted}` : "",
    change, track, performance: performance.join(" "), updated: today, notes: notes.join("\n"),
    facts: { kpi: kpiName, target, pacing, spent, budget, thisWeek, lastWeek, now: now?.totals || null, before: before?.totals || null, optimizations, communication }
  };
}

// The doc's columns from On/Off Track through REPORT NAME, in its order.
export const STATUS_COLUMNS = [["track", "On/Off Track"], ["performance", "Performance Notes & Optimizations"], ["updated", "Date Last Updated"], ["notes", "NOTES"], ["cadence", "REPORTING CADENCE"], ["reportName", "REPORT NAME"]];

/** The six cells as one tab-separated row, to paste into the doc starting at On/Off Track. Cells with line breaks are quoted. */
export function statusRowTsv(row) {
  const cell = value => { const text = String(value ?? ""); return /[\t\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
  const updated = row.updated ? `${Number(row.updated.slice(5, 7))}/${Number(row.updated.slice(8, 10))}/${row.updated.slice(0, 4)}` : "";
  return STATUS_COLUMNS.map(([key]) => cell(key === "updated" ? updated : row[key])).join("\t");
}

/** A ChatGPT prompt with the week's facts, for notes written in your own words. */
export function statusPrompt(rows, today) {
  const { thisWeek } = statusWeeks(today);
  const blocks = rows.map(row => {
    const facts = row.facts;
    const lines = [
      `### ${row.name} (${row.client})`,
      `- KPI: ${facts.kpi}${facts.target !== null ? `, goal ${facts.target}` : ""}. Last week: ${row.lastWeek || "no data"}. This week: ${row.thisWeek || "no data"}. Change: ${row.change || "—"}.`,
      facts.pacing !== null ? `- Pacing ${Math.round(facts.pacing)}%: ${money(facts.spent)} of ${money(facts.budget)} spent.` : "- Pacing: unknown.",
      `- Dashboard's call: ${row.track}.`,
      `- Dashboard notes: ${row.performance || "none"}`,
      ...facts.optimizations.map(entry => `- Optimization item (${entry.date}${entry.done ? ", done" : ""}): ${entry.text}`),
      ...facts.communication.map(entry => `- Client/communication item (${entry.date}${entry.done ? ", done" : ""}${entry.source ? `, ${entry.source}` : ""}): ${entry.text}`)
    ];
    return lines.join("\n");
  });
  return [
    `Write my weekly status doc update for the week of ${short(thisWeek.from)} to ${short(thisWeek.to)}. For each campaign below, write two cells:`,
    "1. Performance Notes & Optimizations: 1 to 3 short sentences on how the campaign performed this week against its goal and pacing, and any optimizations made or planned.",
    "2. NOTES: 1 to 3 short sentences on client communication and what happened or got done this week. Leave it blank if nothing happened.",
    "Keep it plain and specific, use the numbers given, and don't invent anything that isn't below. Give each campaign as its name, then the two cells.",
    "",
    ...blocks
  ].join("\n");
}

/** Mondays (and Tuesdays, if it slipped), until you mark the week done. */
export function statusDue(drafts, today) {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  return [1, 2].includes(weekday) && !drafts?.[weekKey(today)]?.doneAt;
}

const words = text => new Set(String(text ?? "").toLowerCase().replace(/zca-\d+_?/g, " ").split(/[^a-z0-9]+/).filter(word => word.length > 2 && !["zeta", "global", "the", "and", "media", "campaign", "display", "2025", "2026", "2027"].includes(word)));

/**
 * Reads the team status doc (every sheet) for what carries over week to week: each campaign's reporting cadence and
 * report name, and last week's notes. Rows match dashboard campaigns by the words in CLIENT/ CAMPAIGN/ZETA ID.
 */
export function readStatusDoc(sheets, groups) {
  const found = {};
  for (const rows of sheets) {
    const headerIndex = rows.findIndex(row => row.some(cell => /performance notes/i.test(String(cell ?? ""))));
    if (headerIndex < 0) continue;
    const header = rows[headerIndex].map(cell => String(cell ?? "").toLowerCase());
    const col = test => header.findIndex(test);
    const at = { name: col(text => /client\s*\/\s*campaign/.test(text)), track: col(text => /on\s*\/\s*off track/.test(text)), performance: col(text => /performance notes/.test(text)), notes: col(text => /^notes$/.test(text.trim())), cadence: col(text => /reporting cadence/.test(text)), reportName: col(text => /report name/.test(text)) };
    if (at.name < 0) continue;
    for (const row of rows.slice(headerIndex + 1)) {
      const name = String(row[at.name] ?? "").trim();
      if (!name) continue;
      const rowWords = words(name);
      const scored = groups.map(group => {
        const groupWords = new Set([...words(group.name), ...words(group.client)]);
        return [group, [...rowWords].filter(word => groupWords.has(word)).length / Math.max(1, Math.min(rowWords.size, groupWords.size))];
      }).sort((a, b) => b[1] - a[1]);
      const [best, score] = scored[0] || [];
      if (!best || score < 0.5 || (scored[1] && scored[1][1] === score)) continue;
      const text = key => at[key] >= 0 ? String(row[at[key]] ?? "").trim() : "";
      if (!found[best.key] || score > found[best.key].score) found[best.key] = { score, docName: name, cadence: text("cadence"), reportName: text("reportName"), lastTrack: text("track"), lastPerformance: text("performance"), lastNotes: text("notes") };
    }
  }
  return found;
}
