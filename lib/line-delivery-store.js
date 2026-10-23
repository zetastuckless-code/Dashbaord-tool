import { openDb } from "./todo-folder.js";

// Each line's DCM and DSP days. They grow every day, so they live in IndexedDB, not local storage (about 5 MB, shared
// with everything else). In memory they stay on the line as `thirdPartyDelivery`, so the rest of the dashboard is unchanged.

const STORE = "line-delivery";
export const lineKey = record => `${record.client}::${record.name}`;
const finished = transaction => new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); });

export async function readLineDeliveries(indexedDB) {
  const db = await openDb(indexedDB);
  const request = db.transaction(STORE).objectStore(STORE).getAll();
  const rows = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  return new Map(rows.map(row => [row.key, row.delivery]));
}

/**
 * Writes the lines whose days changed since the last write (`written` remembers what was saved), and removes lines that
 * no longer have any, so a removed line or removed DCM data doesn't linger.
 */
export async function writeLineDeliveries(indexedDB, records, written) {
  const current = new Map(records.filter(record => record.thirdPartyDelivery && Object.keys(record.thirdPartyDelivery).length).map(record => [lineKey(record), record.thirdPartyDelivery]));
  const changes = [];
  for (const [key, delivery] of current) {
    const text = JSON.stringify(delivery);
    if (written.get(key) !== text) changes.push([key, delivery, text]);
  }
  const removed = [...written.keys()].filter(key => !current.has(key));
  if (!changes.length && !removed.length) return 0;
  const db = await openDb(indexedDB);
  const transaction = db.transaction(STORE, "readwrite");
  const store = transaction.objectStore(STORE);
  for (const [key, delivery] of changes) store.put({ key, delivery });
  for (const key of removed) store.delete(key);
  await finished(transaction);
  for (const [key, , text] of changes) written.set(key, text);
  for (const key of removed) written.delete(key);
  return changes.length + removed.length;
}

/** Clears the stored days and raw rows, for a workspace reset. */
export async function clearDeliveryStores(indexedDB) {
  const db = await openDb(indexedDB);
  const transaction = db.transaction([STORE, "raw-delivery"], "readwrite");
  transaction.objectStore(STORE).clear();
  transaction.objectStore("raw-delivery").clear();
  await finished(transaction);
}

/** Local storage's own measure: characters held, against Chrome's limit of about 5 million per site. */
export const LOCAL_STORAGE_LIMIT = 5_000_000;
export function localStorageUsed(storage) {
  let characters = 0;
  try { for (let index = 0; index < storage.length; index += 1) { const key = storage.key(index); characters += key.length + (storage.getItem(key) || "").length; } } catch { return 0; }
  return characters;
}
export const storageLevel = share => share >= 0.8 ? "full" : share >= 0.6 ? "filling" : "ok";
