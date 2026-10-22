import { normalizeHeaderText } from "./header-mapping.js";
import { NATIVE_HEADERS } from "./native-workbook-import.js";
import { parseDeliveryDate } from "./daily-delivery-import.js";

const SCAN_ROWS = 6;
const MAX_LINES = 60;
const DAY_MS = 86_400_000;
const isLineHeader = header => /^line(_item)?\d*$/.test(header) || /^placement(_name)?\d*$/.test(header);

function numeric(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value ?? "").trim();
  if (!text || text === "-" || text.startsWith("#")) return null;
  const number = Number(text.replace(/[$,%\s]/g, ""));
  return Number.isFinite(number) ? number : null;
}

/** "ZCA-12572_Dieste Dallas-Carter BloodCare-Q3-Q4 2026" → "Dieste Dallas-Carter BloodCare-Q3-Q4 2026". */
export const cleanCampaignLabel = value => String(value ?? "").trim().replace(/^[A-Z]{2,6}-\d+_/, "").trim();

/**
 * Finds a raw delivery table: one row per day (and line), with Date, Spend, Impressions, and at least one line or
 * placement column. Duplicate header names are kept apart by column index.
 */
export function detectRawLineTable(rows) {
  for (let index = 0; index < Math.min(rows.length, SCAN_ROWS); index += 1) {
    const headers = rows[index].map(normalizeHeaderText);
    const find = names => headers.findIndex(header => names.includes(header));
    const date = find(["date", "day"]);
    const spend = find(["spend", "media_cost", "dsp_spend"]);
    const impressions = find(["impressions"]);
    const lineColumns = headers.map((header, column) => isLineHeader(header) ? column : -1).filter(column => column >= 0);
    if (date >= 0 && spend >= 0 && impressions >= 0 && lineColumns.length) {
      return {
        headerRow: index, date, spend, impressions, lineColumns,
        campaign: find(["campaign", "campaign_name"]),
        clicks: find(["clicks"]),
        conversions: find(["total_conversions", "conversions", "offline_conversions"]),
        starts: find(["starts", "video_starts"]),
        completions: find(["completions", "completes", "video_completions"])
      };
    }
  }
  return null;
}

