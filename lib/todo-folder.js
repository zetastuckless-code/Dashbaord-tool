import { parseTodoFile } from "./client-todos.js";

// A folder the morning scan saves its checklist into. The dashboard reads every new or changed file in it and
// remembers what it read (by name and last change), so a file is only taken in once.

export const TODO_FILES_KEY = "northstar-todo-files";
const TODO_FILE = /\.(md|markdown|txt|csv)$/i;

export function readProcessedFiles(storage) {
  try {
    const value = JSON.parse(storage.getItem(TODO_FILES_KEY));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

/**
 * Reads the folder's to-do files that are new or changed since they were last read. Works with a browser folder
 * handle (or anything shaped like one: `values()` yielding file handles with `kind`, `name`, and `getFile()`).
 */
export async function readTodoFolder(folder, processed, { clients = [], today } = {}) {
  const items = [];
  const unknownClients = new Set();
  const next = { ...processed };
  let filesRead = 0;
  for await (const entry of folder.values()) {
    if (entry.kind !== "file" || !TODO_FILE.test(entry.name)) continue;
    const file = await entry.getFile();
    if (next[entry.name] === file.lastModified) continue;
    const parsed = parseTodoFile(await file.text(), { clients, today });
    items.push(...parsed.items);
    parsed.unknownClients.forEach(name => unknownClients.add(name));
    next[entry.name] = file.lastModified;
    filesRead += 1;
  }
  return { items, unknownClients: [...unknownClients], processed: next, filesRead };
}

// The folder handle itself can only be kept in IndexedDB; local storage cannot hold it.
const DB_NAME = "northstar";
const STORE = "handles";

function openDb(indexedDB) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFolderHandle(indexedDB, key, handle) {
  const db = await openDb(indexedDB);
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    if (handle) transaction.objectStore(STORE).put(handle, key); else transaction.objectStore(STORE).delete(key);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function loadFolderHandle(indexedDB, key) {
  const db = await openDb(indexedDB);
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}
