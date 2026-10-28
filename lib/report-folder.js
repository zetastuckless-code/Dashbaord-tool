// A watched folder of client reports, usually a SharePoint folder added to OneDrive with "Add shortcut to My files".
// The dashboard looks through it (subfolders included) for report files that are new or changed, and keeps a record
// of what it has seen so a file is only taken in once. The record is cleared after the retention period; the files
// themselves are never deleted, because the folder is shared with the team.

export const REPORT_LEDGER_KEY = "northstar-report-ledger";
export const REPORT_INBOX_KEY = "northstar-report-inbox";
export const REPORT_SETTINGS_KEY = "northstar-report-settings";
export const REPORT_SETTINGS_DEFAULTS = Object.freeze({ onlyReportFolders: true, lookbackDays: 30, retentionDays: 180 });
const REPORT_FILE = /\.(xlsx|csv)$/i;
const DAY_MS = 86_400_000;
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
export async function findNewReports(folder, ledger, { onlyReportFolders = true, lookbackDays = 30, now = Date.now(), maxDepth = 10, since = 0 } = {}) {
  const found = [];
  let scanned = 0;
  let truncated = false;
  const cutoff = now - lookbackDays * DAY_MS;
  async function walk(directory, path, inReportFolder, depth) {
    for await (const entry of directory.values()) {
      if (scanned >= MAX_ENTRIES) { truncated = true; return; }
      scanned += 1;
      if (entry.kind === "directory") {
        if (depth < maxDepth && !entry.name.startsWith(".")) await walk(entry, [...path, entry.name], inReportFolder || /report/i.test(entry.name), depth + 1);
        continue;
      }
      if (!isReportName(entry.name) || (onlyReportFolders && !inReportFolder && !/report/i.test(entry.name))) continue;
      const file = await entry.getFile();
      if (file.lastModified < cutoff || file.lastModified < since) continue;
      const key = [...path, entry.name].join("/");
      if (ledger[key]?.lastModified === file.lastModified) continue;
      found.push({ key, path, name: entry.name, file, lastModified: file.lastModified });
    }
  }
  await walk(folder, [], /report/i.test(folder.name || ""), 0);
  return { files: found.sort((a, b) => a.lastModified - b.lastModified), scanned, truncated };
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
