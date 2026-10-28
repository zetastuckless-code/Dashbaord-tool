import readXlsxFile, { readSheetNames } from "read-excel-file";
import { REQUIRED_CAMPAIGN_COLUMNS, decodeCsvBytes, parseCsv } from "./importer.js";
import { canonicalizeHeader, describeHeaderMappings } from "./header-mapping.js";
import { extractPerformanceSummaryCampaigns, inferClientName, mergeNativeCampaigns, NATIVE_HEADERS, RAW_SHEET_PRIORITY, refineClientName, sheetPriority } from "./native-workbook-import.js";
import { detectDailyDelivery, parseDailyDelivery } from "./daily-delivery-import.js";
import { detectLineItemExport, parseLineItemExport } from "./line-item-import.js";
import { detectMonthlyPerformance, extractMonthlyPerformance } from "./monthly-performance-import.js";
import { conversionsByLine, detectRawLineTable, extractRawLines } from "./raw-line-breakdown.js";
import { campaignGroupName } from "./campaign-groups.js";
import { splitByGeo } from "./geo-breakdown.js";

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

/** The newest date in any tab with a Date column near the top (a small filter tab can stop months early), or null. */
async function lastRawDate(workbook, sheetNames) {
  let newest = null;
  for (const sheetName of sheetNames) {
    const rows = await readXlsxFile(workbook, { sheet: sheetName });
    const headerIndex = rows.slice(0, 5).findIndex(row => row.some(value => /^(date|day)$/i.test(String(value ?? "").trim())));
    if (headerIndex < 0) continue;
    const column = rows[headerIndex].findIndex(value => /^(date|day)$/i.test(String(value ?? "").trim()));
    const dates = rows.slice(headerIndex + 1).map(row => row[column]).filter(value => value instanceof Date && !Number.isNaN(value.getTime())).map(value => value.toISOString().slice(0, 10));
    const last = dates.sort().at(-1);
    if (last && (!newest || last > newest)) newest = last;
  }
  return newest;
}

