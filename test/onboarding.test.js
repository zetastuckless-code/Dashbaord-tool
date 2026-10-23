import test from "node:test";
import assert from "node:assert/strict";
import { setupProgress } from "../lib/onboarding.js";

const placeholder = record => record.source === "Manual" && !(record.spend > 0);
const io = { "Acme::Acme Q4": { orders: [{ order: "1" }] } };
const shell = { client: "Acme", name: "Acme Q4", source: "Manual", spend: 0 };
const report = { client: "Acme", name: "Acme Q4 — Display", source: "Zeta Global", spend: 1200 };

test("an empty workspace gets the full welcome", () => {
  const progress = setupProgress();
  assert.equal(progress.mode, "welcome");
  assert.equal(progress.doneCount, 0);
});

test("an IO on its own keeps the welcome and names the client", () => {
  const progress = setupProgress({ campaigns: [shell], totals: io, isPlaceholder: placeholder });
  assert.equal(progress.mode, "welcome");
  assert.deepEqual(progress.steps.map(step => step.done), [true, false, false]);
  assert.equal(progress.ioClient, "Acme");
});

test("a report moves to the checklist and points at that client", () => {
  const progress = setupProgress({ campaigns: [shell, report], totals: io, isPlaceholder: placeholder });
  assert.equal(progress.mode, "checklist");
  assert.equal(progress.reportClient, "Acme");
  assert.equal(progress.coreDone, false);
});

test("opening a client finishes setup, and dismissing hides it", () => {
  assert.equal(setupProgress({ campaigns: [report], totals: io, state: { openedClient: "Acme" } }).coreDone, true);
  assert.equal(setupProgress({ state: { dismissed: true } }).mode, "hidden");
});
