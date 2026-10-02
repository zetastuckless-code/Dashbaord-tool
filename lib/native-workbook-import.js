import { normalizeHeaderText } from "./header-mapping.js";

export const NATIVE_HEADERS = [
  "client", "campaign", "campaign_id", "channel", "start_date", "end_date", "data_as_of",
  "spend", "budget", "pacing", "kpi", "kpi_value", "kpi_target", "source", "billing_source",
  "first_party_spend", "third_party_spend", "impressions", "clicks", "conversions", "revenue",
  "video_starts", "video_completions"
];

const MONTH_SHEETS = new Set([
  "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"
]);

function numberValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value ?? "").trim();
  if (!text || text.startsWith("#")) return null;
  const number = Number(text.replace(/[$,%\s,]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function dateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

function firstIndex(headers, names) {
  for (const name of names) {
    const index = headers.indexOf(name);
    if (index >= 0) return index;
  }
  return -1;
}

function cell(row, index) {
  return index >= 0 ? row[index] : null;
}

function textCell(row, index) {
  return String(cell(row, index) ?? "").trim();
}

function findMetadata(rows) {
  const metadata = {};
  const labels = {
    advertiser: "client", client: "client", campaign: "campaign", campaign_id: "campaignId",
    start: "startDate", start_date: "startDate", end: "endDate", end_date: "endDate",
    report_date: "dataAsOf", data_as_of: "dataAsOf", data_through: "dataAsOf", through_date: "dataAsOf"
  };
  for (const row of rows.slice(0, 20)) {
    row.forEach((value, index) => {
      const field = labels[normalizeHeaderText(value)];
      if (!field || metadata[field]) return;
      const next = row.slice(index + 1).find(item => item !== null && String(item).trim() !== "");
      if (next === undefined) return;
      metadata[field] = field.toLowerCase().includes("date") ? dateValue(next) : String(next).trim();
    });
  }
  return metadata;
}

export function inferClientName(fileName = "") {
  let name = String(fileName).replace(/\.[^.]+$/, "").replace(/^\d{1,2}\.\d{1,2}[_ -]+/, "");
  name = name.replace(/^Zeta Global Performance Report[-_ ]*/i, "")
    .replace(/^Zeta Global[ _-]*/i, "")
    .replace(/^.*?Agency[-_ ]+/i, "")
    .replace(/[ _-]+Display (?:Q\d )?Reporting.*$/i, "")
    .replace(/[ _-]+Display Report.*$/i, "")
    .replace(/[ _-]+Q\d(?:[-_ ]*Q\d)?[_ -]*20\d{2}.*$/i, "")
    .replace(/[ _-]+(?:Flight \d+|[A-Za-z]+-[A-Za-z]+)?[ _-]*20\d{2}[ _-]+Reporting.*$/i, "")
    .replace(/[ _-]+COMM[ _-]+.*$/i, "")
    .replace(/[ _-]+\d{1,2}\.\d{1,2}\.\d{2,4}$/i, "")
    .replaceAll("_", " ").trim();
  return name || "Imported report";
}

function summaryHeader(row) {
  const headers = row.map(normalizeHeaderText);
  const channel = firstIndex(headers, ["media_format", "channel"]);
  const campaign = firstIndex(headers, ["line", "line_item", "campaign", "campaign_name", "channel"]);
  const genericSpend = firstIndex(headers, ["spend", "media_cost"]);
  const dspSpend = firstIndex(headers, ["dsp_spend", "first_party_spend"]);
  const dcmSpend = firstIndex(headers, ["dcm_spend", "third_party_spend", "ad_server_spend"]);
  const budget = firstIndex(headers, ["io_budget", "budget", "client_budget", "billable_budget"]);
  const impressions = firstIndex(headers, ["dsp_impression", "dsp_impressions", "impressions"]);
  const clicks = firstIndex(headers, ["clicks"]);
  if (campaign < 0 || firstIndex(headers, ["spend", "media_cost", "dsp_spend", "dcm_spend", "first_party_spend", "third_party_spend"]) < 0) return null;
  if (impressions < 0 && clicks < 0) return null;
  return {
    campaign, channel, genericSpend, dspSpend, dcmSpend, budget, impressions, clicks,
    pacing: firstIndex(headers, ["delivery", "percent_delivered", "pacing"]),
    ctr: firstIndex(headers, ["ctr", "click_rate"]),
    goal: firstIndex(headers, ["goal", "goal_value", "target"]),
    conversions: firstIndex(headers, ["offline_conversions", "total_conversions", "conversions", "dsp_conversions", "dcm_conversion"]),
    revenue: firstIndex(headers, ["revenue", "total_revenue"]),
    roas: firstIndex(headers, ["roas"]),
    videoStarts: firstIndex(headers, ["video_starts", "video_plays"]),
    videoCompletions: firstIndex(headers, ["video_completes", "video_completions"])
  };
}

function percentValue(value) {
  const number = numberValue(value);
  if (number === null) return null;
  return Number((Math.abs(number) <= 10 ? number * 100 : number).toFixed(6));
}

function formatTarget(kpi, value) {
  const number = numberValue(value);
  if (number === null) return "Not provided";
  if (kpi === "CTR") return `${Number((Math.abs(number) <= 1 ? number * 100 : number).toFixed(3))}%`;
  if (kpi === "ROAS") return `${Number(number.toFixed(2))}x`;
  if (kpi === "CPA") return `$${number.toFixed(2)}`;
  return String(value);
}

function campaignNameFor(row, header, metadata, sheetName, client) {
  const line = textCell(row, header.campaign);
  const preceding = textCell(row, header.campaign - 1);
  if (metadata.campaign) {
    return ["display", "video", "total"].includes(line.toLowerCase()) ? metadata.campaign : `${metadata.campaign} — ${line}`;
  }
  if (line && !["display", "video", "total"].includes(line.toLowerCase())) return line;
  if (preceding && !/^\d{1,2}[/-]/.test(preceding)) return `${sheetName.replaceAll("_", " ")} — ${preceding}`;
  return `${client} — ${line || sheetName.replaceAll("_", " ")}`;
}

export function extractPerformanceSummaryCampaigns(rows, { sheetName = "Worksheet", fileName = "" } = {}) {
  const metadata = findMetadata(rows);
  const client = metadata.client || inferClientName(fileName);
  const campaigns = [];
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 100); rowIndex += 1) {
    const header = summaryHeader(rows[rowIndex]);
    if (!header) continue;
    let foundInBlock = false;
    for (let dataIndex = rowIndex + 1; dataIndex < Math.min(rows.length, rowIndex + 14); dataIndex += 1) {
      if (summaryHeader(rows[dataIndex])) break;
      const row = rows[dataIndex];
      if (!row.some(value => value !== null && String(value).trim() !== "")) {
        if (foundInBlock) break;
        continue;
      }
      const label = textCell(row, header.campaign);
      if (!label || label.toLowerCase() === "total") continue;
      const budget = numberValue(cell(row, header.budget));
      const firstPartySpend = numberValue(cell(row, header.dspSpend));
      const thirdPartySpend = numberValue(cell(row, header.dcmSpend));
      const reportedSpend = numberValue(cell(row, header.genericSpend));
      const spend = firstPartySpend ?? reportedSpend ?? thirdPartySpend;
      if (spend === null || (budget !== null && budget <= 0)) continue;
      const impressions = numberValue(cell(row, header.impressions));
      const clicks = numberValue(cell(row, header.clicks));
      const conversions = numberValue(cell(row, header.conversions));
      const revenue = numberValue(cell(row, header.revenue));
      const videoStarts = numberValue(cell(row, header.videoStarts));
      const videoCompletions = numberValue(cell(row, header.videoCompletions));
      const ctr = numberValue(cell(row, header.ctr));
      const roas = numberValue(cell(row, header.roas));
      const goal = cell(row, header.goal);
      const kpi = revenue !== null && revenue > 0 ? "ROAS" : goal !== null && String(goal).trim() !== "" ? "CTR" : conversions !== null && conversions > 0 ? "CPA" : "CTR";
      const calculatedValue = kpi === "ROAS" ? roas ?? (spend > 0 ? revenue / spend : null)
        : kpi === "CPA" ? (conversions > 0 ? spend / conversions : null)
          : ctr ?? (impressions > 0 && clicks !== null ? clicks / impressions : null);
      const kpiValue = kpi === "ROAS" ? `${Number((calculatedValue ?? 0).toFixed(2))}x`
        : kpi === "CPA" ? `$${Number(calculatedValue ?? 0).toFixed(2)}`
          : `${Number(((calculatedValue ?? 0) * 100).toFixed(3))}%`;
      const channel = textCell(row, header.channel) || label;
      const sourceIsDcm = /dcm|cm360/i.test(sheetName) && header.dspSpend < 0;
      const lineSpecificId = metadata.campaignId && !["display", "video", "total"].includes(label.toLowerCase())
        ? `${metadata.campaignId}-${normalizeHeaderText(label)}`
        : metadata.campaignId || "";
      campaigns.push({
        client,
        campaign: campaignNameFor(row, header, metadata, sheetName, client),
        campaign_id: lineSpecificId,
        channel,
        start_date: metadata.startDate || "",
        end_date: metadata.endDate || "",
        data_as_of: metadata.dataAsOf || metadata.endDate || "",
        spend,
        budget: budget ?? "",
        pacing: percentValue(cell(row, header.pacing)) ?? (budget ? spend / budget * 100 : ""),
        kpi,
        kpi_value: kpiValue,
        kpi_target: formatTarget(kpi, goal),
        source: sourceIsDcm ? "CM360" : "Zeta Global",
        billing_source: sourceIsDcm ? "CM360" : "DSP",
        first_party_spend: firstPartySpend ?? (sourceIsDcm ? "" : spend),
        third_party_spend: thirdPartySpend ?? (sourceIsDcm ? spend : ""),
        impressions: impressions ?? "",
        clicks: clicks ?? "",
        conversions: conversions ?? "",
        revenue: revenue ?? "",
        video_starts: videoStarts ?? "",
        video_completions: videoCompletions ?? ""
      });
      foundInBlock = true;
    }
    if (metadata.campaign && campaigns.length) break;
  }
  return campaigns;
}

