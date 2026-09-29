import { addImportRecord, createImportRecord } from "./import-history.js";

const STORAGE_KEY = "northstar-last-import-rollback";

export function createImportRollback({ campaigns, importHistory, fileName, fingerprint, rowCount, campaignKeys }, createdAt = new Date().toISOString()) {
  return { createdAt, fileName, fingerprint, rowCount, campaignKeys: [...campaignKeys], campaigns: JSON.parse(JSON.stringify(campaigns)), importHistory: JSON.parse(JSON.stringify(importHistory)) };
}

export function readImportRollback(storage) {
  try {
    const rollback = JSON.parse(storage.getItem(STORAGE_KEY));
    return rollback && Array.isArray(rollback.campaigns) && Array.isArray(rollback.importHistory) && rollback.fingerprint ? rollback : null;
  } catch {
    return null;
  }
}

export function writeImportRollback(storage, rollback) {
  storage.setItem(STORAGE_KEY, JSON.stringify(rollback));
}

export function clearImportRollback(storage) {
  storage.removeItem(STORAGE_KEY);
}

export function applyImportRollback(rollback, revertedAt = new Date().toISOString()) {
  const record = createImportRecord({ fileName: rollback.fileName, fingerprint: rollback.fingerprint, status: "Reverted", rowCount: rollback.rowCount, campaignKeys: rollback.campaignKeys, warnings: ["Dashboard campaigns were restored to their state before this import."], importedAt: revertedAt });
  return { campaigns: JSON.parse(JSON.stringify(rollback.campaigns)), importHistory: addImportRecord(rollback.importHistory, record) };
}
