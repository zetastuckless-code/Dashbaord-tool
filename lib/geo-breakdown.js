import { normalizeHeaderText } from "./header-mapping.js";

// "Geo Targeting Performance" tables split each media format into regions ("Standard Display" → WPA, CPA, SEPA …).
// The first table covers the whole flight; tables after it, each under a month name, hold that month alone.

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
// Report shorthand for a format, written out the way insertion orders name it.
const FORMAT_NAMES = { olv: "Online Video", ctv: "Connected TV" };
const DAY_MS = 86_400_000;
const HISTORY_KEYS = ["spend", "impressions", "clicks", "conversions"];

const text = value => String(value ?? "").trim();
const isBlank = value => value === null || value === undefined || text(value) === "";
function numberValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = text(value);
  if (!raw || raw.startsWith("#")) return null;
  const number = Number(raw.replace(/[$,%\s]/g, ""));
  return Number.isFinite(number) ? number : null;
}
const round = value => Number(value.toFixed(2));
const dayBefore = iso => new Date(Date.parse(`${iso}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
const lastDayOf = (year, month) => new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

export const formatDisplayName = format => FORMAT_NAMES[normalizeHeaderText(format)] || format;

function columnsOf(row) {
  const headers = row.map(normalizeHeaderText);
  const find = names => names.map(name => headers.indexOf(name)).find(index => index >= 0) ?? -1;
  return {
    label: headers.findIndex(header => ["tactic", "geo", "region", "market", "dma"].includes(header)),
    impressions: find(["impressions"]), clicks: find(["clicks"]), spend: find(["spend", "media_cost"]), budget: find(["budget", "io_budget"]),
    videoStarts: find(["video_starts", "video_plays"]), videoCompletions: find(["video_completes", "video_completions"]), conversions: find(["conversions", "total_conversions"])
  };
}

/** Each geo table: its period (null for the whole flight, else a month number) and its rows keyed "Format||Region". */
function readTables(rows) {
  const tables = [];
  rows.forEach((row, index) => {
    if (!row.some(value => normalizeHeaderText(value) === "geo_targeting_performance")) return;
    const headerIndex = rows.slice(index + 1, index + 4).findIndex(candidate => columnsOf(candidate).label >= 0 && columnsOf(candidate).spend >= 0);
    if (headerIndex < 0) return;
    const header = index + 1 + headerIndex;
    const columns = columnsOf(rows[header]);
    // The heading above the title ("Overall", "June") says which period the table covers.
    const period = rows.slice(Math.max(0, index - 3), index).reverse().map(candidate => candidate.map(text).find(Boolean)).find(Boolean) || "";
    const month = MONTHS.indexOf(period.toLowerCase());
    const lines = new Map();
    let format = "";
    let blanks = 0;
    for (const dataRow of rows.slice(header + 1)) {
      const label = text(dataRow[columns.label]);
      if (!label && dataRow.every(isBlank)) { if (++blanks >= 2) break; continue; }
      blanks = 0;
      if (normalizeHeaderText(label) === "geo_targeting_performance" || normalizeHeaderText(label) === normalizeHeaderText(rows[header][columns.label])) break;
      if (!label || /^total$/i.test(label)) continue;
      const spend = numberValue(dataRow[columns.spend]);
      const impressions = numberValue(dataRow[columns.impressions]);
      // A label with no numbers beside it names the media format of the rows under it.
      if (spend === null && impressions === null) { format = label; continue; }
      if (!format) continue;
      const pick = key => columns[key] >= 0 ? numberValue(dataRow[columns[key]]) : null;
      lines.set(`${format}||${label}`, { format, region: label, spend: spend ?? 0, impressions, clicks: pick("clicks"), budget: pick("budget"), videoStarts: pick("videoStarts"), videoCompletions: pick("videoCompletions"), conversions: pick("conversions") });
    }
    if (lines.size) tables.push({ month: month >= 0 ? month + 1 : null, lines });
  });
  return tables;
}

/** Cumulative totals at each month's end, from zero the day before the first month, capped at the report's end. */
function monthlyHistory(months, key, year, endDate) {
  if (!year || !months.length) return "";
  const running = Object.fromEntries(HISTORY_KEYS.map(name => [name, 0]));
  const entry = date => ({ date, ...Object.fromEntries(HISTORY_KEYS.map(name => [name, round(running[name])])) });
  const history = [entry(dayBefore(`${year}-${String(months[0].month).padStart(2, "0")}-01`))];
  for (const table of months) {
    history.push(entry(dayBefore(`${year}-${String(table.month).padStart(2, "0")}-01`)));
    const line = table.lines.get(key);
    for (const name of HISTORY_KEYS) running[name] += line?.[name] ?? 0;
    const monthEnd = lastDayOf(year, table.month);
    history.push(entry(endDate && monthEnd > endDate ? endDate : monthEnd));
  }
  const unique = history.filter((item, index) => index === 0 || item.date > history[index - 1].date);
  return unique.length > 1 ? JSON.stringify(unique) : "";
}

/**
 * The region lines of a summary tab, or [] when it has no geo table. Each line is named like the insertion order
 * names it ("Standard Display WPA", "Online Video SEPA") and carries its monthly history when the tab has month tables.
 */
export function extractGeoLines(rows, { base, goals = {} }) {
  const tables = readTables(rows);
  const overall = tables.find(table => table.month === null);
  if (!overall) return [];
  const year = Number(String(base.start_date || base.end_date || "").slice(0, 4)) || null;
  const months = tables.filter(table => table.month !== null).sort((a, b) => a.month - b.month);
  return [...overall.lines.entries()].map(([key, line]) => {
    const name = `${formatDisplayName(line.format)} ${line.region}`;
    const video = (line.videoStarts ?? 0) > 0;
    const kpi = video ? "VCR" : line.conversions > 0 ? "CPA" : "CTR";
    const value = kpi === "VCR" ? line.videoCompletions / line.videoStarts * 100 : kpi === "CPA" ? line.spend / line.conversions : line.impressions > 0 ? (line.clicks ?? 0) / line.impressions * 100 : 0;
    const goal = numberValue(goals[normalizeHeaderText(line.format)]);
    const target = goal === null ? "Not provided" : kpi === "CPA" ? `$${goal.toFixed(2)}` : `${Number((Math.abs(goal) <= 1 ? goal * 100 : goal).toFixed(3))}%`;
    return {
      ...base,
      campaign: `${base.campaign_group} — ${name}`,
      campaign_id: "",
      channel: line.format,
      spend: round(line.spend),
      budget: line.budget ?? "",
      pacing: line.budget ? line.spend / line.budget * 100 : "",
      kpi,
      kpi_value: kpi === "CPA" ? `$${value.toFixed(2)}` : `${Number(value.toFixed(3))}%`,
      kpi_target: target,
      first_party_spend: round(line.spend), third_party_spend: "",
      impressions: line.impressions ?? "", clicks: line.clicks ?? "", conversions: line.conversions ?? "", revenue: "",
      video_starts: line.videoStarts ?? "", video_completions: line.videoCompletions ?? "", dsp_impressions: "",
      history: monthlyHistory(months, key, year, base.end_date),
      line_aliases: name === `${line.format} ${line.region}` ? "" : `${line.format} ${line.region}`
    };
  });
}

/** Goals by line from the summary's own table ("Line Item … Goal"), keyed by normalized line name. */
export function summaryGoals(rows) {
  const goals = {};
  rows.slice(0, 60).forEach((row, index) => {
    const headers = row.map(normalizeHeaderText);
    const label = headers.findIndex(header => ["line_item", "line"].includes(header));
    const goal = headers.indexOf("goal");
    if (label < 0 || goal < 0) return;
    for (const dataRow of rows.slice(index + 1, index + 15)) {
      const name = text(dataRow[label]);
      if (!name || /^total$/i.test(name)) break;
      if (numberValue(dataRow[goal]) !== null) goals[normalizeHeaderText(name)] = dataRow[goal];
    }
  });
  return goals;
}

/**
 * Swaps a summary's format rows ("Standard Display") for their region lines when the tab breaks them out and the
 * regions add up to the row, so each line lines up with an insertion order that is bought by region.
 */
export function splitByGeo(rows, summary) {
  const withSpend = summary.filter(row => Number(row.spend) > 0);
  if (!withSpend.length) return summary;
  const first = withSpend[0];
  const group = String(first.campaign).split(" — ")[0];
  const lines = extractGeoLines(rows, { base: { ...first, campaign_group: group }, goals: summaryGoals(rows) });
  if (!lines.length) return summary;
  const byFormat = new Map();
  for (const line of lines) byFormat.set(normalizeHeaderText(line.channel), [...(byFormat.get(normalizeHeaderText(line.channel)) || []), line]);
  return summary.flatMap(row => {
    const label = normalizeHeaderText(String(row.campaign).split(" — ").at(-1));
    const regions = byFormat.get(label);
    if (!regions || String(row.campaign).split(" — ")[0] !== group) return [row];
    const total = regions.reduce((sum, line) => sum + line.spend, 0);
    return Math.abs(total - Number(row.spend)) <= Math.max(1, Number(row.spend) * 0.02) ? regions : [row];
  });
}
