import { normalizeHeaderText } from "./header-mapping.js";
import { parseDeliveryDate } from "./daily-delivery-import.js";
import { campaignGroupName, groupKey } from "./campaign-groups.js";
import { makeUpload, mergeUploads } from "./uploads.js";

const SCAN_LIMIT = 30;
export const MAX_LINE_ITEMS_PER_CAMPAIGN = 500;

const LINE_ALIASES = Object.freeze({
  name: ["line_item", "line_item_tactic", "line_item_name", "tactic", "line"],
  id: ["line_item_id", "lineitem_id", "line_id"],
  campaign: ["campaign", "campaign_name", "io", "insertion_order"],
  status: ["status"],
  impressions: ["impressions", "imps", "imps_ftd", "impressions_ftd", "dsp_impressions"],
  clicks: ["clicks", "clicks_ftd"],
  spend: ["spend", "spend_ftd", "media_cost", "cost", "dsp_spend"],
  conversions: ["conversions", "total_conversions", "conversions_ftd"],
  revenue: ["revenue", "total_revenue"],
  video_starts: ["video_starts", "video_plays"],
  video_completions: ["video_completions", "video_completes", "video_completes_ftd"],
  budget: ["flight_bdgt", "flight_budget", "flight_bdgt_", "budget", "io_budget", "line_item_budget"],
  start_date: ["start_date", "flight_start", "start"],
  end_date: ["end_date", "flight_end", "end"],
  rate: ["rate", "unit_rate", "cpm", "pricing_rate"],
  rate_type: ["pricing", "pricing_model", "rate_type"]
});
const LOOKUP = new Map(Object.entries(LINE_ALIASES).flatMap(([field, names]) => names.map(name => [name, field])));
const NUMERIC = ["impressions", "clicks", "spend", "conversions", "revenue", "video_starts", "video_completions", "budget", "rate"];

const fieldFor = header => LOOKUP.get(normalizeHeaderText(header)) ?? null;

function number(value) {
  if (typeof value === "number") return value;
  const text = String(value ?? "").replace(/[$,%\s]/g, "");
  if (text === "" || /^-+$/.test(text)) return null;
  return Number(text);
}

/**
 * Detects a DSP line-item export: a Line Item column together with a Line Item ID or the
 * grid's flight-budget / spend-to-date columns, and no Date column (that is a daily report).
 */
export function detectLineItemExport(rows) {
  for (let index = 0; index < Math.min(rows.length, SCAN_LIMIT); index += 1) {
    const fields = rows[index].map(fieldFor);
    if (!fields.includes("name")) continue;
    const normalized = rows[index].map(normalizeHeaderText);
    if (normalized.includes("date") || normalized.includes("day")) continue;
    const hasMeasures = fields.includes("impressions") || fields.includes("spend");
    const gridLike = fields.includes("id") || normalized.some(header => /(^|_)ftd$/.test(header));
    if (hasMeasures && gridLike) {
      const columns = {};
      fields.forEach((field, column) => { if (field && !(field in columns)) columns[field] = column; });
      return { headerRow: index, columns, headers: rows[index] };
    }
  }
  return null;
}

const stripAdPrefix = value => String(value ?? "").replace(/^zca-\d+\s*[_:-]\s*/i, "").trim();
export const normalizeCampaignKey = value => stripAdPrefix(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function shortLineName(name, campaign) {
  const base = stripAdPrefix(campaign);
  let text = stripAdPrefix(name);
  if (base && text.toLowerCase().startsWith(base.toLowerCase())) text = text.slice(base.length).replace(/^[\s_\-–—:]+/, "").trim();
  return text || String(name ?? "").trim();
}

/** Parses the export into one entry per source campaign, each with its line items. */
export function parseLineItemExport(rows, detection, { fileName = "", asOf = new Date() } = {}) {
  const { headerRow, columns } = detection;
  const errors = [];
  const byCampaign = new Map();
  const today = asOf.toISOString().slice(0, 10);
  for (let index = headerRow + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row.some(value => value !== null && String(value).trim() !== "")) continue;
    const name = String(row[columns.name] ?? "").trim();
    if (!name || /^(total|grand total)$/i.test(name)) continue;
    const rowNumber = index + 1;
    const item = { id: columns.id !== undefined ? String(row[columns.id] ?? "").trim() : "", name, asOf: today };
    let valid = true;
    for (const field of NUMERIC) {
      if (!(field in columns)) continue;
      const value = number(row[columns[field]]);
      if (value !== null && (!Number.isFinite(value) || value < 0)) { errors.push(`Row ${rowNumber}: ${field.replace("_", " ")} must be a non-negative number.`); valid = false; break; }
      if (value !== null) item[field.replace(/_(\w)/g, (_, letter) => letter.toUpperCase())] = value;
    }
    if (!valid) continue;
    for (const field of ["start_date", "end_date"]) {
      if (!(field in columns) || row[columns[field]] === null || String(row[columns[field]]).trim() === "") continue;
      const date = parseDeliveryDate(row[columns[field]]);
      if (!date) { errors.push(`Row ${rowNumber}: "${row[columns[field]]}" is not a valid ${field.replace("_", " ")}.`); valid = false; break; }
      item[field === "start_date" ? "startDate" : "endDate"] = date;
    }
    if (!valid) continue;
    if ("status" in columns && String(row[columns.status] ?? "").trim()) item.status = String(row[columns.status]).trim();
    if ("rate_type" in columns && String(row[columns.rate_type] ?? "").trim()) item.rateType = String(row[columns.rate_type]).trim().toUpperCase();
    const campaignName = columns.campaign !== undefined ? String(row[columns.campaign] ?? "").trim() : "";
    const key = normalizeCampaignKey(campaignName) || normalizeCampaignKey(fileName.replace(/\.[^.]+$/, "")) || "export";
    const entry = byCampaign.get(key) || { key, sourceName: campaignName || fileName.replace(/\.[^.]+$/, ""), lineItems: [] };
    item.name = shortLineName(name, campaignName);
    item.id = item.id || name;
    entry.lineItems.push(item);
    byCampaign.set(key, entry);
  }
  const campaigns = [...byCampaign.values()].map(entry => {
    const counts = new Map();
    entry.lineItems.forEach(item => counts.set(item.name.toLowerCase(), (counts.get(item.name.toLowerCase()) || 0) + 1));
    // Distinct line items can share a display name; keep them distinguishable by ID.
    const lineItems = entry.lineItems.map(item => counts.get(item.name.toLowerCase()) > 1 ? { ...item, name: `${item.name} (${item.id})` } : item);
    return { ...entry, lineItems };
  });
  const total = campaigns.reduce((sum, entry) => sum + entry.lineItems.length, 0);
  if (!total && !errors.length) errors.push("No line items were found below the header.");
  return { kind: "line-items", campaigns, valid: errors.length === 0 && total > 0, errors: errors.slice(0, 8), lineItemCount: total };
}

