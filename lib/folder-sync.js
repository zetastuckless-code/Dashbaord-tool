import { applyDailyDelivery } from "./daily-delivery-import.js";
import { validateCampaignCsv } from "./importer.js";
import { previewCampaignImport } from "./import-preview.js";

export const LEDGER_STORAGE_KEY = "northstar-folder-ledger";
export const MAX_LEDGER_ENTRIES = 2000;
export const SYNC_INTERVAL_MS = 15 * 60 * 1000;
const REPORT_EXTENSIONS = new Set(["csv", "xlsx"]);
const MAX_DEPTH = 2;

export function isCandidateReportName(name) {
  const lower = String(name).toLowerCase();
  if (lower.startsWith("~$") || lower.startsWith(".")) return false;
  return REPORT_EXTENSIONS.has(lower.split(".").pop());
}

export function ledgerKey(path, file) {
  return [path, file.size, file.lastModified].join("|");
}

export function readLedger(storage) {
  try {
    const ledger = JSON.parse(storage.getItem(LEDGER_STORAGE_KEY));
    return Array.isArray(ledger) ? ledger.filter(entry => entry && entry.key && entry.status) : [];
  } catch {
    return [];
  }
}

export function writeLedger(storage, ledger) {
  storage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(ledger));
}

/** Adds entries newest-first, replacing any entry for the same file version, bounded to the retention limit. */
export function addLedgerEntries(ledger, entries, limit = MAX_LEDGER_ENTRIES) {
  const incoming = new Set(entries.map(entry => entry.key));
  return [...entries, ...ledger.filter(entry => !incoming.has(entry.key))].slice(0, limit);
}

export function isProcessed(ledger, key) {
  return ledger.some(entry => entry.key === key && entry.status !== "review");
}

export function reviewItems(ledger) {
  return ledger.filter(entry => entry.status === "review");
}

/** Walks a directory handle collecting candidate report files up to two folders deep. */
export async function listReportFiles(directory, path = [], depth = 0) {
  const found = [];
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind === "directory") {
      if (depth < MAX_DEPTH && !name.startsWith(".")) found.push(...await listReportFiles(handle, [...path, name], depth + 1));
    } else if (isCandidateReportName(name)) {
      found.push({ name, path: [...path, name].join("/"), handle });
    }
  }
  return found;
}

export async function resolveFileHandle(root, path) {
  const parts = path.split("/");
  let directory = root;
  for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part);
  return directory.getFileHandle(parts.at(-1));
}

/**
 * Decides what a freshly read report should do without touching the dashboard:
 *  - "apply": safe to merge automatically (`campaigns` is the merged result),
 *  - "review": needs a person (unmatched campaigns, nothing matched),
 *  - "rejected": not a usable campaign report (reason supplied).
 */
export function planAutoImport(report, campaigns) {
  if (report.kind === "daily-delivery") {
    const parsed = report.parsed;
    if (!parsed.valid) return { status: "rejected", reason: parsed.errors[0] || "No daily delivery rows were found." };
    const result = applyDailyDelivery(campaigns, parsed);
    if (!result.matched.length) return { status: "review", reason: `No ${parsed.source} campaign matched a dashboard campaign.` };
    if (result.unmatched.length) return { status: "review", reason: `${result.unmatched.length} ${parsed.source} campaign${result.unmatched.length === 1 ? " needs" : "s need"} linking: ${result.unmatched.slice(0, 2).map(entry => entry.sourceCampaignName || entry.sourceCampaignId).join(", ")}.` };
    const keys = result.matched.map(item => [item.client, item.campaignId || item.campaign, parsed.source].map(value => String(value ?? "").trim().toLowerCase()).join("::"));
    return { status: "apply", campaigns: result.campaigns, rowCount: result.matched.length, campaignKeys: keys, warnings: result.warnings, label: `${parsed.source} daily delivery` };
  }
  const result = validateCampaignCsv(report.csvText);
  if (!result.valid) return { status: "rejected", reason: result.errors[0] };
  const preview = previewCampaignImport(campaigns, result.campaigns, "merge");
  const keys = result.campaigns.map(campaign => [campaign.client, campaign.campaignId || campaign.name, campaign.source].map(value => String(value ?? "").trim().toLowerCase()).join("::"));
  return { status: "apply", campaigns: preview.campaigns, rowCount: result.campaigns.length, campaignKeys: keys, warnings: result.warnings, label: "campaign summary" };
}

// --- Directory handle persistence (File System Access API handles are structured-cloneable into IndexedDB) ---

const DB_NAME = "northstar-folder-sync";
const STORE = "handles";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, action) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = action(database.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export const saveFolderHandle = handle => withStore("readwrite", store => store.put(handle, "reports"));
export const loadFolderHandle = () => withStore("readonly", store => store.get("reports"));
export const clearFolderHandle = () => withStore("readwrite", store => store.delete("reports"));
export const folderSyncSupported = () => typeof window !== "undefined" && "showDirectoryPicker" in window && "indexedDB" in window;
