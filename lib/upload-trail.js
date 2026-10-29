// A day-by-day trail of every file pulled into the dashboard: reports, DCM files, IOs, billing files, status docs, and
// morning briefs. Unlike the uploads list, entries stay after a newer file replaces their data, so you can see what came
// in on any day. Failed and duplicate uploads are kept too, marked as such.

export const UPLOAD_TRAIL_KEY = "northstar-upload-trail";
const MAX_ENTRIES = 3000;

export const TRAIL_KINDS = Object.freeze({
  report: "Report",
  dcm: "DCM report",
  io: "Insertion order",
  billing: "Billing file",
  status: "Status doc",
  brief: "Morning brief"
});

export const TRAIL_KIND_OPTIONS = Object.freeze([{ id: "all", label: "All types" }, ...Object.entries(TRAIL_KINDS).map(([id, label]) => ({ id, label }))]);

const FAILED = ["Rejected", "Duplicate", "Failed"];
export const trailFailed = entry => FAILED.includes(entry.status);

export function readUploadTrail(storage) {
  try {
    const trail = JSON.parse(storage.getItem(UPLOAD_TRAIL_KEY));
    return Array.isArray(trail) ? trail : [];
  } catch {
    return [];
  }
}

export function writeUploadTrail(storage, trail) {
  storage.setItem(UPLOAD_TRAIL_KEY, JSON.stringify(trail));
}

const list = value => [...new Set((Array.isArray(value) ? value : [value]).map(item => String(item ?? "").trim()).filter(Boolean))].sort();

/** Adds one upload to the front of the trail. */
export function addTrailEntry(trail, { fileName, kind = "report", status = "Imported", clients = [], campaigns = [], detail = "", at = new Date().toISOString() }) {
  const entry = { id: `${at}-${Math.random().toString(36).slice(2, 8)}`, at, fileName: String(fileName || "Unnamed file"), kind, status, clients: list(clients), campaigns: list(campaigns), detail: String(detail || "") };
  return [entry, ...trail].slice(0, MAX_ENTRIES);
}

const docKind = kind => kind === "io-order" || kind === "io-flights" ? "io" : "report";
const statusOf = status => status === "Superseded" ? "Imported" : status;

/**
 * Fills an empty trail from what was saved before it existed: the uploads still behind the dashboard and the import
 * history. Each file and time is added once; entries are marked as backfilled.
 */
export function seedUploadTrail(trail, { docs = [], importHistory = [] } = {}) {
  if (trail.length) return trail;
  const seen = new Set();
  const entries = [];
  const add = entry => {
    const key = `${entry.fileName.toLowerCase()}|${entry.at.slice(0, 16)}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ id: `seed-${entries.length}-${entry.at}`, backfilled: true, detail: "", ...entry });
  };
  for (const doc of docs) if (doc.uploadedAt) add({ at: doc.uploadedAt, fileName: doc.fileName, kind: docKind(doc.kind), status: "Imported", clients: list(doc.client), campaigns: list(doc.campaigns) });
  for (const record of importHistory) if (record.importedAt && record.fileName) add({ at: record.importedAt, fileName: record.fileName, kind: (record.campaignKeys || []).some(key => key.endsWith("::cm360")) ? "dcm" : "report", status: statusOf(record.status), clients: [], campaigns: [] });
  return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_ENTRIES);
}

export function filterTrail(trail, { client = "all", kind = "all", query = "" } = {}) {
  const text = String(query).trim().toLowerCase();
  return trail.filter(entry => (client === "all" || entry.clients.includes(client))
    && (kind === "all" || entry.kind === kind)
    && (!text || [entry.fileName, entry.detail, ...entry.clients, ...entry.campaigns].some(value => String(value).toLowerCase().includes(text))));
}

/** The local calendar day of a timestamp ("2026-10-29"). */
export const localDay = at => {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

/** Trail entries by the day they came in, newest day first and newest upload first within each day. */
export function groupTrailByDay(trail) {
  const days = new Map();
  for (const entry of [...trail].sort((a, b) => b.at.localeCompare(a.at))) {
    const day = localDay(entry.at);
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(entry);
  }
  return [...days].map(([day, entries]) => ({ day, entries, imported: entries.filter(entry => !trailFailed(entry)).length, failed: entries.filter(trailFailed).length }));
}
