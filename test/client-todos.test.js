import test from "node:test";
import assert from "node:assert/strict";
import { applyBrief, INTERNAL, matchClient, mergeTodos, morningScanPrompt, parseTodoFile, pruneTodos, setTodoDone, sortTodos } from "../lib/client-todos.js";

const clients = ["Nature's Sunshine", "Highmark", "Rent A Center"];

test("reads the morning checklist under each client heading, with due dates and sources", () => {
  const { items, unknownClients } = parseTodoFile([
    "# Northstar to-dos · 2026-10-24",
    "## Natures Sunshine",
    "- [ ] Send the October ROAS recap | due: 2026-10-24 | from: Outlook, Kelley",
    "- [x] Confirm Q4 creative | from: Jira ZCA-19812",
    "## Acme Health",
    "- [ ] Not a client we track",
    "## Highmark",
    "* Raise SEPA video caps"
  ].join("\n"), { clients, today: "2026-10-24" });
  assert.deepEqual(items.map(item => [item.client, item.text, item.due, item.source, item.done, item.tracked]), [
    ["Nature's Sunshine", "Send the October ROAS recap", "2026-10-24", "Outlook, Kelley", false, true],
    ["Nature's Sunshine", "Confirm Q4 creative", null, "Jira ZCA-19812", true, true],
    ["Acme Health", "Not a client we track", null, "Morning brief", false, false],
    ["Highmark", "Raise SEPA video caps", null, "Morning brief", false, true]
  ]);
  // An account not on the dashboard is kept for the brief, and named so you can add it.
  assert.deepEqual(unknownClients, ["Acme Health"]);
});

test("reads the same to-dos from a CSV", () => {
  const { items } = parseTodoFile('client,task,due,source\nRent A Center,"Check OLA Q4, it is behind",2026-10-25,Outlook\n', { clients, today: "2026-10-24" });
  assert.deepEqual(items.map(item => [item.client, item.text, item.due]), [["Rent A Center", "Check OLA Q4, it is behind", "2026-10-25"]]);
});

test("does not add a task twice and keeps checked tasks for two weeks", () => {
  const now = new Date("2026-10-24T09:00:00Z");
  const first = mergeTodos([], [{ client: "Highmark", text: "Raise caps", addedOn: "2026-10-24" }], now);
  const again = mergeTodos(first.todos, [{ client: "Highmark", text: "raise caps!", addedOn: "2026-10-25" }], now);
  assert.equal(again.added, 0);
  const done = setTodoDone(again.todos, again.todos[0].id, true, new Date("2026-10-01T09:00:00Z"));
  assert.equal(pruneTodos(done, "2026-10-10").length, 1);
  assert.equal(pruneTodos(done, "2026-10-20").length, 0);
});

