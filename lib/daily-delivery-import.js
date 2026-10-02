import { normalizeHeaderText } from "./header-mapping.js";
import { mergePerformanceSnapshots } from "./performance-snapshots.js";

export const MAX_DAILY_DAYS_PER_SOURCE = 400;
const SNAPSHOT_DAYS = 90;
const SOURCE_PREFERENCE = ["CM360", "Flashtalking"];
const SCAN_LIMIT = 30;

const DAILY_ALIASES = Object.freeze({
  date: ["date", "day", "report_date", "impression_date"],
  campaign: ["campaign", "campaign_name"],
  campaign_id: ["campaign_id", "dcm_campaign_id", "cm360_campaign_id", "flashtalking_campaign_id"],
  advertiser: ["advertiser", "advertiser_name", "client"],
  impressions: ["impressions", "imps", "served_impressions", "total_ads_requested", "ad_impressions"],
  clicks: ["clicks", "click_count", "total_clicks"],
  spend: ["media_cost", "spend", "cost", "total_cost", "total_media_cost"],
  video_starts: ["video_starts", "total_video_start", "total_video_starts", "video_plays"],
  video_completions: ["video_completions", "total_video_completes", "video_completes", "completed_views"],
  conversions: ["total_conversions", "conversions", "actions"],
  revenue: ["total_revenue", "revenue", "conversion_revenue"]
});
const ALIAS_LOOKUP = new Map(Object.entries(DAILY_ALIASES).flatMap(([field, names]) => names.map(name => [name, field])));
const METRIC_FIELDS = ["impressions", "clicks", "spend", "video_starts", "video_completions", "conversions", "revenue"];
const STORED_KEYS = { impressions: "impressions", clicks: "clicks", spend: "spend", video_starts: "videoStarts", video_completions: "videoCompletions", conversions: "conversions", revenue: "revenue" };

function blank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

export function parseDeliveryDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!match) {
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text);
    if (!us) return null;
    match = [null, us[3].length === 2 ? `20${us[3]}` : us[3], us[1].padStart(2, "0"), us[2].padStart(2, "0")];
  }
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

function metricNumber(value) {
  if (typeof value === "number") return value;
  const text = String(value ?? "").replace(/[$,%\s]/g, "");
  if (text === "" || /^-+$/.test(text)) return null;
  return Number(text);
}

function fieldFor(header) {
  return ALIAS_LOOKUP.get(normalizeHeaderText(header)) ?? null;
}

/**
 * Finds the header row of a per-day delivery report (CM360 report with a metadata block,
 * CM360 flat export, or Flashtalking export). Returns null for campaign-summary layouts.
 */
export function detectDailyDelivery(rows) {
  const marker = rows.slice(0, SCAN_LIMIT).findIndex(row => String(row[0] ?? "").trim().toLowerCase() === "report fields");
  const start = marker >= 0 ? marker + 1 : 0;
  for (let index = start; index < Math.min(rows.length, start + SCAN_LIMIT); index += 1) {
    const fields = rows[index].map(fieldFor);
    if (fields.includes("date") && (fields.includes("campaign") || fields.includes("campaign_id")) && fields.includes("impressions")) {
      const columns = {};
      fields.forEach((field, column) => { if (field && !(field in columns)) columns[field] = column; });
      return { headerRow: index, columns, hasReportFields: marker >= 0, headers: rows[index] };
    }
  }
  return null;
}

export function inferDeliverySource(fileName, headers, hasReportFields) {
  const normalized = headers.map(normalizeHeaderText);
  if (/flash\s?talking|(^|[^a-z])ft[ _-]/i.test(fileName) || normalized.some(header => /^(interactions|engagements|dco_|ft_)/.test(header))) return "Flashtalking";
  if (hasReportFields || /cm360|dcm|campaign manager/i.test(fileName)) return "CM360";
  return "CM360";
}

/**
 * Parses detected daily rows into one record per source campaign and day. Placements and
 * creatives are summed; "Grand Total" and blank rows are ignored.
 */
