// A watched folder of client reports, usually a SharePoint folder added to OneDrive with "Add shortcut to My files".
// The dashboard looks through it (subfolders included) for report files that are new or changed, and keeps a record
// of what it has seen so a file is only taken in once. The record is cleared after the retention period; the files
// themselves are never deleted, because the folder is shared with the team.

export const REPORT_LEDGER_KEY = "northstar-report-ledger";
export const REPORT_INBOX_KEY = "northstar-report-inbox";
export const REPORT_SETTINGS_KEY = "northstar-report-settings";
export const REPORT_SETTINGS_DEFAULTS = Object.freeze({ onlyReportFolders: true, lookbackDays: 30, retentionDays: 180 });
// Zipped reports count too: some DCM emails attach the CSV inside a .zip.
const REPORT_FILE = /\.(xlsx|csv|zip)$/i;
const DAY_MS = 86_400_000;

/**
 * Rejects when `promise` takes longer than `ms`. OneDrive can leave a read hanging (an online-only file during an
 * outage), and one read that never finishes would otherwise stop every check after it.
 */
export function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([promise, new Promise((resolve, reject) => { timer = setTimeout(() => reject(Object.assign(new Error(message), { name: "TimeoutError" })), ms); })]).finally(() => clearTimeout(timer));
}
const MAX_ENTRIES = 25_000;

const readJson = (storage, key, fallback) => {
  try {
    const value = JSON.parse(storage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

export const readReportSettings = storage => ({ ...REPORT_SETTINGS_DEFAULTS, ...readJson(storage, REPORT_SETTINGS_KEY, {}) });
export const readReportLedger = storage => readJson(storage, REPORT_LEDGER_KEY, {});
export const readReportInbox = storage => {
  const inbox = readJson(storage, REPORT_INBOX_KEY, []);
  return Array.isArray(inbox) ? inbox : [];
};

/** Excel's lock files ("~$Report.xlsx") and hidden files are not reports. */
const isReportName = name => REPORT_FILE.test(name) && !name.startsWith("~$") && !name.startsWith(".");

/**
 * Finds report files that are new or changed since they were last seen and were changed within the look-back window.
 * `onlyReportFolders` keeps to files inside a folder whose name mentions "report" (so IO, creative, and media-plan
 * spreadsheets elsewhere in a shared tree are left alone). Returns them oldest first, with their folder path.
 */
export async function findNewReports(folder, ledger, { onlyReportFolders = true, lookbackDays = 30, now = Date.now(), maxDepth = 10, since = 0, fileTimeoutMs = 30_000 } = {}) {
  const found = [];
  // The newest report file in the folder, new or not, so you can see when files stopped arriving.
  let newest = 0;
  const skipped = [];
  let scanned = 0;
  let truncated = false;
  const cutoff = now - lookbackDays * DAY_MS;
  async function walk(directory, path, inReportFolder, depth) {
    // Chrome reads a listing entry by entry, and one broken entry (a library OneDrive dropped) ends the whole listing.
    // What was read before it still counts; only a folder that gives up nothing at all is an error.
    let listed = 0;
    try {
      for await (const entry of directory.values()) {
        listed += 1;
        await visit(entry, path, inReportFolder, depth);
        if (truncated) return;
      }
    } catch (error) {
      if (!listed) throw error;
      skipped.push({ path: [...path, `(the rest of “${directory.name || "the folder"}”)`].join("/"), error: error?.message || String(error) });
    }
  }
  async function visit(entry, path, inReportFolder, depth) {
    if (scanned >= MAX_ENTRIES) { truncated = true; return; }
    scanned += 1;
    const at = [...path, entry.name].join("/");
    if (entry.kind === "directory") {
      if (depth >= maxDepth || entry.name.startsWith(".")) return;
      // A subfolder OneDrive hasn't synced, or one moved mid-check, is skipped; the rest of the folder still counts.
      try { await walk(entry, [...path, entry.name], inReportFolder || /report/i.test(entry.name), depth + 1); } catch (error) { skipped.push({ path: at, error: error?.message || String(error) }); }
      return;
    }
    if (!isReportName(entry.name) || (onlyReportFolders && !inReportFolder && !/report/i.test(entry.name))) return;
    let file;
    try { file = await withTimeout(entry.getFile(), fileTimeoutMs, "OneDrive didn't hand the file over in time"); } catch (error) { skipped.push({ path: at, error: error?.message || String(error) }); return; }
    newest = Math.max(newest, file.lastModified || 0);
    if (file.lastModified < cutoff || file.lastModified < since) return;
    // A big .zip (often in Downloads) is never a report attachment; leave it unread.
    if (/\.zip$/i.test(entry.name) && file.size > 50 * 1024 * 1024) return;
    const key = at;
    if (ledger[key]?.lastModified === file.lastModified) return;
    found.push({ key, path, name: entry.name, file, lastModified: file.lastModified });
  }
  // Only the watched folder itself failing to open is an error for the whole folder.
  await walk(folder, [], /report/i.test(folder.name || ""), 0);
  return { files: found.sort((a, b) => a.lastModified - b.lastModified), scanned, truncated, skipped, newest: newest || null };
}

/** Records a file as seen (with what happened to it) and drops records older than the retention period. */
export function noteReport(ledger, key, lastModified, outcome, { now = Date.now(), retentionDays = 180 } = {}) {
  const cutoff = now - retentionDays * DAY_MS;
  const next = Object.fromEntries(Object.entries(ledger).filter(([, entry]) => entry.seenAt >= cutoff));
  next[key] = { lastModified, outcome, seenAt: now };
  return next;
}

/** Opens a file again from its saved path inside the watched folder, to review it in the import dialog. */
export async function openReportAt(folder, key) {
  const parts = key.split("/");
  let directory = folder;
  for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part);
  return (await directory.getFileHandle(parts.at(-1))).getFile();
}
