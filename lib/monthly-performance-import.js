import { normalizeHeaderText } from "./header-mapping.js";
import { NATIVE_HEADERS } from "./native-workbook-import.js";

const SCAN_LIMIT = 12;

function numeric(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value ?? "").trim();
  if (!text || text === "-" || text.startsWith("#")) return null;
  const number = Number(text.replace(/[$,%\s,]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function isoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  const iso = `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

function dateRangeIn(text) {
  const match = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/.exec(String(text ?? ""));
  return match ? { startDate: isoDate(match[1]), endDate: isoDate(match[2]) } : { startDate: null, endDate: null };
}

/**
 * Finds a monthly performance tab (Month, Media Format, Line, Impressions, Spend ...), such as the
 * "YouTube Performance" sheet whose rows are one per month with a Total row beneath.
 */
export function detectMonthlyPerformance(rows) {
  for (let index = 0; index < Math.min(rows.length, SCAN_LIMIT); index += 1) {
    const headers = rows[index].map(normalizeHeaderText);
    if (headers.includes("month") && headers.includes("media_format") && headers.includes("line") && headers.includes("impressions") && headers.includes("spend")) {
      // Some templates split a header across two rows (e.g. "Conversions (Page ...)" above a blank cell).
      const above = (rows[index - 1] || []).map(normalizeHeaderText);
      const columns = Object.fromEntries(headers.map((header, column) => [header || (above[column]?.startsWith("conversions") ? "conversions" : `col${column}`), column]));
      return { headerRow: index, columns, aboveRow: index > 0 ? rows[index - 1] : [] };
    }
  }
  return null;
}

function formatKpi(kpi, value) {
  if (kpi === "CPA") return `$${Number(value ?? 0).toFixed(2)}`;
  if (kpi === "ROAS") return `${Number((value ?? 0).toFixed(2))}x`;
  return `${Number(((value ?? 0) * 100).toFixed(3))}%`;
}

/**
 * Builds one canonical campaign row per media format from a monthly tab: the Total row when the tab has one,
 * otherwise the sum of its month rows. This is the full-flight view, unlike a summary tab that may show one month.
 */
export function extractMonthlyPerformance(rows, detection, { fileName = "", client = "", sheetName = "" } = {}) {
  const { headerRow, columns } = detection;
  const metadataRows = rows.slice(0, headerRow);
  const clientCell = metadataRows.map(row => String(row[1] ?? "").trim()).find(text => text && !/^note\b/i.test(text)) || "";
  const range = metadataRows.map(row => dateRangeIn(row.slice(1, 4).join(" "))).find(found => found.startDate) || { startDate: null, endDate: null };
  const get = (row, key) => key in columns ? row[columns[key]] : null;
  const groups = new Map();
  let total = null;
  for (let index = headerRow + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const format = String(get(row, "media_format") ?? "").trim();
    if (!format) { if (groups.size) break; continue; }
    if (/^total$/i.test(format)) { total = row; break; }
    const line = String(get(row, "line") ?? "").trim();
    if (!line) continue;
    const entry = groups.get(format.toLowerCase()) || { format, line, rows: [] };
    entry.rows.push(row);
    groups.set(format.toLowerCase(), entry);
  }
  const campaigns = [];
  for (const entry of groups.values()) {
    const sum = key => entry.rows.reduce((result, row) => { const value = numeric(get(row, key)); return value === null ? result : (result ?? 0) + value; }, null);
    const useTotal = total && groups.size === 1;
    const read = key => useTotal ? numeric(get(total, key)) : sum(key);
    const spend = read("spend");
    if (spend === null) continue;
    const impressions = read("impressions");
    const clicks = read("clicks");
    const conversions = read("conversions");
    const budget = read("io_budget");
    const kpi = conversions !== null && conversions > 0 ? "CPA" : "CTR";
    const kpiValue = kpi === "CPA" ? spend / conversions : impressions > 0 && clicks !== null ? clicks / impressions : null;
    campaigns.push({
      client: client || clientCell || "Imported report",
      campaign: `${entry.line} — ${entry.format}`,
      campaign_id: "",
      channel: entry.format,
      start_date: range.startDate || "",
      end_date: range.endDate || "",
      data_as_of: range.endDate || "",
      spend,
      budget: budget ?? "",
      pacing: budget ? spend / budget * 100 : "",
      kpi,
      kpi_value: formatKpi(kpi, kpiValue),
      kpi_target: "Not provided",
      source: "Zeta Global",
      billing_source: "DSP",
      first_party_spend: spend,
      third_party_spend: "",
      impressions: impressions ?? "",
      clicks: clicks ?? "",
      conversions: conversions ?? "",
      revenue: "",
      video_starts: "",
      video_completions: "",
      dsp_impressions: "",
      source_sheet: sheetName,
      source_row: headerRow + 1
    });
  }
  return campaigns.map(campaign => Object.fromEntries(NATIVE_HEADERS.map(header => [header, campaign[header]])));
}
