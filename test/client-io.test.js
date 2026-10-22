import test from "node:test";
import assert from "node:assert/strict";
import { buildClientIoSummary } from "../lib/client-io.js";
import { groupKey } from "../lib/campaign-groups.js";
import { setCampaignTotals, setTotalsFlight } from "../lib/campaign-totals.js";

const record = (overrides = {}) => ({ client: "Acme", name: "Spring Push — Display", channel: "Display", spend: 1000, budget: 5000, startDate: "2026-09-01", endDate: "2026-10-31", ...overrides });
const io = { orderNumber: "O-100", revision: "R1", budget: 60000, startDate: "2026-09-01", endDate: "2026-11-30", lineItems: [
  { id: "P2", name: "Flight 2", startDate: "2026-10-15", endDate: "2026-11-30", budget: 30000 },
  { id: "P1", name: "Flight 1", startDate: "2026-09-01", endDate: "2026-10-14", budget: 30000 },
  { id: "AV", name: "Bonus", startDate: "2026-09-01", endDate: "2026-11-30", budget: 0, addedValue: true }
] };

test("shows the order, flight, budget and placements behind a campaign", () => {
  const rows = [record()];
  const totals = setCampaignTotals({}, groupKey(rows[0]), io, "acme-io.pdf", new Date("2026-09-02T10:00:00Z"));
  const [campaign] = buildClientIoSummary({ campaigns: rows, totals, client: "Acme" });
  assert.equal(campaign.name, "Spring Push");
  assert.equal(campaign.hasIo, true);
  assert.equal(campaign.budget, 60000);
  assert.deepEqual([campaign.startDate, campaign.endDate], ["2026-09-01", "2026-11-30"]);
  assert.deepEqual(campaign.orders.map(order => [order.order, order.fileName]), [["O-100-R1", "acme-io.pdf"]]);
  assert.deepEqual(campaign.placements.map(placement => placement.name), ["Flight 1", "Flight 2"]);
});

test("adds up several orders and flags a hand-edited flight", () => {
  const rows = [record()];
  const key = groupKey(rows[0]);
  let totals = setCampaignTotals({}, key, io, "a.pdf");
  totals = setCampaignTotals(totals, key, { ...io, orderNumber: "O-200", revision: "", budget: 10000 }, "b.pdf");
  totals = setTotalsFlight(totals, key, "2026-09-05", "2026-12-15");
  const [campaign] = buildClientIoSummary({ campaigns: rows, totals, client: "Acme" });
  assert.equal(campaign.budget, 70000);
  assert.equal(campaign.orders.length, 2);
  assert.equal(campaign.flightEdited, true);
  assert.deepEqual([campaign.startDate, campaign.endDate], ["2026-09-05", "2026-12-15"]);
});

test("falls back to IO fields saved on the campaign, and marks campaigns with no IO", () => {
  const rows = [
    record({ name: "Fall Launch", budgetSource: "io", ioFileName: "fall.pdf", ioOrder: "F-1", budget: 25000, lineItemFlights: [{ id: "L1", name: "Line 1", source: "io", startDate: "2026-09-01", endDate: "2026-10-01", budget: 25000 }] }),
    record({ name: "Always On", budgetSource: "report" })
  ];
  const summary = buildClientIoSummary({ campaigns: rows, totals: {}, client: "Acme" });
  const fall = summary.find(item => item.name === "Fall Launch");
  const always = summary.find(item => item.name === "Always On");
  assert.equal(fall.hasIo, true);
  assert.equal(fall.budget, 25000);
  assert.deepEqual(fall.orders.map(order => order.fileName), ["fall.pdf"]);
  assert.equal(fall.placements.length, 1);
  assert.equal(always.hasIo, false);
  assert.equal(always.budget, null);
});

test("ignores other clients and archived campaigns", () => {
  const rows = [record(), record({ client: "Other" }), record({ name: "Old — Display", archivedAt: "2026-01-01T00:00:00Z" })];
  assert.deepEqual(buildClientIoSummary({ campaigns: rows, totals: {}, client: "Acme" }).map(item => item.name), ["Spring Push"]);
});
