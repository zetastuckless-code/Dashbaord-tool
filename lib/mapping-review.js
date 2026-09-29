import { HEADER_ALIASES, canonicalizeHeader, normalizeHeaderText } from "./header-mapping.js";

const SUPPORTED_HEADERS = new Set(Object.keys(HEADER_ALIASES));

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildMappingReview(headers) {
  const columns = headers.filter(value => String(value ?? "").trim()).map(source => {
    const normalized = normalizeHeaderText(source);
    const canonical = canonicalizeHeader(source);
    const supported = SUPPORTED_HEADERS.has(canonical);
    return { source: String(source).trim(), canonical, status: supported ? normalized === canonical ? "Direct" : "Aliased" : "Unmapped" };
  });
  return {
    columns,
    supported: columns.filter(column => column.status !== "Unmapped").length,
    aliased: columns.filter(column => column.status === "Aliased").length,
    unmapped: columns.filter(column => column.status === "Unmapped").length
  };
}

export function exportMappingReviewCsv(review, fileName, exportedAt = new Date().toISOString()) {
  const rows = [["exported_at", "file_name", "source_header", "canonical_field", "mapping_status"], ...review.columns.map(column => [exportedAt, fileName, column.source, column.canonical, column.status])];
  return rows.map(row => row.map(csvCell).join(",")).join("\n");
}
