import { campaignGroupName, groupKey } from "./campaign-groups.js";
import { removeDailySource, removeSnapshot } from "./campaign-removal.js";
import { applyDeliveryToCampaign } from "./daily-delivery-import.js";
import { removeCampaignTotals, removeOrderFromTotals } from "./campaign-totals.js";

const same = (left, right) => String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();
const later = (left, right) => (left && right ? (left > right ? left : right) : left || right || null);

export const DOCUMENT_KINDS = Object.freeze({
  report: "Report",
  daily: "Daily delivery",
  "line-items": "DSP line items",
  "io-order": "Insertion order",
  "io-flights": "Insertion order (flights)"
});

const SUCCESS = ["Imported", "Imported with warnings", "Partially imported", "Superseded"];

/** The files behind a line. Lines imported before uploads were tracked still show the file their numbers came from. */
function uploadsOf(record) {
  const list = Array.isArray(record.uploads) ? record.uploads : [];
  if (record.sourceFile && !list.some(upload => upload.kind === "report")) return [...list, { id: `report|${record.sourceFile}`, kind: "report", fileName: record.sourceFile, source: record.source, date: record.dataAsOf || null, uploadedAt: null, legacy: true }];
  return list;
}

/**
 * Everything uploaded for one client — reports, daily files, DSP line-item files, and insertion orders — as one list,
 * newest first. It is read from the data itself, so it always matches what is in the dashboard.
 */
export function listClientDocuments({ campaigns, totals = {}, client }) {
  const records = campaigns.filter(record => record.client === client);
  const docs = new Map();
  const touch = (id, base) => {
    if (!docs.has(id)) docs.set(id, { id, lines: 0, campaigns: new Set(), uploadedAt: null, dataAsOf: null, legacy: true, ...base });
    return docs.get(id);
  };
  for (const record of records) {
    const group = campaignGroupName(record);
    for (const upload of uploadsOf(record)) {
      const doc = touch(`${upload.kind}|${upload.fileName}`, { kind: upload.kind, fileName: upload.fileName, source: upload.source ?? null });
      doc.lines += 1;
      doc.campaigns.add(group);
      doc.uploadedAt = later(doc.uploadedAt, upload.uploadedAt);
      doc.dataAsOf = later(doc.dataAsOf, upload.date || (upload.days || []).slice().sort().at(-1) || null);
      doc.legacy = doc.legacy && Boolean(upload.legacy);
    }
    if (record.ioFileName && (record.lineItemFlights || []).some(flight => flight.source === "io")) {
      const doc = touch(`io-flights|${record.ioFileName}`, { kind: "io-flights", fileName: record.ioFileName, source: null });
      doc.lines += (record.lineItemFlights || []).filter(flight => flight.source === "io").length;
      doc.campaigns.add(group);
      doc.legacy = false;
    }
  }
  const keys = new Set(records.map(groupKey));
  const names = new Map(records.map(record => [groupKey(record), campaignGroupName(record)]));
  for (const [key, entry] of Object.entries(totals)) {
    if (!keys.has(key)) continue;
    for (const order of entry.orders || []) {
      const label = order.order || order.fileName || "Order";
      const doc = touch(`io-order|${key}|${label}`, { kind: "io-order", fileName: order.fileName || label, source: null, key, order: order.order || null, budget: order.budget, startDate: order.startDate, endDate: order.endDate });
      doc.lines = 1;
      doc.campaigns.add(names.get(key));
      doc.uploadedAt = later(doc.uploadedAt, order.appliedAt);
      doc.legacy = false;
    }
  }
  return [...docs.values()]
    .map(({ campaigns: groups, legacy, ...doc }) => ({ ...doc, campaigns: [...groups].sort(), legacy }))
    .sort((a, b) => (b.uploadedAt || b.dataAsOf || "").localeCompare(a.uploadedAt || a.dataAsOf || "") || a.fileName.localeCompare(b.fileName));
}

/** A line that only existed because of the removed report goes back to a bare setup (no spend, no components). */
function resetToShell(record) {
  return { ...record, spend: 0, firstPartySpend: null, thirdPartySpend: null, impressions: null, clicks: null, conversions: null, revenue: null, videoStarts: null, videoCompletions: null, value: "—", pacing: record.budget ? 0 : null, dataAsOf: null, performanceSnapshots: [] };
}

