import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDataHealth } from "../lib/data-health.js";

const now = new Date("2026-09-24T12:00:00Z");
const record = (status, importedAt) => ({ status, importedAt });

test("reports an empty state before the first import", () => {
  assert.deepEqual(evaluateDataHealth([], now), { state: "empty", title: "Demo data", detail: "No reports imported", lastSync: "Not available" });
});

test("reports healthy and stale successful imports", () => {
  assert.equal(evaluateDataHealth([record("Imported", "2026-09-24T11:52:00Z")], now).state, "healthy");
  const stale = evaluateDataHealth([record("Imported", "2026-09-22T10:00:00Z")], now);
  assert.equal(stale.state, "stale");
  assert.equal(stale.lastSync, "2 days ago");
});

test("surfaces successful imports with warnings for review", () => {
  const history = [{ status: "Imported with warnings", importedAt: "2026-09-24T11:30:00Z", warnings: ["Missing campaign IDs", "Missing flight dates"] }];
  const health = evaluateDataHealth(history, new Date("2026-09-24T12:00:00Z"));
  assert.equal(health.state, "warning");
  assert.equal(health.title, "Imported with warnings");
  assert.equal(health.detail, "2 items to review");
});

test("stale warning imports prioritize staleness", () => {
  const history = [{ status: "Imported with warnings", importedAt: "2026-09-22T10:00:00Z", warnings: ["Missing IDs"] }];
  assert.equal(evaluateDataHealth(history, now).state, "stale");
});

test("surfaces failures occurring after the latest success", () => {
  const health = evaluateDataHealth([record("Rejected", "2026-09-24T11:59:00Z"), record("Imported", "2026-09-24T11:30:00Z")], now);
  assert.equal(health.state, "warning");
  assert.equal(health.detail, "1 issue since last sync");
});

test("does not keep older failures unresolved after a successful import", () => {
  assert.equal(evaluateDataHealth([record("Imported", "2026-09-24T11:59:00Z"), record("Rejected", "2026-09-24T11:30:00Z")], now).state, "healthy");
});

test("reports an error when every attempt failed", () => {
  assert.deepEqual(evaluateDataHealth([record("Rejected", "2026-09-24T11:59:00Z")], now), { state: "error", title: "Import attention needed", detail: "1 unsuccessful attempt", lastSync: "Never" });
});
