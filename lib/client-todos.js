// Client to-dos and the morning brief. A scheduled ChatGPT task reads Outlook, Jira, and Slack, writes a brief grouped by
// client account, and saves it where the dashboard reads it. Each brief replaces the last brief's open items, so
// resolved things drop off; items you add yourself or check off stay. Checked items clear two weeks after.

export const TODOS_KEY = "northstar-todos";
export const BRIEF_KEY = "northstar-brief";
export const DONE_KEEP_DAYS = 14;
export const INTERNAL = "Misc / Internal";
export const TAGS = ["urgent", "waiting", "todo", "upcoming", "fyi"];
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

export function readBrief(storage) {
  try {
    const value = JSON.parse(storage.getItem(BRIEF_KEY));
    return value && typeof value === "object" && isIsoDate(value.date) ? value : null;
  } catch {
    return null;
  }
}

/**
 * The dashboard client a heading means. Headings carry agencies and sub-brands ("Nature's Sunshine (Crispin/MMI)",
 * "Rent-A-Center / Anchor Group", "Highmark (TRUth) — COMM SEPA"), so each part is tried, ignoring case and punctuation.
 */
export function matchClient(name, clients) {
  const raw = String(name ?? "").trim();
  if (!raw) return null;
  const plain = raw.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const candidates = [raw, plain, ...plain.split(/\s+[\/—–]\s+|\s+-\s+/)].map(squash).filter(Boolean);
  for (const wanted of candidates) {
    const exact = clients.find(client => squash(client) === wanted);
    if (exact) return exact;
  }
  for (const wanted of candidates) {
    const loose = clients.find(client => squash(client).length >= 4 && (wanted.startsWith(squash(client)) || squash(client).startsWith(wanted)));
    if (loose) return loose;
  }
  return null;
}

const normalizeTag = value => {
  const tag = String(value ?? "").trim().toLowerCase();
  if (tag === "done") return "fyi";
  return TAGS.includes(tag) ? tag : null;
};

/** "Send recap | tag: urgent | due: 2026-10-24 | from: Email from Kelley · Today 9:15 AM | link: https://…" */
function parseTaskText(raw) {
  const parts = raw.split(" | ").map(part => part.trim()).filter(Boolean);
  let text = parts.shift() || "";
  const item = { due: null, source: null, link: null, tag: null };
  // A leading tag also works: "urgent · Send recap" or "[urgent] Send recap".
  const leading = /^(?:\[(\w+)\]\s*|(\w+)\s*[·:]\s+)/.exec(text);
  if (leading && normalizeTag(leading[1] || leading[2])) { item.tag = normalizeTag(leading[1] || leading[2]); text = text.slice(leading[0].length); }
  for (const part of parts) {
    const field = /^(due|from|source|link|tag)\s*:\s*(.+)$/i.exec(part);
    if (!field) { text = `${text} | ${part}`; continue; }
    const [key, value] = [field[1].toLowerCase(), field[2].trim()];
    if (key === "due") item.due = isIsoDate(value) ? value : item.due;
    else if (key === "link") item.link = /^https?:\/\//i.test(value) ? value : null;
    else if (key === "tag") item.tag = normalizeTag(value) || item.tag;
    else item.source = value;
  }
  return { ...item, text: text.replace(/\*\*/g, "").trim() };
}

/**
 * Reads a morning brief or a plain checklist. "# Morning brief · YYYY-MM-DD" marks a brief; "Sources:" and "Skipped:"
 * lines describe it; "## Calendar" holds today's meetings; every other "## Account" heading holds that account's items,
 * with "## Misc / Internal" for anything not client-specific. A CSV with client, task, due, and source columns works too.
 * Accounts not on the dashboard are kept (shown with the brief) and listed in `unknownClients`.
 */
