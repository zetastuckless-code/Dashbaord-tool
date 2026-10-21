import test from "node:test";
import assert from "node:assert/strict";
import { budgetUnits, normalizeTotals, readCampaignTotals, removeCampaignTotals, setCampaignTotals, unitsBudget, unitsPacing, writeCampaignTotals } from "../lib/campaign-totals.js";
import { computeMetrics } from "../lib/metric-catalog.js";
import { buildClientRollup } from "../lib/client-rollup.js";
import { evaluateCampaignAlerts } from "../lib/alert-engine.js";
import { groupCampaigns, groupKey } from "../lib/campaign-groups.js";

const asOf = new Date("2026-09-16T12:00:00Z");
// Two report lines whose own budgets (and flights) disagree with the insertion order.
const lineA = { client: "H", name: "B2B — Standard Display", short: "H", className: "x", spend: 100, budget: 10_000, startDate: "2026-09-01", endDate: "2026-09-30", impressions: 5000, clicks: 10, kpi: "CTR", value: "0.2%", target: "Target 0.2%", source: "Zeta" };
const lineB = { ...lineA, name: "B2B — OLV", spend: 200, budget: 30_000 };
const io = { budget: 600, startDate: "2026-09-01", endDate: "2026-09-30", orderNumber: "O-1", revision: "R2" };
const key = groupKey(lineA);
const totals = setCampaignTotals({}, key, io, "io.pdf", asOf);

test("a campaign with totals becomes one unit measured on the IO budget and flight", () => {
  const units = budgetUnits([lineA, lineB], totals);
  assert.equal(units.length, 1);
  assert.equal(unitsBudget(units), 600);
  assert.equal(units[0].spend, 300);
  // 16 of 30 days elapsed: expected 320, spend 300
  assert.ok(Math.abs(unitsPacing(units, asOf) - 93.75) < 0.01);
});

test("campaigns without totals keep their own budgets, one unit per record", () => {
  const units = budgetUnits([lineA, lineB], {});
  assert.equal(units.length, 2);
  assert.equal(unitsBudget(units), 40_000);
});

test("group metrics use the IO budget, remaining, and pacing while line rows keep their own", () => {
  const group = computeMetrics([lineA, lineB], { asOf, totals: totals[key] });
  assert.equal(group.budget, 600);
  assert.equal(group.remaining, 300);
  assert.ok(Math.abs(group.pacing - 93.75) < 0.01);
  const line = computeMetrics(lineA, { asOf });
  assert.equal(line.budget, 10_000);
  const without = computeMetrics([lineA, lineB], { asOf });
  assert.equal(without.budget, 40_000);
});

test("client cards roll up budget and pacing from the totals override", () => {
  const [client] = buildClientRollup([lineA, lineB], { asOf, totals });
  assert.equal(client.budget, 600);
  assert.ok(Math.abs(client.pacing - 93.75) < 0.01);
  assert.equal(client.utilization, 50);
});

test("pacing alerts fire once per totals campaign against the IO total, and no budget alert is raised", () => {
  const over = setCampaignTotals({}, key, { ...io, budget: 100 }, "io.pdf", asOf);
  const alerts = evaluateCampaignAlerts([{ ...lineA, budget: null }, { ...lineB, budget: null }], undefined, asOf, { totals: over });
  assert.equal(alerts.filter(alert => alert.title === "Overpacing").length, 1);
  assert.equal(alerts.some(alert => alert.title === "Budget needed"), false);
  const plain = evaluateCampaignAlerts([{ ...lineA, budget: null }, { ...lineB, budget: null }], undefined, asOf);
  assert.equal(plain.filter(alert => alert.title === "Budget needed").length, 2);
});

test("persists, normalizes, and removes totals", () => {
  const data = new Map();
  const storage = { getItem: name => data.get(name) ?? null, setItem: (name, value) => data.set(name, value) };
  writeCampaignTotals(storage, { ...totals, bad: { budget: -1 } });
  const read = readCampaignTotals(storage);
  assert.deepEqual(Object.keys(read), [key]);
  assert.equal(read[key].order, "O-1-R2");
  assert.deepEqual(Object.keys(removeCampaignTotals(read, key)), []);
  storage.setItem("northstar-campaign-totals", "{nope");
  assert.deepEqual(readCampaignTotals(storage), {});
  assert.deepEqual(normalizeTotals([]), {});
});

test("a spend-less placeholder from an IO is hidden once real lines join its campaign", () => {
  const placeholder = { client: "H", name: "B2B", short: "H", className: "x", source: "Manual", spend: 0, budget: 600, startDate: "2026-09-01", endDate: "2026-09-30" };
  const [alone] = groupCampaigns([placeholder], asOf);
  assert.equal(alone.lines.length, 1);
  const [joined] = groupCampaigns([placeholder, { ...lineA, campaignGroup: "B2B", name: "B2B — Standard Display" }], asOf);
  assert.equal(joined.records.length, 2);
  assert.deepEqual(joined.lines.map(line => line.name), ["Standard Display"]);
});

test("an edited flight overrides the orders' dates, survives removing an order, and clears when emptied", async () => {
  const { setCampaignTotals, setTotalsFlight, removeOrderFromTotals } = await import("../lib/campaign-totals.js");
  const now = new Date("2026-10-06T12:00:00Z");
  let totals = setCampaignTotals({}, "a::c", { orderNumber: "O-1", revision: "R1", budget: 100, startDate: "2026-01-01", endDate: "2026-03-01", lineItems: [] }, "a.pdf", now);
  totals = setCampaignTotals(totals, "a::c", { orderNumber: "O-2", revision: "R1", budget: 50, startDate: "2026-03-02", endDate: "2026-04-01", lineItems: [] }, "b.pdf", now);
  const edited = setTotalsFlight(totals, "a::c", "2026-01-01", "2026-12-31");
  assert.deepEqual([edited["a::c"].startDate, edited["a::c"].endDate], ["2026-01-01", "2026-12-31"]);
  assert.equal(removeOrderFromTotals(edited, "a::c", "O-2-R1")["a::c"].endDate, "2026-12-31");
  assert.equal(setTotalsFlight(edited, "a::c", "", "")["a::c"].endDate, "2026-04-01");
  assert.equal(setCampaignTotals(edited, "a::c", { orderNumber: "O-3", revision: "R1", budget: 10, startDate: "2026-05-01", endDate: "2026-06-01", lineItems: [] }, "c.pdf", now)["a::c"].endDate, "2026-06-01");  // a newly applied order brings its own dates
});