export function parseDailyDelivery(rows, detection, { fileName = "", source } = {}) {
  const { headerRow, columns, headers, hasReportFields } = detection;
  const resolvedSource = source || inferDeliverySource(fileName, headers, hasReportFields);
  const errors = [];
  const byKey = new Map();
  for (let index = headerRow + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row.some(value => !blank(value))) continue;
    const first = String(row[0] ?? "").trim().toLowerCase();
    if (first === "grand total" || first === "total") continue;
    const date = parseDeliveryDate(row[columns.date]);
    const rowNumber = index + 1;
    if (!date) {
      if (!blank(row[columns.date]) && !/total/i.test(String(row[columns.date]))) errors.push(`Row ${rowNumber}: "${row[columns.date]}" is not a valid date.`);
      continue;
    }
    const name = String(row[columns.campaign] ?? "").trim();
    const id = String(row[columns.campaign_id] ?? "").trim();
    if (!name && !id) { errors.push(`Row ${rowNumber}: campaign name or ID is required.`); continue; }
    const record = { date, sourceCampaignId: id, sourceCampaignName: name, advertiser: String(row[columns.advertiser] ?? "").trim(), source: resolvedSource };
    let valid = true;
    for (const field of METRIC_FIELDS) {
      const value = field in columns ? metricNumber(row[columns[field]]) : null;
      if (value !== null && (!Number.isFinite(value) || value < 0)) { errors.push(`Row ${rowNumber}: ${field.replace("_", " ")} must be a non-negative number.`); valid = false; break; }
      record[STORED_KEYS[field]] = value;
    }
    if (!valid) continue;
    const key = `${(id || name).toLowerCase()}::${date}`;
    const current = byKey.get(key);
    if (!current) { byKey.set(key, record); continue; }
    for (const field of METRIC_FIELDS) {
      const stored = STORED_KEYS[field];
      if (record[stored] !== null) current[stored] = (current[stored] ?? 0) + record[stored];
    }
  }
  if (!byKey.size && !errors.length) errors.push("No dated delivery rows were found below the header.");
  const records = [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date));
  const campaigns = new Map();
  for (const record of records) {
    const key = (record.sourceCampaignId || record.sourceCampaignName).toLowerCase();
    const entry = campaigns.get(key) || { key, sourceCampaignId: record.sourceCampaignId, sourceCampaignName: record.sourceCampaignName, advertiser: record.advertiser, dates: [] };
    entry.dates.push(record.date);
    campaigns.set(key, entry);
  }
  return {
    kind: "daily-delivery", source: resolvedSource, records, errors: errors.slice(0, 8),
    campaigns: [...campaigns.values()].map(entry => ({ ...entry, firstDate: entry.dates[0], lastDate: entry.dates.at(-1), days: entry.dates.length })),
    valid: errors.length === 0 && records.length > 0
  };
}

function lowered(value) {
  return String(value ?? "").trim().toLowerCase();
}

function linkKeys(entry) {
  return [entry.sourceCampaignId, entry.sourceCampaignName].map(lowered).filter(Boolean);
}

/** Finds the dashboard campaign for a source campaign: saved links first, then stable ID, then name. */
export function matchSourceCampaign(campaigns, entry, source, links = {}) {
  const keys = linkKeys(entry);
  for (const key of keys) {
    const linked = links[`${source}::${key}`];
    if (Number.isInteger(linked) && campaigns[linked]) return linked;
  }
  const saved = campaigns.findIndex(campaign => (campaign.sourceIds?.[source] || []).some(id => keys.includes(lowered(id))));
  if (saved >= 0) return saved;
  if (entry.sourceCampaignId) {
    const byId = campaigns.findIndex(campaign => lowered(campaign.campaignId) === lowered(entry.sourceCampaignId) || lowered(campaign.campaignId).startsWith(`${lowered(entry.sourceCampaignId)}-`));
    if (byId >= 0) return byId;
  }
  const name = lowered(entry.sourceCampaignName);
  if (!name) return -1;
  const matches = campaigns.map((campaign, index) => [campaign, index]).filter(([campaign]) => lowered(campaign.name) === name || lowered(campaign.name).endsWith(`— ${name}`) || lowered(campaign.name).includes(name));
  return matches.length === 1 ? matches[0][1] : -1;
}

function cumulative(days, upTo) {
  const totals = { impressions: 0, clicks: 0, spend: 0, videoStarts: 0, videoCompletions: 0, conversions: 0, revenue: 0 };
  const seen = Object.fromEntries(Object.keys(totals).map(key => [key, false]));
  for (const [date, metrics] of Object.entries(days)) {
    if (date > upTo) continue;
    for (const key of Object.keys(totals)) if (Number.isFinite(metrics[key])) { totals[key] += metrics[key]; seen[key] = true; }
  }
  return Object.fromEntries(Object.keys(totals).map(key => [key, seen[key] ? totals[key] : null]));
}

function deliverySpend(campaign, totals) {
  if (Number.isFinite(totals.spend)) return totals.spend;
  if (Number.isFinite(campaign.billingCpm) && Number.isFinite(totals.impressions)) return Math.round(totals.impressions / 1000 * campaign.billingCpm * 100) / 100;
  return null;
}

