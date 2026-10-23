import test from "node:test";
import assert from "node:assert/strict";
import { matchClient, mergeTodos, morningScanPrompt, parseTodoFile, pruneTodos, setTodoDone, sortTodos } from "../lib/client-todos.js";

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
  assert.deepEqual(items.map(item => [item.client, item.text, item.due, item.source, item.done]), [
    ["Nature's Sunshine", "Send the October ROAS recap", "2026-10-24", "Outlook, Kelley", false],
    ["Nature's Sunshine", "Confirm Q4 creative", null, "Jira ZCA-19812", true],
    ["Highmark", "Raise SEPA video caps", null, "Morning scan", false]
  ]);
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
  assert.match(morningScanPrompt(clients), /## <client name exactly as listed above>/);
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
  assert.deepEqual(first.items.map(item => item.text), ["Raise SEPA caps"]);
  assert.deepEqual(first.unknownClients, ["Acme"]);
  const again = await readTodoFolder(folder, first.processed, { clients, today: "2026-10-24" });
  assert.equal(again.filesRead, 0);
  files[0] = file("2026-10-24.md", "## Highmark\n- [ ] Raise SEPA caps\n- [ ] Send recap", 2);
  const changed = await readTodoFolder(folder, first.processed, { clients, today: "2026-10-24" });
  assert.deepEqual(changed.items.map(item => item.text), ["Raise SEPA caps", "Send recap"]);
});