function withoutDailyDays(record, source, days) {
  const remaining = Object.entries(record.dailyDelivery?.[source] || {}).filter(([date]) => !days.includes(date)).map(([date, metrics]) => ({ date, ...metrics }));
  const cleared = removeDailySource(record, source);
  return remaining.length ? applyDeliveryToCampaign(cleared, remaining, source) : cleared;
}

/** Marks every matching successful import-history entry reverted, so the same file can be uploaded again. */
export function revertHistoryForFile(importHistory, fileName) {
  return importHistory.map(record => same(record.fileName, fileName) && SUCCESS.includes(record.status)
    ? { ...record, status: "Reverted", warnings: ["Removed from the client's uploads."] }
    : record);
}

/**
 * Removes one uploaded document from a client and the data it put there: a report's lines (or, when later reports have
 * updated them, just that report's snapshot), daily days, DSP line items, or an insertion order and its flights.
 */
export function removeClientDocument({ campaigns, totals = {}, importHistory = [], client, document }) {
  const mine = record => record.client === client;
  const summary = { removedLines: 0, updatedLines: 0 };
  let nextTotals = totals;
  let nextCampaigns = campaigns;

  if (document.kind === "report") {
    nextCampaigns = campaigns.flatMap(record => {
      if (!mine(record)) return [record];
      const upload = uploadsOf(record).find(item => item.kind === "report" && same(item.fileName, document.fileName));
      if (!upload) return [record];
      const remaining = (record.uploads || []).filter(item => item.id !== upload.id);
      let updated = { ...record, ...(record.uploads ? { uploads: remaining } : {}), sourceFile: same(record.sourceFile, document.fileName) ? null : record.sourceFile };
      if (upload.date) updated = removeSnapshot(updated, upload.date, upload.source);
      const hasData = (updated.performanceSnapshots || []).length > 0;
      const created = Boolean(upload.created) || (upload.legacy && (record.performanceSnapshots || []).length <= 1);
      if (!hasData && created && record.source !== "Manual") { summary.removedLines += 1; return []; }
      if (!hasData && !(record.dailyDelivery && Object.keys(record.dailyDelivery).length)) updated = resetToShell(updated);
      summary.updatedLines += 1;
      return [updated];
    });
  } else if (document.kind === "daily") {
    nextCampaigns = campaigns.map(record => {
      const upload = mine(record) ? (record.uploads || []).find(item => item.kind === "daily" && same(item.fileName, document.fileName)) : null;
      if (!upload) return record;
      summary.updatedLines += 1;
      return { ...withoutDailyDays(record, upload.source, upload.days || []), uploads: (record.uploads || []).filter(item => item.id !== upload.id) };
    });
  } else if (document.kind === "line-items") {
    nextCampaigns = campaigns.map(record => {
      const upload = mine(record) ? (record.uploads || []).find(item => item.kind === "line-items" && same(item.fileName, document.fileName)) : null;
      if (!upload) return record;
      summary.updatedLines += 1;
      const ids = upload.lineIds || [];
      return { ...record, lineItems: (record.lineItems || []).filter(item => !ids.some(id => same(id, item.id))), uploads: (record.uploads || []).filter(item => item.id !== upload.id) };
    });
  } else if (document.kind === "io-order") {
    nextTotals = removeOrderFromTotals(totals, document.key, document.order);
    nextCampaigns = campaigns.map(record => mine(record) && groupKey(record) === document.key && same(record.ioFileName, document.fileName) ? { ...record, ioFileName: null, ioOrder: null } : record);
    summary.updatedLines = nextCampaigns.filter((record, index) => record !== campaigns[index]).length;
  } else if (document.kind === "io-flights") {
    nextCampaigns = campaigns.map(record => {
      if (!mine(record) || !same(record.ioFileName, document.fileName)) return record;
      summary.updatedLines += 1;
      return { ...record, lineItemFlights: (record.lineItemFlights || []).filter(flight => flight.source !== "io"), ioFileName: null, ioOrder: null };
    });
  }

  // A campaign that no longer has any lines should not keep paced-on-order totals.
  const remainingKeys = new Set(nextCampaigns.map(groupKey));
  for (const key of Object.keys(nextTotals)) if (!remainingKeys.has(key)) nextTotals = removeCampaignTotals(nextTotals, key);

  const nextHistory = ["report", "daily", "line-items"].includes(document.kind) ? revertHistoryForFile(importHistory, document.fileName) : importHistory;
  return { campaigns: nextCampaigns, totals: nextTotals, importHistory: nextHistory, ...summary };
}
