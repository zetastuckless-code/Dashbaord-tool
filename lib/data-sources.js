import { DOCUMENT_KINDS, listClientDocuments } from "./client-documents.js";
import { isCampaignArchived } from "./campaign-archive.js";

const SUCCESS = ["Imported", "Imported with warnings", "Partially imported", "Superseded"];
const same = (left, right) => String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();

/** The latest successful import of a file, for uploads saved before upload times were tracked. */
function importedAtFromHistory(importHistory, fileName) {
  return importHistory.filter(record => same(record.fileName, fileName) && SUCCESS.includes(record.status) && record.importedAt).map(record => record.importedAt).sort().at(-1) || null;
}

/**
 * Every upload behind the dashboard, across all clients, newest first. Each carries its client and when it was
 * uploaded: the time saved with the upload, else the import history's time for that file, else null.
 */
export function listAllUploads({ campaigns, totals = {}, importHistory = [] }) {
  const clients = [...new Set(campaigns.filter(record => !isCampaignArchived(record)).map(record => record.client))].sort((a, b) => String(a).localeCompare(String(b)));
  return clients
    .flatMap(client => listClientDocuments({ campaigns: campaigns.filter(record => !isCampaignArchived(record)), totals, client }).map(doc => ({ ...doc, client, uploadedAt: doc.uploadedAt || importedAtFromHistory(importHistory, doc.fileName) })))
    .sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || "") || a.client.localeCompare(b.client) || a.fileName.localeCompare(b.fileName));
}

export const UPLOAD_KIND_OPTIONS = Object.freeze([
  { id: "all", label: "All types" },
  { id: "report", label: DOCUMENT_KINDS.report },
  { id: "daily", label: DOCUMENT_KINDS.daily },
  { id: "line-items", label: DOCUMENT_KINDS["line-items"] },
  { id: "io", label: "Insertion orders" }
]);

const isIoKind = kind => kind === "io-order" || kind === "io-flights";

export function filterUploads(docs, { client = "all", kind = "all", query = "" } = {}) {
  const text = String(query).trim().toLowerCase();
  return docs.filter(doc => (client === "all" || doc.client === client)
    && (kind === "all" || (kind === "io" ? isIoKind(doc.kind) : doc.kind === kind))
    && (!text || [doc.fileName, doc.client, doc.order, ...doc.campaigns].some(value => String(value ?? "").toLowerCase().includes(text))));
}

/**
 * Groups uploads under their client, or under each campaign they touch (an upload that fed two campaigns is listed
 * under both). Groups are sorted by name; uploads keep their newest-first order.
 */
export function groupUploads(docs, by = "client") {
  const groups = new Map();
  const add = (key, label, client, doc) => {
    if (!groups.has(key)) groups.set(key, { key, label, client, docs: [] });
    groups.get(key).docs.push(doc);
  };
  for (const doc of docs) {
    if (by === "campaign") for (const campaign of doc.campaigns.length ? doc.campaigns : ["No campaign"]) add(`${doc.client}::${campaign}`, campaign, doc.client, doc);
    else add(doc.client, doc.client, doc.client, doc);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label) || a.client.localeCompare(b.client));
}

export function summarizeUploads(docs) {
  const latest = docs.map(doc => doc.uploadedAt).filter(Boolean).sort().at(-1) || null;
  return { total: docs.length, clients: new Set(docs.map(doc => doc.client)).size, latest, undated: docs.filter(doc => !doc.uploadedAt).length };
}