export function mergeNativeCampaigns(campaigns) {
  const merged = new Map();
  for (const campaign of campaigns) {
    const identity = [campaign.client, campaign.campaign_id || campaign.campaign, campaign.channel].map(value => String(value).trim().toLowerCase()).join("::");
    const current = merged.get(identity);
    if (!current) {
      merged.set(identity, campaign);
      continue;
    }
    // A workbook can hold several flights of the same line; the most recent flight with delivery wins.
    const newerFlight = campaign.end_date && current.end_date && campaign.end_date > current.end_date && Number(campaign.spend) > 0;
    const preferred = newerFlight || (campaign.first_party_spend !== "" && current.first_party_spend === "") ? campaign : current;
    merged.set(identity, {
      ...preferred,
      first_party_spend: preferred.first_party_spend !== "" ? preferred.first_party_spend : current.first_party_spend || campaign.first_party_spend,
      third_party_spend: current.third_party_spend !== "" ? current.third_party_spend : campaign.third_party_spend,
      source: "Zeta Global",
      billing_source: "DSP"
    });
  }
  return [...merged.values()];
}

// Raw-data, pixel, and mapping tabs can hold 100k+ rows; they are never scanned for campaign summaries.
export const RAW_SHEET_PRIORITY = 3;

export function sheetPriority(sheetName) {
  const normalized = normalizeHeaderText(sheetName);
  if (/performance|summary|overview/.test(normalized)) return 0;
  if (/raw|pixel|mapping/.test(normalized)) return RAW_SHEET_PRIORITY;
  if (MONTH_SHEETS.has(normalized) || /budget|creative|conversion|audience|data|sheet\d|filter|dod/.test(normalized)) return 2;
  return 1;
}
