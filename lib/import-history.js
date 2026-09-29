import { rowsToCsv } from "./workbook-import.js";

const MAX_IMPORT_HISTORY = 10;

export async function fingerprintText(text) {
  return fingerprintBytes(new TextEncoder().encode(text));
}

export async function fingerprintBytes(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function createImportRecord({ fileName, fingerprint, status, rowCount = 0, errors = [], warnings = [], campaignKeys = [], importedAt = new Date().toISOString() }) {
  return {
    id: `${importedAt}-${fingerprint.slice(0, 8)}`,
    fileName,
    fingerprint,
    status,
    rowCount,
    errors: errors.slice(0, 3),
    warnings: warnings.slice(0, 3),
    campaignKeys: [...new Set(campaignKeys.filter(Boolean))].sort(),
    importedAt
  };
}

export function hasSuccessfulFingerprint(history, fingerprint) {
  return history.some(record => record.fingerprint === fingerprint && ["Imported", "Imported with warnings", "Superseded"].includes(record.status));
}

export function addImportRecord(history, record) {
  const sameScope = candidate => record.campaignKeys.length > 0 && candidate.campaignKeys?.length === record.campaignKeys.length
    && candidate.campaignKeys.every((key, index) => key === record.campaignKeys[index]);
  const successfulStatuses = ["Imported", "Imported with warnings"];
  const auditedHistory = successfulStatuses.includes(record.status) ? history.map(candidate => successfulStatuses.includes(candidate.status) && sameScope(candidate)
    ? { ...candidate, status: "Superseded", supersededBy: record.id }
    : candidate) : history;
  return [record, ...auditedHistory].slice(0, MAX_IMPORT_HISTORY);
}

export function readImportHistory(storage) {
  try {
    const history = JSON.parse(storage.getItem("northstar-import-history"));
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

export function writeImportHistory(storage, history) {
  storage.setItem("northstar-import-history", JSON.stringify(history));
}

export function exportImportHistoryCsv(history, exportedAt = new Date().toISOString()) {
  const headers = ["exported_at", "import_id", "imported_at", "file_name", "status", "row_count", "fingerprint", "campaign_scope", "warnings", "errors", "superseded_by"];
  const rows = history.map(record => [exportedAt, record.id, record.importedAt, record.fileName, record.status, record.rowCount, record.fingerprint, (record.campaignKeys || []).join(" | "), (record.warnings || []).join(" | "), (record.errors || []).join(" | "), record.supersededBy || ""]);
  return rowsToCsv([headers, ...rows]);
}
