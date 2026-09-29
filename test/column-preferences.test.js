import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CAMPAIGN_COLUMNS, normalizeColumnPreferences, readColumnPreferences, writeColumnPreferences } from "../lib/column-preferences.js";

test("normalizes ordering, duplicates, and unsupported columns", () => {
  assert.deepEqual(normalizeColumnPreferences(["source", "spend", "source", "unknown"]), ["spend", "source"]);
});

test("uses defaults when no valid columns remain", () => {
  assert.deepEqual(normalizeColumnPreferences([]), DEFAULT_CAMPAIGN_COLUMNS);
  assert.deepEqual(normalizeColumnPreferences(["unknown"]), DEFAULT_CAMPAIGN_COLUMNS);
});

test("reads and writes browser preferences safely", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(readColumnPreferences(storage), DEFAULT_CAMPAIGN_COLUMNS);
  assert.deepEqual(writeColumnPreferences(storage, ["kpi", "budget"]), ["budget", "kpi"]);
  assert.deepEqual(readColumnPreferences(storage), ["budget", "kpi"]);
  values.set("northstar-campaign-columns", "not-json");
  assert.deepEqual(readColumnPreferences(storage), DEFAULT_CAMPAIGN_COLUMNS);
});
