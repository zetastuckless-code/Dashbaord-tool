import readXlsxFile, { readSheetNames } from "read-excel-file";
import { REQUIRED_CAMPAIGN_COLUMNS, parseCsv } from "./importer.js";
import { canonicalizeHeader, describeHeaderMappings } from "./header-mapping.js";

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

export async function readReportFile(file, bytes) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "csv") {
    const rows = parseCsv(new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, ""));
    const headerRow = findHeaderRow(rows);
    if (headerRow < 0) throw new Error("No supported campaign header was found in the first 20 CSV rows.");
    return { csvText: rowsToCsv(rows.slice(headerRow)), headers: rows[headerRow], worksheet: null, headerRow: headerRow + 1, headerMappings: describeHeaderMappings(rows[headerRow]) };
  }
  if (extension !== "xlsx") throw new Error("Choose a .csv or .xlsx report.");
  const workbook = new Blob([bytes], { type: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const sheetNames = await readSheetNames(workbook);
  for (const sheetName of sheetNames) {
    const rows = await readXlsxFile(workbook, { sheet: sheetName });
    const headerRow = findHeaderRow(rows);
    if (headerRow >= 0) return { csvText: rowsToCsv(rows.slice(headerRow)), headers: rows[headerRow], worksheet: sheetName, headerRow: headerRow + 1, headerMappings: describeHeaderMappings(rows[headerRow]) };
  }
  throw new Error(`No supported campaign header was found in the first 20 rows of ${sheetNames.length} worksheet${sheetNames.length === 1 ? "" : "s"}.`);
}