export function parseTodoFile(text, { clients = [], today = new Date().toISOString().slice(0, 10) } = {}) {
  const lines = String(text ?? "").replace(/^﻿/, "").split(/\r?\n/);
  const items = [];
  const unknown = new Set();
  let brief = null;
  const add = (heading, task) => {
    if (!task.text) return;
    const internal = /^(misc|internal|other)\b/i.test(heading.trim());
    const client = internal ? INTERNAL : matchClient(heading, clients);
    if (!client) unknown.add(heading.trim());
    items.push({
      client: client || heading.replace(/\s+/g, " ").trim(), tracked: Boolean(client), text: task.text, due: task.due, source: task.source || "Morning brief",
      link: task.link || null, tag: task.done ? "fyi" : task.tag || "todo", done: Boolean(task.done)
    });
  };
  const firstLine = lines.find(line => line.trim())?.toLowerCase().trim() || "";
  if (/^client\s*,/.test(firstLine)) {
    const columns = firstLine.split(",").map(column => column.trim());
    const at = name => columns.indexOf(name);
    for (const line of lines.slice(lines.findIndex(entry => entry.trim()) + 1)) {
      if (!line.trim()) continue;
      const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(cell => cell.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim());
      const due = cells[at("due")];
      add(cells[at("client")] || "", { text: cells[at("task")] || "", due: isIsoDate(due) ? due : null, source: cells[at("source")] || null, tag: normalizeTag(cells[at("tag")]), link: cells[at("link")] || null });
    }
  } else {
    let section = "";
    for (const line of lines) {
      const title = /^#\s+(.+)$/.exec(line);
      if (title) {
        const date = /(\d{4}-\d{2}-\d{2})/.exec(title[1])?.[1];
        if (/brief/i.test(title[1]) || date) brief = { ...(brief || {}), date: date || today, sources: brief?.sources || "", skipped: brief?.skipped || "", calendar: brief?.calendar || [] };
        continue;
      }
      const meta = /^(sources|skipped)\s*:\s*(.+)$/i.exec(line.trim());
      if (meta && brief) { brief[meta[1].toLowerCase()] = meta[2].trim(); continue; }
      const heading = /^#{2,3}\s+(.+?)\s*$/.exec(line);
      if (heading) { section = heading[1]; continue; }
      const bullet = /^\s*[-*]\s*(?:\[( |x|X)\]\s*)?(.+)$/.exec(line);
      if (!bullet || !section) continue;
      if (/^(today'?s\s+)?calendar|^meetings/i.test(section)) {
        if (!brief) brief = { date: today, sources: "", skipped: "", calendar: [] };
        const [time, ...rest] = bullet[2].split(/\s+[·—–-]\s+/);
        brief.calendar.push(rest.length ? { time: time.trim(), title: rest.join(" · ").trim() } : { time: "", title: bullet[2].trim() });
        continue;
      }
      add(section, { ...parseTaskText(bullet[2]), done: /x/i.test(bullet[1] || "") });
    }
  }
  return { items: items.map(item => ({ ...item, addedOn: today })), unknownClients: [...unknown].filter(Boolean), brief };
}

const sameTask = (a, b) => a.client === b.client && squash(a.text) === squash(b.text);
let idCounter = 0;
const newId = now => `todo-${now.getTime().toString(36)}-${(idCounter += 1).toString(36)}`;

/** Adds new items; one already on the list (same account and wording) is not added twice. */
export function mergeTodos(existing, incoming, now = new Date()) {
  const merged = [...existing];
  let added = 0;
  for (const item of incoming) {
    if (merged.some(current => sameTask(current, item))) continue;
    merged.push({ ...item, id: newId(now), done: Boolean(item.done), doneAt: item.done ? now.toISOString().slice(0, 10) : null });
    added += 1;
  }
  return { todos: merged, added, skipped: incoming.length - added };
}

/**
 * Takes in a brief: its items replace the open items of earlier briefs (so anything resolved since drops off), while
 * items you added or checked off stay. An item you already checked off is not brought back as open.
 */
export function applyBrief(existing, parsed, now = new Date()) {
  const date = parsed.brief?.date || now.toISOString().slice(0, 10);
  const fresh = parsed.items.map(item => ({ ...item, origin: "brief", briefDate: date }));
  const isStale = item => item.origin === "brief" && !item.done && String(item.briefDate || "") <= date && !fresh.some(next => sameTask(next, item));
  const kept = existing.filter(item => !isStale(item));
  let added = 0;
  let updated = 0;
  const next = [...kept];
  for (const item of fresh) {
    const match = next.findIndex(current => sameTask(current, item));
    if (match >= 0) {
      if (next[match].done || next[match].origin !== "brief") continue;
      next[match] = { ...next[match], ...item, id: next[match].id };
      updated += 1;
    } else {
      next.push({ ...item, id: newId(now), doneAt: item.done ? now.toISOString().slice(0, 10) : null });
      added += 1;
    }
  }
  return { todos: next, added, updated, removed: existing.length - kept.length };
}

export function setTodoDone(todos, id, done, now = new Date()) {
  return todos.map(item => item.id === id ? { ...item, done, doneAt: done ? now.toISOString().slice(0, 10) : null } : item);
}

/** Finished items stay visible for a while, then drop off; open items stay until you check them or a brief resolves them. */
export function pruneTodos(todos, today = new Date().toISOString().slice(0, 10), keepDays = DONE_KEEP_DAYS) {
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - keepDays * DAY_MS).toISOString().slice(0, 10);
  return todos.filter(item => !item.done || !item.doneAt || item.doneAt >= cutoff);
}

