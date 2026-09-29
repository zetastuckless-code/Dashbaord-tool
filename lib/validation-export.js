import { rowsToCsv } from "./workbook-import.js";

export function exportValidationIssuesCsv(fileName, issues, severity = "error", exportedAt = new Date().toISOString()) {
  const normalized = Array.isArray(issues) ? issues.filter(issue => String(issue ?? "").trim()) : [];
  return rowsToCsv([
    ["exported_at", "file_name", "severity", "issue"],
    ...normalized.map(issue => [exportedAt, fileName || "Unknown file", severity, String(issue).trim()])
  ]);
}