const weekEnd = iso => { const day = new Date(`${iso}T00:00:00Z`).getUTCDay(); return new Date(Date.parse(`${iso}T00:00:00Z`) + ((6 - day + 7) % 7) * DAY_MS).toISOString().slice(0, 10); };
const dayBefore = iso => new Date(Date.parse(`${iso}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);

/**
 * Turns a raw delivery table into one canonical row per campaign line. A line is identified by every line or
 * placement column that varies (2 to 60 values); its name is the shortest of those values and the rest are kept as
 * aliases, so "…Display Q3_NY" and "New York" are one line. Each line carries cumulative totals at every week's end.
 */
export function extractRawLines(rows, detection, { client = "", campaign = "", sheetName = "" } = {}) {
  const body = rows.slice(detection.headerRow + 1).filter(row => parseDeliveryDate(row[detection.date]));
  const varying = detection.lineColumns.filter(column => {
    const values = new Set(body.map(row => String(row[column] ?? "").trim()).filter(Boolean));
    return values.size >= 2 && values.size <= MAX_LINES;
  });
  const lineColumns = varying.length ? varying : detection.lineColumns.slice(0, 1);
  const groups = new Map();
  for (const row of body) {
    const campaignLabel = detection.campaign >= 0 ? cleanCampaignLabel(row[detection.campaign]) : "";
    const values = lineColumns.map(column => String(row[column] ?? "").trim()).filter(Boolean);
    if (!values.length) continue;
    const key = [campaignLabel, ...values].join("||").toLowerCase();
    if (!groups.has(key)) groups.set(key, { campaignLabel, values, days: new Map() });
    const date = parseDeliveryDate(row[detection.date]);
    const day = groups.get(key).days.get(date) || { spend: 0, impressions: 0, clicks: 0, conversions: 0, starts: 0, completions: 0 };
    day.spend += numeric(row[detection.spend]) ?? 0;
    day.impressions += numeric(row[detection.impressions]) ?? 0;
    if (detection.clicks >= 0) day.clicks += numeric(row[detection.clicks]) ?? 0;
    if (detection.conversions >= 0) day.conversions += numeric(row[detection.conversions]) ?? 0;
    if (detection.starts >= 0) day.starts += numeric(row[detection.starts]) ?? 0;
    if (detection.completions >= 0) day.completions += numeric(row[detection.completions]) ?? 0;
    groups.get(key).days.set(date, day);
  }
  const round = value => Number(value.toFixed(2));
  // Lines are named by their shortest value; when two share it ("Houston" for both the paid and the added-value line),
  // they take their longest value instead so neither is merged into the other.
  const shortest = group => [...group.values].sort((a, b) => a.length - b.length)[0];
  const counts = new Map();
  for (const group of groups.values()) counts.set(`${group.campaignLabel}||${shortest(group)}`.toLowerCase(), (counts.get(`${group.campaignLabel}||${shortest(group)}`.toLowerCase()) || 0) + 1);
  const longest = group => [...group.values].sort((a, b) => b.length - a.length)[0];
  // The text every longest value starts with ("…Display Q3_") says nothing about the line, so it is dropped.
  const longValues = [...groups.values()].map(longest);
  let prefix = longValues[0] || "";
  for (const value of longValues) while (prefix && !value.startsWith(prefix)) prefix = prefix.slice(0, -1);
  const nameOf = group => {
    if (counts.get(`${group.campaignLabel}||${shortest(group)}`.toLowerCase()) === 1) return shortest(group);
    const trimmed = longest(group).slice(prefix.length).replace(/^[\s_\-–—:]+/, "").trim();
    return trimmed || longest(group);
  };
  return [...groups.values()].map(group => {
    const dates = [...group.days.keys()].sort();
    const totals = { spend: 0, impressions: 0, clicks: 0, conversions: 0, starts: 0, completions: 0 };
    const history = [{ date: dayBefore(dates[0]), spend: 0, impressions: 0, clicks: 0, conversions: 0 }];
    dates.forEach((date, index) => {
      const day = group.days.get(date);
      for (const key of Object.keys(totals)) totals[key] += day[key];
      const last = index === dates.length - 1;
      if (last || weekEnd(date) !== weekEnd(dates[index + 1])) history.push({ date, spend: round(totals.spend), impressions: round(totals.impressions), clicks: round(totals.clicks), conversions: round(totals.conversions) });
    });
    const name = nameOf(group);
    const reportCampaign = group.campaignLabel || campaign || client || "Imported report";
    const conversions = detection.conversions >= 0 ? totals.conversions : null;
    const kpi = conversions > 0 ? "CPA" : "CTR";
    const kpiValue = kpi === "CPA" ? `$${(totals.spend / conversions).toFixed(2)}` : `${totals.impressions > 0 ? Number((totals.clicks / totals.impressions * 100).toFixed(3)) : 0}%`;
    const row = {
      client: client || "Imported report", campaign: `${reportCampaign} — ${name}`, campaign_id: "", channel: "",
      start_date: "", end_date: "", data_as_of: dates.at(-1), spend: round(totals.spend), budget: "", pacing: "",
      kpi, kpi_value: kpiValue, kpi_target: "Not provided", source: "Zeta Global", billing_source: "DSP",
      first_party_spend: round(totals.spend), third_party_spend: "", impressions: Math.round(totals.impressions), clicks: detection.clicks >= 0 ? Math.round(totals.clicks) : "",
      conversions: conversions === null ? "" : Math.round(conversions), revenue: "",
      video_starts: detection.starts >= 0 ? Math.round(totals.starts) : "", video_completions: detection.completions >= 0 ? Math.round(totals.completions) : "",
      dsp_impressions: "", source_sheet: sheetName, source_row: detection.headerRow + 1,
      history: JSON.stringify(history), line_aliases: group.values.filter(value => value !== name).join(" | "),
      delivery_start: dates[0], delivery_end: dates.at(-1)
    };
    return Object.fromEntries(NATIVE_HEADERS.map(header => [header, row[header] ?? ""]));
  });
}
