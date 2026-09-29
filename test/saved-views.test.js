import test from "node:test";
import assert from "node:assert/strict";
import { readSavedViews, removeNamedView, saveNamedView, writeSavedViews } from "../lib/saved-views.js";

test("saves, normalizes, and replaces a named dashboard view", () => {
  const first = saveNamedView([], "Apex Watchlist", { client: "Apex", status: "live", spendSource: "third" }, "2026-09-28T10:00:00Z");
  const second = saveNamedView(first.views, "apex watchlist", { client: "Apex", status: "completed", spendSource: "invalid" }, "2026-09-28T11:00:00Z");
  assert.equal(second.views.length, 1);
  assert.equal(second.views[0].view.status, "completed");
  assert.equal(second.views[0].view.spendSource, "billing");
});

test("rejects blank names and removes a saved view", () => {
  assert.equal(saveNamedView([], "  ", {}).valid, false);
  assert.deepEqual(removeNamedView(saveNamedView([], "Morning", {}).views, "morning"), []);
});

test("persists saved views and tolerates corrupt storage", () => {
  let value = "not json";
  const storage = { getItem: () => value, setItem: (_key, next) => { value = next; } };
  assert.deepEqual(readSavedViews(storage), []);
  writeSavedViews(storage, saveNamedView([], "Review", { attention: "attention" }).views);
  assert.equal(readSavedViews(storage)[0].view.attention, "attention");
});
