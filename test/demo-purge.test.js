import test from "node:test";
import assert from "node:assert/strict";
import { purgeDemoCampaigns } from "../lib/demo-purge.js";

const memoryStorage = initial => {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), values };
};
const demo = { client: "Apex Athletics", owner: "Jordan Davis", name: "Always On · Retargeting" };
const real = { client: "Nature's Sunshine", owner: "Jake", name: "Nature's Sunshine 2026", campaignId: "NS-1" };

test("removes seeded demo campaigns once and keeps imported ones", () => {
  const storage = memoryStorage({ "northstar-campaigns": JSON.stringify([demo, real]) });
  assert.equal(purgeDemoCampaigns(storage), 1);
  assert.deepEqual(JSON.parse(storage.getItem("northstar-campaigns")), [real]);
  storage.setItem("northstar-campaigns", JSON.stringify([demo]));
  assert.equal(purgeDemoCampaigns(storage), 0);
  assert.equal(JSON.parse(storage.getItem("northstar-campaigns")).length, 1);
});

test("keeps a campaign that only shares a name with the demo data", () => {
  const storage = memoryStorage({ "northstar-campaigns": JSON.stringify([{ ...demo, campaignId: "AA-RET-2026" }]) });
  assert.equal(purgeDemoCampaigns(storage), 0);
});

test("handles empty storage", () => {
  assert.equal(purgeDemoCampaigns(memoryStorage({})), 0);
});