export async function readReportFile(file, bytes) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "csv") {
    const text = decodeCsvBytes(bytes);
    if (!text.trim()) throw new Error("This file is empty. If it came from an email link, the download may have failed; open the link and save the file again.");
    // A download link that redirects (Power Automate's Upload file from URL doesn't follow it), has expired, or needs a
    // sign-in saves a web page instead of the report.
    if (/^\s*<(!doctype|html|head|body|\?xml)/i.test(text)) {
      const moved = /object moved|moved permanently|found|redirect/i.test(text.slice(0, 400)) ? (/href="([^"]+)"/i.exec(text)?.[1] || /url=([^"'>\s]+)/i.exec(text)?.[1] || null) : null;
      if (moved) throw new Error(`The automation saved a redirect, not the report: the download link sends the download on to another address, and the flow's Upload file from URL step doesn't follow it. Open the report in your browser to download it, then drop the CSV here: ${moved.replace(/&amp;/g, "&")} To fix the flow, see Automation, DSP email reports, "The saved file is a web page".`);
      throw new Error("This file is a web page, not a CSV report. The download link may have expired or needs you to sign in; open it in the browser and save the report again.");
    }
    const rows = parseCsv(text);
    const headerRow = findHeaderRow(rows);
    if (headerRow >= 0) return canonicalReport(rows, headerRow, null);
    const lineItems = detectLineItemExport(rows);
    if (lineItems) return lineItemReport(rows, lineItems, file.name, null);
    const daily = detectDailyDelivery(rows);
    if (daily) return dailyReport(rows, daily, file.name, null);
    throw new Error(`No supported campaign header was found in the first 20 CSV rows, and the file is not a daily delivery report (it needs Date, Campaign, and Impressions columns). Its first row reads: ${(rows[0] || []).slice(0, 8).map(cell => `"${String(cell).slice(0, 30)}"`).join(", ") || "nothing"}.`);
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
    const extracted = splitByGeo(rows, extractPerformanceSummaryCampaigns(rows, { sheetName, fileName: file.name }));
    if (extracted.length) {
      nativeCampaigns.push(...extracted);
      nativeSheets.push(sheetName);
    }
  }
  // A summary tab that only totals the campaign ("Display") hides its lines; a raw delivery tab with the same total
  // has them, one row per day and line, so it is read instead.
  if (!monthlyCampaigns.length) {
    const spendOf = list => list.reduce((sum, campaign) => sum + (Number(campaign.spend) || 0), 0);
    const nativeWithSpend = mergeNativeCampaigns(nativeCampaigns).filter(campaign => Number(campaign.spend) > 0);
    if (nativeWithSpend.length <= 1) {
      const client = nativeCampaigns[0]?.client || "";
      const campaign = nativeCampaigns[0] ? campaignGroupName({ name: nativeCampaigns[0].campaign }) : "";
      // Mapping, pixel, and offline tabs are lookups that can run to a million rows; they never hold delivery by line.
      for (const sheetName of orderedSheets.filter(name => sheetPriority(name) >= 2 && !/mapping|pixel|offline/i.test(name))) {
        const rows = await readXlsxFile(workbook, { sheet: sheetName });
        const detection = detectRawLineTable(rows);
        if (!detection) continue;
        // A delivery tab without conversions takes them from a "Matched Conversions" tab beside it (McMaster).
        let addedConversions = null;
        if (detection.conversions < 0) {
          for (const name of orderedSheets.filter(name => name !== sheetName && /matched|conversion/i.test(name))) {
            const conversionRows = await readXlsxFile(workbook, { sheet: name });
            addedConversions = conversionsByLine(conversionRows, detectRawLineTable(conversionRows));
            if (addedConversions.size) break;
          }
        }
        const lines = extractRawLines(rows, detection, { client: client || refineClientName(inferClientName(file.name), rows), campaign, sheetName, addedConversions });
        const nativeTotal = spendOf(mergeNativeCampaigns(nativeCampaigns));
        const rawTotal = spendOf(lines);
        const sameTotal = !nativeTotal || Math.abs(rawTotal - nativeTotal) <= Math.max(1, nativeTotal * 0.02);
        if (lines.filter(line => Number(line.spend) > 0).length >= 2 && sameTotal) {
          nativeCampaigns.splice(0, nativeCampaigns.length, ...lines);
          nativeSheets.splice(0, nativeSheets.length, sheetName);
          break;
        }
      }
    }
  }
  // A summary that never says how current it is falls back to the flight end, which can be months away. The last day in
  // a raw daily tab ("Raw Data", one row per day) is the real date the numbers run through.
  // A report with no date at all ("Performance Summary" with no flight or report date) takes it from the raw tab too.
  nativeCampaigns.forEach(campaign => { if (!campaign.data_as_of) campaign.as_of_from_end = true; });
  if (nativeCampaigns.some(campaign => campaign.as_of_from_end)) {
    const lastDay = await lastRawDate(workbook, orderedSheets.filter(name => sheetPriority(name) >= 2 && !/mapping|pixel|offline/i.test(name)));
    if (lastDay) nativeCampaigns.forEach(campaign => {
      if (!campaign.as_of_from_end || (campaign.end_date && lastDay > campaign.end_date)) return;
      campaign.data_as_of = lastDay;
      // Monthly history stops at the last day of data, not at the flight end.
      if (campaign.history) {
        const entries = JSON.parse(campaign.history).map(entry => entry.date > lastDay ? { ...entry, date: lastDay } : entry);
        campaign.history = JSON.stringify(entries.filter((entry, index) => index === entries.length - 1 || entry.date < entries[index + 1].date));
      }
    });
  }
  if (nativeCampaigns.length || monthlyCampaigns.length) {
    // A monthly tab covers the whole flight, so it replaces a summary-tab row for the same line.
    const identity = campaign => `${campaign.client}::${campaign.campaign}`.toLowerCase();
    const monthlyKeys = new Set(monthlyCampaigns.map(identity));
    // A summary tab only shows a recent snapshot. For a media format the monthly tab does not cover (a Display row
    // next to a YouTube monthly tab), that snapshot would add a stray line with a sliver of the delivery, so leave it out.
    const monthlyFormats = new Set(monthlyCampaigns.map(campaign => String(campaign.channel).toLowerCase()));
    const isSnapshotOnly = campaign => monthlyCampaigns.length > 0 && !monthlyFormats.has(String(campaign.channel).toLowerCase());
    const skipped = nativeCampaigns.filter(isSnapshotOnly);
    const campaigns = [...mergeNativeCampaigns(nativeCampaigns.filter(campaign => !monthlyKeys.has(identity(campaign)) && !isSnapshotOnly(campaign))), ...monthlyCampaigns];
    const notes = [...new Set(skipped.map(campaign => `Skipped the ${campaign.channel} row in ${campaign.source_sheet} (${campaign.campaign}). This report's monthly tab covers ${[...new Set(monthlyCampaigns.map(item => item.channel))].join(" and ")}, and the summary row only shows a snapshot. Import a ${campaign.channel} report to add that line.`))];
    return {
      csvText: rowsToCsv([NATIVE_HEADERS, ...campaigns.map(campaign => NATIVE_HEADERS.map(header => campaign[header] ?? ""))]),
      headers: NATIVE_HEADERS,
      worksheet: nativeSheets.length === 1 ? nativeSheets[0] : `${nativeSheets.length} summary worksheets`,
      headerRow: 1,
      headerMappings: [],
      nativeLayout: true,
      notes
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
