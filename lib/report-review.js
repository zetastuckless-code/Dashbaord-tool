// Report review: imports that came in with warnings, came in partly, or didn't come in at all, until you mark them
// reviewed. Reports the folder automation held back live in the report inbox; this page shows both together.

export const REVIEWED_IMPORTS_KEY = "northstar-reviewed-imports";
const NEEDS_REVIEW = ["Imported with warnings", "Partially imported", "Rejected"];
const MAX_REVIEWED = 500;

export function readReviewedImports(storage) {
  try {
    const value = JSON.parse(storage.getItem(REVIEWED_IMPORTS_KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function markImportsReviewed(storage, reviewed, ids) {
  const next = [...new Set([...ids, ...reviewed])].slice(0, MAX_REVIEWED);
  try { storage.setItem(REVIEWED_IMPORTS_KEY, JSON.stringify(next)); } catch { /* the item shows again next visit */ }
  return next;
}

/** Imports still waiting on you, newest first. A file that later imported cleanly no longer needs review. */
export function pendingImportReviews(history = [], reviewed = []) {
  const done = new Set(reviewed);
  const cleanLater = (record, index) => history.slice(0, index).some(later => later.fileName === record.fileName && ["Imported", "Superseded"].includes(later.status));
  return history.filter((record, index) => NEEDS_REVIEW.includes(record.status) && !done.has(record.id) && !cleanLater(record, index));
}

/** The clients an import touched, in their dashboard spelling. Import keys store them lowercased. */
export function importClients(record, knownClients = []) {
  const byLower = new Map(knownClients.map(client => [client.toLowerCase(), client]));
  return [...new Set((record.campaignKeys || []).map(key => key.split("::")[0]).filter(Boolean).map(client => byLower.get(client) || client))];
}
