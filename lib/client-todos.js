// Client to-dos: written by a morning scan (ChatGPT reading Outlook and Jira) in a plain checklist, pasted or dropped
// into the dashboard, and checked off per client. Items you finish drop off two weeks after you check them.

export const TODOS_KEY = "northstar-todos";
export const DONE_KEEP_DAYS = 14;
const DAY_MS = 86_400_000;

const squash = text => String(text ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const isIsoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));

export function readTodos(storage) {
  try {
    const value = JSON.parse(storage.getItem(TODOS_KEY));
    return Array.isArray(value) ? value.filter(item => item && item.client && item.text) : [];
  } catch {
    return [];
  }
}

export function writeTodos(storage, todos) {
  storage.setItem(TODOS_KEY, JSON.stringify(todos));
  return todos;
}

/** The dashboard client a name in the file means: exact, then ignoring case and punctuation, then one containing the other. */
export function matchClient(name, clients) {
  const wanted = squash(name);
  if (!wanted) return null;
  return clients.find(client => client === name)
    || clients.find(client => squash(client) === wanted)
    || clients.find(client => squash(client).includes(wanted) || wanted.includes(squash(client)))
    || null;
}

/** "Reply to Kelley | due: 2026-10-24 | from: Outlook" → the task with its optional due date and source. */
function parseTaskText(raw) {
  const parts = raw.split("|").map(part => part.trim()).filter(Boolean);
  const item = { text: parts.shift() || "", due: null, source: null };
  for (const part of parts) {
    const field = /^(due|from|source)\s*:\s*(.+)$/i.exec(part);
    if (!field) { item.text = `${item.text} | ${part}`; continue; }
    if (/^due$/i.test(field[1]) && isIsoDate(field[2].trim())) item.due = field[2].trim();
    else if (!/^due$/i.test(field[1])) item.source = field[2].trim();
  }
  return item;
}

/**
 * Reads a to-do file. The checklist form is "## Client" headings with "- [ ] task | due: YYYY-MM-DD | from: Outlook"
 * under each; a CSV with client, task, due, and source columns works too. Clients are matched to the dashboard's.
 */
export function parseTodoFile(text, { clients = [], today = new Date().toISOString().slice(0, 10) } = {}) {
  const lines = String(text ?? "").replace(/^﻿/, "").split(/\r?\n/);
  const items = [];
  const unknown = new Set();
  const add = (clientName, task) => {
    if (!task.text) return;
    const client = matchClient(clientName, clients);
    if (!client) { unknown.add(clientName.trim()); return; }
    items.push({ client, text: task.text, due: task.due, source: task.source || "Morning scan", done: task.done || false });
  };
  const header = lines.find(line => line.trim())?.toLowerCase() || "";
  if (/^client\s*,/.test(header.trim())) {
    const columns = header.split(",").map(column => column.trim());
    const at = name => columns.indexOf(name);
    for (const line of lines.slice(lines.indexOf(lines.find(entry => entry.trim())) + 1)) {
      if (!line.trim()) continue;
      const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(cell => cell.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim());
      const due = cells[at("due")];
      add(cells[at("client")] || "", { text: cells[at("task")] || "", due: isIsoDate(due) ? due : null, source: cells[at("source")] || null });
    }
  } else {
    let client = "";
    for (const line of lines) {
      const heading = /^#{2,3}\s+(.+?)\s*$/.exec(line);
      if (heading) { client = heading[1]; continue; }
      const task = /^\s*[-*]\s*(?:\[( |x|X)\]\s*)?(.+)$/.exec(line);
      if (task && client) add(client, { ...parseTaskText(task[2]), done: /x/i.test(task[1] || "") });
    }
  }
  return { items: items.map(item => ({ ...item, addedOn: today })), unknownClients: [...unknown].filter(Boolean) };
}

const sameTask = (a, b) => a.client === b.client && squash(a.text) === squash(b.text);

/** Adds new items; one already on the list (same client and wording) is not added twice. */
export function mergeTodos(existing, incoming, now = new Date()) {
  const merged = [...existing];
  let added = 0;
  for (const item of incoming) {
    if (merged.some(current => sameTask(current, item) && !current.done)) continue;
    merged.push({ id: `todo-${now.getTime().toString(36)}-${merged.length}`, ...item, done: Boolean(item.done), doneAt: item.done ? now.toISOString().slice(0, 10) : null });
    added += 1;
  }
  return { todos: merged, added, skipped: incoming.length - added };
}

export function setTodoDone(todos, id, done, now = new Date()) {
  return todos.map(item => item.id === id ? { ...item, done, doneAt: done ? now.toISOString().slice(0, 10) : null } : item);
}

/** Finished items stay visible for a while, then drop off; open items stay until you check them. */
export function pruneTodos(todos, today = new Date().toISOString().slice(0, 10), keepDays = DONE_KEEP_DAYS) {
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - keepDays * DAY_MS).toISOString().slice(0, 10);
  return todos.filter(item => !item.done || !item.doneAt || item.doneAt >= cutoff);
}

/** Open items first, the soonest due first, then the newest. */
export function sortTodos(todos) {
  return [...todos].sort((a, b) => Number(a.done) - Number(b.done) || (a.due || "9999").localeCompare(b.due || "9999") || String(b.addedOn).localeCompare(String(a.addedOn)));
}

export function todoTemplate(clients, today) {
  return [`# Northstar to-dos · ${today}`, "", ...clients.flatMap(client => [`## ${client}`, `- [ ] Example task for ${client} | due: ${today} | from: Outlook`, ""])].join("\n");
}

/** Instructions for the scheduled morning scan, so its answer can be pasted straight in. */
export function morningScanPrompt(clients) {
  return [
    "Each weekday morning, scan my Outlook email from the last business day (and any Jira tickets that mention me) for work I need to do on these clients:",
    clients.map(client => `- ${client}`).join("\n"),
    "",
    "Answer with only a checklist in this exact format, nothing before or after it:",
    "",
    "## <client name exactly as listed above>",
    "- [ ] <one short action> | due: <YYYY-MM-DD, only if a date was given> | from: <Outlook or Jira, plus the sender or ticket>",
    "",
    "Rules: one line per action, start each with a verb, leave out FYIs that need no action, skip clients with nothing to do, and do not repeat an action already done in a later reply.",
    "",
    "If you can save files, also save the checklist as northstar-todos-<YYYY-MM-DD>.md in my \"Northstar To-dos\" folder in OneDrive. The dashboard reads that folder on its own."
  ].join("\n");
}