const tagRank = item => item.done ? 9 : TAGS.indexOf(item.tag || "todo");

/** Open items first by urgency (urgent, waiting, to-do, upcoming, FYI), then the soonest due, then the newest. */
export function sortTodos(todos) {
  return [...todos].sort((a, b) => Number(a.done) - Number(b.done) || tagRank(a) - tagRank(b) || (a.due || "9999").localeCompare(b.due || "9999") || String(b.addedOn).localeCompare(String(a.addedOn)));
}

/** An item still needing something from you: not checked off and not just for information. */
export const isOpen = item => !item.done && item.tag !== "fyi";

export function todoTemplate(clients, today) {
  return [
    `# Morning brief · ${today}`,
    "Sources: Outlook + Jira + Slack",
    "",
    "## Calendar",
    "- 9:30 AM · Example client weekly sync",
    "",
    ...clients.flatMap(client => [`## ${client}`, `- [ ] Example action for ${client} | tag: todo | due: ${today} | from: Email from name@example.com · Today 8:15 AM`, ""]),
    `## ${INTERNAL}`,
    "- [ ] Example internal item | tag: fyi | from: Jira weekly digest · Today 7:00 AM"
  ].join("\n");
}

/** The full scheduled-task prompt for ChatGPT, modeled on the Claude morning brief and written for this dashboard. */
export function morningScanPrompt(clients) {
  const accounts = clients.length ? clients.map(client => `- ${client}`).join("\n") : "- (none yet)";
  return `Generate Jake's (zetastuckless@gmail.com) morning brief for the Northstar dashboard. This must be self-contained: you have no memory of any earlier run. Use today's date and time from this run.

## 1. Use these connectors
- Outlook Email and Outlook Calendar (both must be turned on for this task).
- Jira / Atlassian (site zetaglobal.atlassian.net).
- Slack, only if it is connected.
If a connector is missing, errors, or returns nothing, skip it and list it on the "Skipped:" line. Never stop the brief because one source failed.

## 2. Pull the data
Calendar: today's events from now to the end of the day, local time.
Email: search the Inbox for messages received in the last 24 hours (on Monday, since Friday morning). Read each one, unread or not. Flag anything that is time-sensitive, comes from a client, agency, or VIP, asks a question, or needs a reply, approval, or file. Also check replies in threads Jake started.
Jira: search with JQL (assignee = currentUser() OR text ~ "jstuckless" OR comment ~ "jstuckless" OR watcher = currentUser()) AND updated >= -2d ORDER BY updated DESC. Read the latest comments on tickets worth surfacing. Treat recently updated, commented, or mentioned tickets as to-dos.
Slack (if connected): mentions, unread threads, and unread DMs from the last 24 hours.

## 3. Group by client account, not by source
Accounts already on the dashboard (use these names exactly as headings):
${accounts}
Other accounts Jake works may show up (for example Farm Bureau Financial Services, MediaDesk, Aaron's): give each its own heading. Anything not client-specific (billing reminders, digests, IT alerts, company announcements) goes under "## ${INTERNAL}".

Tag every item:
- urgent: needs action today or is blocking someone
- waiting: blocked on someone else's reply
- todo: needs action, not time-critical
- upcoming: a future deadline to keep on the radar
- fyi: information only, or already resolved

## 4. Write the brief in exactly this format, with nothing before or after it
# Morning brief · YYYY-MM-DD
Sources: Outlook + Jira + Slack   (list only the sources you could read)
Skipped: Slack connector unavailable   (leave this line out if nothing was skipped)

## Calendar
- 9:30 AM · Meeting title

## <Account name>
- [ ] One short action, starting with a verb | tag: urgent | due: YYYY-MM-DD | from: Email from name@zetaglobal.com · Today 9:15 AM | link: https://zetaglobal.atlassian.net/browse/ZCA-123

Rules: one line per item. Leave out "due:" when there is no date and "link:" when there is no ticket or URL. Mark an fyi item "- [x]". Skip accounts with nothing new. Keep each line under about 25 words.

## 5. Save it
Save the brief as northstar-brief-YYYY-MM-DD.md in Jake's OneDrive folder "Northstar To-dos". The dashboard reads that folder on its own. Then reply with the same brief so it is visible in the chat too.`;
}
