import readXlsxFile, { readSheetNames } from "read-excel-file";
import { REQUIRED_CAMPAIGN_COLUMNS, parseCsv } from "./importer.js";
import { canonicalizeHeader, describeHeaderMappings } from "./header-mapping.js";
import { extractPerformanceSummaryCampaigns, mergeNativeCampaigns, NATIVE_HEADERS, RAW_SHEET_PRIORITY, sheetPriority } from "./native-workbook-import.js";
import { detectDailyDelivery, parseDailyDelivery } from "./daily-delivery-import.js";
import { detectLineItemExport, parseLineItemExport } from "./line-item-import.js";
import { detectMonthlyPerformance, extractMonthlyPerformance } from "./monthly-performance-import.js";

export function findHeaderRow(rows, scanLimit = 20) {
  const limit = Math.min(rows.length, scanLimit);
  for (let index = 0; index < limit; index += 1) {
    const normalized = rows[index].map(canonicalizeHeader);
    if (REQUIRED_CAMPAIGN_COLUMNS.every(column => normalized.includes(column))) return index;
  }
  return -1;
}

export function rowsToCsv(rows) {
  return rows.map(row => row.map(value => {
    const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(",")).join("\n");
}

function canonicalReport(rows, headerRow, worksheet) {
  return {
    csvText: rowsToCsv(rows.slice(headerRow)),
    headers: rows[headerRow],
    worksheet,
    headerRow: headerRow + 1,
    headerMappings: describeHeaderMappings(rows[headerRow]),
    nativeLayout: false
  };
}

function dailyReport(rows, detection, fileName, worksheet) {
  return {
    kind: "daily-delivery",
    parsed: parseDailyDelivery(rows, detection, { fileName }),
    headers: detection.headers,
    worksheet,
    headerRow: detection.headerRow + 1,
    headerMappings: [],
    nativeLayout: false
  };
}

function lineItemReport(rows, detection, fileName, worksheet) {
  return {
    kind: "line-items",
    parsed: parseLineItemExport(rows, detection, { fileName }),
    headers: detection.headers,
    worksheet,
    headerRow: detection.headerRow + 1,
    headerMappings: [],
    nativeLayout: false
  };
}

export async function readReportFile(file, bytes) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "csv") {
    const rows = parseCsv(new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, ""));
    const headerRow = findHeaderRow(rows);
    if (headerRow >= 0) return canonicalReport(rows, headerRow, null);
    const lineItems = detectLineItemExport(rows);
    if (lineItems) return lineItemReport(rows, lineItems, file.name, null);
    const daily = detectDailyDelivery(rows);
    if (daily) return dailyReport(rows, daily, file.name, null);
    throw new Error("No supported campaign header was found in the first 20 CSV rows, and the file is not a daily delivery report (it needs Date, Campaign, and Impressions columns).");
  }
  if (extension !== "xlsx") throw new Error("Choose a .csv or .xlsx report.");
  const workbook = new Blob([bytes], { type: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const sheetNames = await readSheetNames(workbook);
  const orderedSheets = [...sheetNames].sort((left, right) => sheetPriority(left) - sheetPriority(right));
  const nativeCampaigns = [];
  const monthlyCampaigns = [];
  const nativeSheets = [];
  for (const sheetName of orderedSheets.filter(name => sheetPriority(name) < 2)) {
    const rows = await readXlsxFile(workbook, { sheet: sheetName });
    const headerRow = findHeaderRow(rows);
    if (headerRow >= 0) return canonicalReport(rows, headerRow, sheetName);
    const lineItems = detectLineItemExport(rows);
    if (lineItems) return lineItemReport(rows, lineItems, file.name, sheetName);
    const monthly = detectMonthlyPerformance(rows);
    if (monthly) {
      const found = extractMonthlyPerformance(rows, monthly, { fileName: file.name, sheetName });
      if (found.length) { monthlyCampaigns.push(...found); nativeSheets.push(sheetName); }
      continue;
    }
    const extracted = extractPerformanceSummaryCampaigns(rows, { sheetName, fileName: file.name });
    if (extracted.length) {
      nativeCampaigns.push(...extracted);
      nativeSheets.push(sheetName);
    }
  }
  if (nativeCampaigns.length || monthlyCampaigns.length) {
    // A monthly tab covers the whole flight, so it replaces a summary-tab row for the same line.
    const identity = campaign => `${campaign.client}::${campaign.campaign}`.toLowerCase();
    const monthlyKeys = new Set(monthlyCampaigns.map(identity));
    const campaigns = [...mergeNativeCampaigns(nativeCampaigns.filter(campaign => !monthlyKeys.has(identity(campaign)))), ...monthlyCampaigns];
    return {
      csvText: rowsToCsv([NATIVE_HEADERS, ...campaigns.map(campaign => NATIVE_HEADERS.map(header => campaign[header] ?? ""))]),
      headers: NATIVE_HEADERS,
      worksheet: nativeSheets.length === 1 ? nativeSheets[0] : `${nativeSheets.length} summary worksheets`,
      headerRow: 1,
      headerMappings: [],
      nativeLayout: true
    };
  }
  for (const sheetName of orderedSheets.filter(name => sheetPriority(name) === 2)) {
    const rows = await readXlsxFile(workbook, { sheet: sheetName });
    const headerRow = findHeaderRow(rows);
    if (headerRow >= 0) return canonicalReport(rows, headerRow, sheetName);
  }
  for (const sheetName of orderedSheets.filter(name => sheetPriority(name) < RAW_SHEET_PRIORITY)) {
    const rows = await readXlsxFile(workbook, { sheet: sheetName });
    const daily = detectDailyDelivery(rows);
    if (daily) return dailyReport(rows, daily, file.name, sheetName);
  }
  throw new Error(`No supported campaign summary or canonical header was found in ${sheetNames.length} worksheet${sheetNames.length === 1 ? "" : "s"}.`);
}
