import { addImportRecord, createImportRecord } from "./import-history.js";

const STACK_KEY = "northstar-undo-stack";
const LEGACY_KEY = "northstar-last-import-rollback";
export const MAX_UNDO_ENTRIES = 8;
const MAX_UNDO_BYTES = 3_000_000;

const clone = value => JSON.parse(JSON.stringify(value));

export function createImportRollback({ campaigns, importHistory, fileName, fingerprint, rowCount, campaignKeys, campaignTotals }, createdAt = new Date().toISOString()) {
  return { kind: "import", createdAt, fileName, fingerprint, rowCount, campaignKeys: [...campaignKeys], campaigns: clone(campaigns), importHistory: clone(importHistory), ...(campaignTotals ? { campaignTotals: clone(campaignTotals) } : {}) };
}

/** A restore point taken before deleting a campaign, line, or report from the dashboard. */
export function createRemovalUndo({ campaigns, importHistory, campaignTotals, label }, createdAt = new Date().toISOString()) {
  return { kind: "removal", label, createdAt, fingerprint: `removal-${createdAt}`, fileName: label, rowCount: 0, campaignKeys: [], campaigns: clone(campaigns), importHistory: clone(importHistory), ...(campaignTotals ? { campaignTotals: clone(campaignTotals) } : {}) };
}

export const undoLabel = entry => entry.kind === "removal" ? entry.label : `the import of ${entry.fileName}`;

const valid = entry => entry && Array.isArray(entry.campaigns) && Array.isArray(entry.importHistory) && entry.fingerprint;

/** Newest first. A restore point saved by the older single-slot version is migrated into the stack on read. */
export function readUndoStack(storage) {
  try {
    const stack = JSON.parse(storage.getItem(STACK_KEY));
    if (Array.isArray(stack)) return stack.filter(valid);
  } catch {
    // fall through to the legacy slot
  }
  try {
    const legacy = JSON.parse(storage.getItem(LEGACY_KEY));
    return valid(legacy) ? [{ kind: "import", ...legacy }] : [];
  } catch {
    return [];
  }
}

export function readImportRollback(storage) {
  return readUndoStack(storage)[0] ?? null;
}

function persist(storage, stack) {
  let trimmed = stack.slice(0, MAX_UNDO_ENTRIES);
  while (trimmed.length > 1 && JSON.stringify(trimmed).length > MAX_UNDO_BYTES) trimmed = trimmed.slice(0, -1);
  try {
    storage.setItem(STACK_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage is full: keep only the newest restore point rather than losing the ability to undo.
    storage.setItem(STACK_KEY, JSON.stringify(trimmed.slice(0, 1)));
  }
  storage.removeItem?.(LEGACY_KEY);
}

export function writeImportRollback(storage, rollback) {
  persist(storage, [rollback, ...readUndoStack(storage)]);
}

export function clearImportRollback(storage) {
  const [, ...rest] = readUndoStack(storage);
  if (rest.length) persist(storage, rest);
  else {
    storage.removeItem(STACK_KEY);
    storage.removeItem(LEGACY_KEY);
  }
}

export function applyImportRollback(rollback, revertedAt = new Date().toISOString()) {
  const restored = { campaigns: clone(rollback.campaigns), ...(rollback.campaignTotals ? { campaignTotals: clone(rollback.campaignTotals) } : {}) };
  if (rollback.kind === "removal") return { ...restored, importHistory: clone(rollback.importHistory) };
  const record = createImportRecord({ fileName: rollback.fileName, fingerprint: rollback.fingerprint, status: "Reverted", rowCount: rollback.rowCount, campaignKeys: rollback.campaignKeys, warnings: ["Dashboard campaigns were restored to their state before this import."], importedAt: revertedAt });
  return { ...restored, importHistory: addImportRecord(rollback.importHistory, record) };
}