const VIDEO_PATTERN = /olv|video|youtube|ctv|\bott\b/i;

/** Chooses which record of a multi-line campaign a line item belongs to, by its name. */
export function assignRecordIndex(records, lineName) {
  const text = String(lineName ?? "");
  const score = record => {
    const haystack = `${record.name} ${record.channel ?? ""}`.toLowerCase();
    if (VIDEO_PATTERN.test(text)) return VIDEO_PATTERN.test(haystack) || record.kpi === "VCR" ? 2 : 0;
    if (/native/i.test(text)) return /native/.test(haystack) ? 2 : 0;
    return VIDEO_PATTERN.test(haystack) || /native/.test(haystack) ? 0 : 1;
  };
  let best = 0;
  records.forEach((record, index) => { if (score(record) > score(records[best])) best = index; });
  return best;
}

/** Finds the dashboard record(s) for a source campaign: saved link, then normalized name. Returns indexes or []. */
export function matchLineItemCampaign(campaigns, entry, links = {}) {
  const linked = links[entry.key];
  if (Number.isInteger(linked) && campaigns[linked]) return [linked];
  const saved = campaigns.map((campaign, index) => (campaign.dspCampaignKeys || []).includes(entry.key) ? index : -1).filter(index => index >= 0);
  if (saved.length) return saved;
  const exact = campaigns.map((campaign, index) => [campaign, index]).filter(([campaign]) => normalizeCampaignKey(campaignGroupName(campaign)) === entry.key || normalizeCampaignKey(campaign.name) === entry.key);
  if (exact.length) return exact.map(([, index]) => index);
  const loose = campaigns.map((campaign, index) => [campaign, index]).filter(([campaign]) => {
    const name = normalizeCampaignKey(campaignGroupName(campaign));
    return name.length > 8 && (entry.key.includes(name) || name.includes(entry.key));
  });
  const groups = new Set(loose.map(([campaign]) => groupKey(campaign)));
  return groups.size === 1 ? loose.map(([, index]) => index) : [];
}

function mergeLineItems(existing = [], incoming) {
  const merged = [...existing];
  for (const item of incoming) {
    const match = merged.findIndex(current => String(current.id).toLowerCase() === String(item.id).toLowerCase());
    if (match === -1) merged.push(item); else merged[match] = { ...merged[match], ...item };
  }
  return merged.slice(0, MAX_LINE_ITEMS_PER_CAMPAIGN);
}

/** Attaches parsed line items to matched records (idempotent by line item ID); reports unmatched source campaigns. */
export function applyLineItems(campaigns, parsed, links = {}, { fileName = "" } = {}) {
  const next = campaigns.map(campaign => ({ ...campaign }));
  const matched = [];
  const unmatched = [];
  for (const entry of parsed.campaigns) {
    const indexes = matchLineItemCampaign(next, entry, links);
    if (!indexes.length) { unmatched.push(entry); continue; }
    const buckets = new Map(indexes.map(index => [index, []]));
    for (const item of entry.lineItems) {
      const target = indexes.length === 1 ? indexes[0] : indexes[assignRecordIndex(indexes.map(index => next[index]), item.name)];
      buckets.get(target).push(item);
    }
    for (const [index, items] of buckets) {
      if (!items.length) continue;
      next[index] = { ...next[index], lineItems: mergeLineItems(next[index].lineItems, items), dspCampaignKeys: [...new Set([...(next[index].dspCampaignKeys || []), entry.key])] };
      if (fileName) next[index].uploads = mergeUploads(next[index].uploads, [makeUpload({ kind: "line-items", fileName, source: "DSP", lineIds: items.map(item => String(item.id ?? "")) })]);
      matched.push({ entry, index, campaign: next[index].name, client: next[index].client, campaignId: next[index].campaignId || "", count: items.length });
    }
  }
  return { campaigns: next, matched, unmatched };
}
