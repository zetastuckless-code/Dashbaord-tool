import { openDb } from "./todo-folder.js";

// The DCM and DSP rows behind each line, as the reports gave them (placement or line item, creative, and day), kept in
// IndexedDB because a year of them is too big for local storage. Billing files copy them into their raw data tab.

const STORE = "raw-delivery";
const KEEP_DAYS = 400;
const lineDayKey = (source, line, date) => `${source}|${line}|${date}`;

const done = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });

/**
 * Saves a file's rows for the lines they were matched to. A line's day that the file covers is replaced as a whole, so
 * overlapping month-to-date files never leave a row twice. Rows older than about 13 months are dropped.
 */
export async function saveRawRows(indexedDB, source, rows) {
  if (!rows.length) return 0;
  const db = await openDb(indexedDB);
  const finished = transaction => new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
  // First clear the line-days this file covers (every request is sent at once, so the transaction stays open).
  const clearing = db.transaction(STORE, "readwrite");
  const store = clearing.objectStore(STORE);
  for (const key of new Set(rows.map(row => lineDayKey(source, row.line, row.date)))) {
    const request = store.index("lineDay").getAllKeys(key);
    request.onsuccess = () => request.result.forEach(id => store.delete(id));
  }
  await finished(clearing);
  const writing = db.transaction(STORE, "readwrite");
  const target = writing.objectStore(STORE);
  rows.forEach((row, position) => target.put({ ...row, source, lineDay: lineDayKey(source, row.line, row.date), id: `${lineDayKey(source, row.line, row.date)}|${position}|${row.placement}|${row.creative}` }));
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
  const cursorRequest = target.openCursor();
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;
    if (cursor.value.date < cutoff) cursor.delete();
    cursor.continue();
  };
  await finished(writing);
  return rows.length;
}

/** The rows for some lines over a run of days, oldest first. */
export async function readRawRows(indexedDB, source, lines, from, to) {
  const db = await openDb(indexedDB);
  const index = db.transaction(STORE).objectStore(STORE).index("lineDay");
  const requests = [];
  for (const line of lines) {
    for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += 86_400_000) requests.push(done(index.getAll(lineDayKey(source, line, new Date(time).toISOString().slice(0, 10)))));
  }
  const rows = (await Promise.all(requests)).flat();
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.line.localeCompare(b.line) || a.placement.localeCompare(b.placement) || a.creative.localeCompare(b.creative));
}

/** Removes every stored row for a line, when its DCM and DSP data is removed. */
export async function deleteRawRows(indexedDB, line) {
  const db = await openDb(indexedDB);
  const transaction = db.transaction(STORE, "readwrite");
  const store = transaction.objectStore(STORE);
  const cursorRequest = store.openCursor();
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;
    if (cursor.value.line === line) cursor.delete();
    cursor.continue();
  };
  await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
}
