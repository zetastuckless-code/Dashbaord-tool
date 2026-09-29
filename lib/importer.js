import { canonicalizeHeader } from "./header-mapping.js";
import { calculateKpi } from "./metric-calculations.js";

export const REQUIRED_CAMPAIGN_COLUMNS = [
  "client", "campaign", "spend", "budget", "pacing", "kpi", "kpi_value", "kpi_target", "source"
];

export function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some(cell => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error("The CSV contains an unclosed quoted value.");
  row.push(value.trim());
  if (row.some(cell => cell !== "")) rows.push(row);
  return rows;
}

function parseNumber(value) {
  const normalized = String(value).replace(/[$,%\s]/g, "");
  return normalized === "" ? Number.NaN : Number(normalized);
}

function parseOptionalNumber(value) {
  return String(value ?? "").trim() === "" ? null : parseNumber(value);
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateCampaignCsv(text) {
  let rows;
  try {
    rows = parseCsv(text.replace(/^\uFEFF/, ""));
  } catch (error) {
    return { valid: false, errors: [error.message], warnings: [], campaigns: [] };
  }

  if (rows.length < 2) {
    return { valid: false, errors: ["The report must include a header and at least one data row."], warnings: [], campaigns: [] };
  }

  const headers = rows[0].map(canonicalizeHeader);
  const duplicateHeaders = headers.filter((header, index) => header && headers.indexOf(header) !== index);
  if (duplicateHeaders.length) {
    return { valid: false, errors: [`Duplicate column: ${[...new Set(duplicateHeaders)].join(", ")}.`], warnings: [], campaigns: [] };
  }

  const missing = REQUIRED_CAMPAIGN_COLUMNS.filter(header => !headers.includes(header));
  if (missing.length) {
    return { valid: false, errors: [`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`], warnings: [], campaigns: [] };
  }

  const errors = [];
  const warnings = [];
  if (!headers.includes("campaign_id")) warnings.push("No campaign ID column was found; matching will fall back to client and campaign name.");
  if (!headers.includes("start_date") || !headers.includes("end_date")) warnings.push("Campaign flight dates are unavailable; reported pacing will be used.");
  if (!headers.includes("data_as_of")) warnings.push("No data-through date was provided; freshness alerts cannot be evaluated.");
  if (!headers.includes("first_party_spend") || !headers.includes("third_party_spend")) warnings.push("Both source spend columns are required for discrepancy monitoring.");
  const identities = new Set();
  const imported = rows.slice(1).map((row, index) => {
    const rowNumber = index + 2;
    if (row.length !== headers.length) errors.push(`Row ${rowNumber}: expected ${headers.length} values but found ${row.length}.`);
    const record = Object.fromEntries(headers.map((header, column) => [header, row[column] ?? ""]));
    const spend = parseNumber(record.spend);
    const budget = parseNumber(record.budget);
    const pacing = parseNumber(record.pacing);
    const firstPartySpend = parseOptionalNumber(record.first_party_spend);
    const thirdPartySpend = parseOptionalNumber(record.third_party_spend);
    const optionalMetrics = {
      impressions: parseOptionalNumber(record.impressions), clicks: parseOptionalNumber(record.clicks),
      conversions: parseOptionalNumber(record.conversions), revenue: parseOptionalNumber(record.revenue),
      videoStarts: parseOptionalNumber(record.video_starts), videoCompletions: parseOptionalNumber(record.video_completions)
    };
    const campaignId = String(record.campaign_id ?? "").trim();
    const startDate = String(record.start_date ?? "").trim();
    const endDate = String(record.end_date ?? "").trim();
    const dataAsOf = String(record.data_as_of ?? "").trim();
    const campaignIdentity = campaignId || record.campaign;
    const identity = `${record.client.trim().toLowerCase()}::${campaignIdentity.trim().toLowerCase()}::${record.source.trim().toLowerCase()}`;

    if (!record.client || !record.campaign) errors.push(`Row ${rowNumber}: client and campaign are required.`);
    if (!record.kpi || !record.kpi_value || !record.kpi_target || !record.source) errors.push(`Row ${rowNumber}: KPI, KPI value, KPI target, and source are required.`);
    if (![spend, budget, pacing].every(Number.isFinite)) errors.push(`Row ${rowNumber}: spend, budget, and pacing must be numbers.`);
    if (spend < 0 || budget <= 0 || pacing < 0) errors.push(`Row ${rowNumber}: spend and pacing cannot be negative, and budget must be above zero.`);
    if ([firstPartySpend, thirdPartySpend].some(value => value !== null && (!Number.isFinite(value) || value < 0))) errors.push(`Row ${rowNumber}: optional source spend values must be valid non-negative numbers.`);
    if (Object.values(optionalMetrics).some(value => value !== null && (!Number.isFinite(value) || value < 0))) errors.push(`Row ${rowNumber}: optional performance metrics must be valid non-negative numbers.`);
    if ((startDate || endDate) && (!isIsoDate(startDate) || !isIsoDate(endDate))) errors.push(`Row ${rowNumber}: start date and end date must both use valid YYYY-MM-DD dates.`);
    if (startDate && endDate && startDate > endDate) errors.push(`Row ${rowNumber}: end date must be on or after start date.`);
    if (dataAsOf && !isIsoDate(dataAsOf)) errors.push(`Row ${rowNumber}: data as of must use a valid YYYY-MM-DD date.`);
    if (identities.has(identity)) errors.push(`Row ${rowNumber}: duplicate client, campaign, and source combination.`);
    identities.add(identity);

    const calculatedKpi = calculateKpi(record.kpi, { spend, ...optionalMetrics });
    return {
      client: record.client,
      name: record.campaign,
      campaignId: campaignId || null,
      requiresMapping: !campaignId,
      owner: String(record.owner ?? "").trim() || null,
      channel: String(record.channel ?? "").trim() || null,
      startDate: startDate || null,
      endDate: endDate || null,
      dataAsOf: dataAsOf || null,
      short: record.client.split(/\s+/).map(word => word[0]).join("").slice(0, 2).toUpperCase(),
      className: ["apex", "lumon", "nova"][index % 3],
      spend,
      budget,
      pacing,
      kpi: record.kpi.toUpperCase(),
      value: calculatedKpi?.formatted || record.kpi_value,
      reportedValue: record.kpi_value,
      target: record.kpi_target.toLowerCase().startsWith("target") ? record.kpi_target : `Target ${record.kpi_target}`,
      source: record.source,
      billingSource: record.billing_source || record.source,
      firstPartySpend,
      thirdPartySpend,
      ...optionalMetrics,
      updated: record.updated || "Just now"
    };
  });

  return { valid: errors.length === 0, errors: errors.slice(0, 8), warnings, campaigns: errors.length ? [] : imported };
}