test("matches client names loosely and orders open, then soonest due", () => {
  assert.equal(matchClient("rent-a-center", clients), "Rent A Center");
  assert.equal(matchClient("Nobody", clients), null);
  const sorted = sortTodos([{ text: "a", done: true }, { text: "b", due: "2026-11-01" }, { text: "c", due: "2026-10-25" }]);
  assert.deepEqual(sorted.map(item => item.text), ["c", "b", "a"]);
  assert.match(morningScanPrompt(clients), /# Morning brief · YYYY-MM-DD/);
  assert.match(morningScanPrompt(clients), /- Rent A Center/);
  // A failed save is reported, never claimed, and retried every 15 minutes up to 4 more times.
  assert.match(morningScanPrompt(clients), /Couldn't save today's brief/);
  assert.match(morningScanPrompt(clients), /every 15 minutes, up to 4 more times \(5 tries in all\)/);
});

test("reads new and changed to-do files from a folder once each", async () => {
  const { readTodoFolder } = await import("../lib/todo-folder.js");
  const file = (name, text, lastModified) => ({ kind: "file", name, getFile: async () => ({ lastModified, text: async () => text }) });
  const files = [
    file("2026-10-24.md", "## Highmark\n- [ ] Raise SEPA caps", 1),
    file("notes.pdf", "ignored", 1),
    file("2026-10-23.md", "## Acme\n- [ ] Unknown client", 1)
  ];
  const folder = { values: async function* () { yield* files; } };
  const first = await readTodoFolder(folder, {}, { clients, today: "2026-10-24" });
  assert.equal(first.filesRead, 2);
  assert.deepEqual(first.items.filter(item => item.tracked).map(item => item.text), ["Raise SEPA caps"]);
  assert.deepEqual(first.unknownClients, ["Acme"]);
  const again = await readTodoFolder(folder, first.processed, { clients, today: "2026-10-24" });
  assert.equal(again.filesRead, 0);
  files[0] = file("2026-10-24.md", "## Highmark\n- [ ] Raise SEPA caps\n- [ ] Send recap", 2);
  const changed = await readTodoFolder(folder, first.processed, { clients, today: "2026-10-24" });
  assert.deepEqual(changed.items.map(item => item.text), ["Raise SEPA caps", "Send recap"]);
});

test("reads a morning brief: date, sources, calendar, tags, links, and agency-style headings", () => {
  const { items, brief } = parseTodoFile([
    "# Morning brief · 2026-10-24",
    "Sources: Outlook + Jira",
    "Skipped: Slack connector unavailable",
    "## Calendar",
    "- 9:30 AM · Highmark weekly sync",
    "- 1:00 PM · NPB F3 kickoff | link: https://outlook.office.com/calendar/item/AAMk123",
    "- 3:00 PM · Bad link | link: javascript:alert(1)",
    "## Nature's Sunshine (Crispin/MMI)",
    "- [ ] Send the October ROAS recap | tag: urgent | due: 2026-10-24 | from: Email from krobinson@availmediagroup.com · Today 9:15 AM",
    "## Rent-A-Center / Anchor Group / Anchor Trading",
    "- [ ] waiting · Hear back on OLA Q4 caps | from: Jira ZCA-20001 · Yesterday 4:10 PM | link: https://zetaglobal.atlassian.net/browse/ZCA-20001",
    "## Highmark (TRUth) — PA Medicaid Brand + COMM SEPA",
    "- [x] Weekly report sent | tag: fyi",
    "## Misc / Internal",
    "- [ ] Submit timesheet | tag: upcoming | due: 2026-10-31"
  ].join("\n"), { clients, today: "2026-10-24" });
  assert.deepEqual(brief, { date: "2026-10-24", sources: "Outlook + Jira", skipped: "Slack connector unavailable", calendar: [{ time: "9:30 AM", title: "Highmark weekly sync", link: null }, { time: "1:00 PM", title: "NPB F3 kickoff", link: "https://outlook.office.com/calendar/item/AAMk123" }, { time: "3:00 PM", title: "Bad link", link: null }] });
  assert.deepEqual(items.map(item => [item.client, item.tag, item.text, item.due, Boolean(item.link)]), [
    ["Nature's Sunshine", "urgent", "Send the October ROAS recap", "2026-10-24", false],
    ["Rent A Center", "waiting", "Hear back on OLA Q4 caps", null, true],
    ["Highmark", "fyi", "Weekly report sent", null, false],
    [INTERNAL, "upcoming", "Submit timesheet", "2026-10-31", false]
  ]);
});

test("a newer brief replaces the open items of older briefs and keeps what you added or checked off", () => {
  const now = new Date("2026-10-24T09:00:00Z");
  const monday = parseTodoFile("# Morning brief · 2026-10-23\n## Highmark\n- [ ] Raise SEPA caps | tag: urgent\n- [ ] Send recap\n- [ ] Fix pixel", { clients, today: "2026-10-23" });
  let todos = applyBrief([], monday, now).todos;
  todos = mergeTodos(todos, [{ client: "Highmark", text: "Call the agency", source: "Added by you" }], now).todos;
  todos = setTodoDone(todos, todos.find(item => item.text === "Fix pixel").id, true, now);
  const tuesday = parseTodoFile("# Morning brief · 2026-10-24\n## Highmark\n- [ ] Raise SEPA caps | tag: waiting\n- [ ] Fix pixel", { clients, today: "2026-10-24" });
  const result = applyBrief(todos, tuesday, now);
  const byText = Object.fromEntries(result.todos.map(item => [item.text, item]));
  assert.equal(byText["Send recap"], undefined);
  assert.equal(byText["Raise SEPA caps"].tag, "waiting");
  assert.equal(byText["Fix pixel"].done, true);
  assert.ok(byText["Call the agency"]);
  assert.deepEqual([result.added, result.updated, result.removed], [0, 1, 1]);
});

test("matches agency-style headings to dashboard clients", () => {
  const known = ["Nature's Sunshine", "Rent A Center", "Carter BloodCare", "Highmark", "McMaster-Carr", "National Pork Board"];
  assert.equal(matchClient("Carter Blood Care (Dieste)", known), "Carter BloodCare");
  assert.equal(matchClient("McMaster-Carr (Slingshot Agency)", known), "McMaster-Carr");
  assert.equal(matchClient("Highmark (TRUth) — PA Medicaid Brand + COMM SEPA", known), "Highmark");
  assert.equal(matchClient("Farm Bureau Financial Services (Slingshot)", known), null);
});