function preferredSource(dailyDelivery) {
  return SOURCE_PREFERENCE.find(source => dailyDelivery[source] && Object.keys(dailyDelivery[source]).length) || Object.keys(dailyDelivery)[0];
}

/** Merges parsed daily records into a matched campaign, replacing any day already stored (idempotent). */
export function applyDeliveryToCampaign(campaign, entryRecords, source) {
  const dailyDelivery = JSON.parse(JSON.stringify(campaign.dailyDelivery || {}));
  const days = dailyDelivery[source] || {};
  for (const record of entryRecords) {
    days[record.date] = Object.fromEntries(Object.values(STORED_KEYS).map(key => [key, record[key]]));
  }
  const retained = Object.keys(days).sort().slice(-MAX_DAILY_DAYS_PER_SOURCE);
  dailyDelivery[source] = Object.fromEntries(retained.map(date => [date, days[date]]));
  const next = { ...campaign, dailyDelivery, sources: [...new Set([...(campaign.sources || []), campaign.source, source].filter(Boolean))] };
  const primary = preferredSource(dailyDelivery);
  const primaryDays = dailyDelivery[primary];
  const lastDate = Object.keys(primaryDays).sort().at(-1);
  const totals = cumulative(primaryDays, lastDate);
  const spend = deliverySpend(campaign, totals);
  if (spend !== null) next.thirdPartySpend = spend;
  if (!next.dataAsOf || lastDate > next.dataAsOf) next.dataAsOf = lastDate;
  let snapshots = campaign.performanceSnapshots || [];
  for (const date of Object.keys(dailyDelivery[source]).sort().slice(-SNAPSHOT_DAYS)) {
    const running = cumulative(dailyDelivery[source], date);
    const snapshotSpend = deliverySpend(campaign, running);
    snapshots = mergePerformanceSnapshots({ performanceSnapshots: snapshots }, { ...running, spend: snapshotSpend, dataAsOf: date, source });
  }
  next.performanceSnapshots = snapshots;
  return next;
}

/** Reports whether stored days start after the flight start, which would understate cumulative totals. */
export function coverageWarning(campaign, source) {
  const dates = Object.keys(campaign.dailyDelivery?.[source] || {}).sort();
  if (!dates.length || !campaign.startDate || dates[0] <= campaign.startDate) return null;
  return `${campaign.name}: ${source} daily data starts ${dates[0]}, after the ${campaign.startDate} flight start, so cumulative totals may be understated.`;
}

export function applyDailyDelivery(campaigns, parsed, links = {}) {
  let next = campaigns.map(campaign => ({ ...campaign }));
  const matched = [];
  const unmatched = [];
  const warnings = [];
  for (const entry of parsed.campaigns) {
    const index = matchSourceCampaign(next, entry, parsed.source, links);
    if (index < 0) { unmatched.push(entry); continue; }
    const records = parsed.records.filter(record => (record.sourceCampaignId || record.sourceCampaignName).toLowerCase() === entry.key);
    const sourceIds = { ...(next[index].sourceIds || {}) };
    sourceIds[parsed.source] = [...new Set([...(sourceIds[parsed.source] || []), ...linkKeys(entry)])];
    next[index] = applyDeliveryToCampaign({ ...next[index], sourceIds }, records, parsed.source);
    const warning = coverageWarning(next[index], parsed.source);
    if (warning) warnings.push(warning);
    matched.push({ entry, index, campaign: next[index].name, client: next[index].client, campaignId: next[index].campaignId || "", days: records.length });
  }
  return { campaigns: next, matched, unmatched, warnings };
}

export function exportDailyDeliveryCsv(campaign) {
  const headers = ["client", "campaign", "campaign_id", "source", "date", "impressions", "clicks", "spend", "video_starts", "video_completions", "conversions", "revenue"];
  const escape = value => /[",\n]/.test(String(value ?? "")) ? `"${String(value).replaceAll('"', '""')}"` : String(value ?? "");
  const lines = [headers.join(",")];
  for (const [source, days] of Object.entries(campaign.dailyDelivery || {})) {
    for (const date of Object.keys(days).sort()) {
      const metrics = days[date];
      lines.push([campaign.client, campaign.name, campaign.campaignId || "", source, date, ...["impressions", "clicks", "spend", "videoStarts", "videoCompletions", "conversions", "revenue"].map(key => metrics[key] ?? "")].map(escape).join(","));
    }
  }
  return lines.join("\n");
}
