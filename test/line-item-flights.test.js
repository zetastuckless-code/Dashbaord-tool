import test from "node:test";
import assert from "node:assert/strict";
import { exportLineItemFlightsCsv, importLineItemFlightsCsv, removeLineItemFlight, saveLineItemFlight, summarizeLineItemBudgets } from "../lib/line-item-flights.js";

const input = { id: "LI-100", name: "Display prospecting", startDate: "2026-09-27", endDate: "2026-10-24", budget: "$13,285.30" };

test("creates one budgeted flight for a line item", () => {
  const result = saveLineItemFlight({ name: "Q4" }, input, new Date("2026-09-25T12:00:00Z"));
  assert.equal(result.valid, true);
  assert.equal(result.created, true);
  assert.deepEqual(result.campaign.lineItemFlights, [{ ...input, budget: 13285.3, updatedAt: "2026-09-25T12:00:00.000Z" }]);
});

test("updates the existing flight instead of duplicating its line item", () => {
  const first = saveLineItemFlight({}, input).campaign;
  const result = saveLineItemFlight(first, { ...input, id: "li-100", budget: 15000 });
  assert.equal(result.created, false);
  assert.equal(result.campaign.lineItemFlights.length, 1);
  assert.equal(result.campaign.lineItemFlights[0].budget, 15000);
});

test("rejects invalid flights without mutating the campaign", () => {
  const campaign = { lineItemFlights: [] };
  const result = saveLineItemFlight(campaign, { id: "", name: "", startDate: "2026-10-24", endDate: "2026-09-27", budget: 0 });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 3);
  assert.equal(result.campaign, campaign);
});

test("summarizes allocated and remaining campaign budget", () => {
  const summary = summarizeLineItemBudgets({ budget: 20000, lineItemFlights: [{ budget: 13285.3 }, { budget: 6714.7 }] });
  assert.deepEqual(summary, { allocated: 20000, campaignBudget: 20000, remaining: 0, fullyAllocated: true, overAllocated: false });
});

test("rejects a line item allocation that exceeds the campaign budget", () => {
  const campaign = { budget: 15000, lineItemFlights: [{ id: "LI-1", budget: 10000 }] };
  const result = saveLineItemFlight(campaign, { ...input, id: "LI-2", budget: 6000 });
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /cannot exceed/);
  assert.equal(result.campaign, campaign);
});

test("exports auditable line item flight allocations", () => {
  const csv = exportLineItemFlightsCsv({ client: "Apex, Inc.", name: "Q4", campaignId: "CMP-4", budget: 20000, lineItemFlights: [{ ...input, budget: 13285.3 }] });
  assert.match(csv, /^client,campaign,campaign_id,line_item_id/);
  assert.match(csv, /"Apex, Inc\.",Q4,CMP-4,LI-100,Display prospecting,2026-09-27,2026-10-24,13285.3,20000/);
});

test("removes a line item flight without mutating the original campaign", () => {
  const campaign = { lineItemFlights: [{ id: "LI-1", budget: 100 }, { id: "LI-2", budget: 200 }] };
  const result = removeLineItemFlight(campaign, "li-1");
  assert.equal(result.removed, true);
  assert.deepEqual(result.campaign.lineItemFlights, [{ id: "LI-2", budget: 200 }]);
  assert.equal(campaign.lineItemFlights.length, 2);
  assert.equal(removeLineItemFlight(campaign, "missing").campaign, campaign);
});

test("round-trips an exported line-item flight plan", () => {
  const source = { client: "Apex", name: "Q4", campaignId: "CMP-4", budget: 20000, lineItemFlights: [{ ...input, budget: 13285.3 }] };
  const target = { client: "Apex", name: "Q4", campaignId: "CMP-4", budget: 20000 };
  const result = importLineItemFlightsCsv(target, exportLineItemFlightsCsv(source));
  assert.equal(result.valid, true);
  assert.equal(result.imported, 1);
  assert.equal(result.campaign.lineItemFlights[0].budget, 13285.3);
});

test("rejects line-item imports atomically for mismatched campaigns or invalid totals", () => {
  const header = "campaign_id,line_item_id,line_item_name,flight_start,flight_end,line_item_budget";
  const campaign = { campaignId: "CMP-4", budget: 10000 };
  const result = importLineItemFlightsCsv(campaign, `${header}\nCMP-4,LI-1,Display,2026-09-27,2026-10-24,6000\nOTHER,LI-2,Video,2026-09-27,2026-10-24,4000`);
  assert.equal(result.valid, false);
  assert.equal(result.imported, 0);
  assert.equal(result.campaign, campaign);
  assert.match(result.errors[0], /campaign ID/);
});
