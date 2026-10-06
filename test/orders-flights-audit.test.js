import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTotals, removeOrderFromTotals, setCampaignTotals, budgetUnits, unitsBudget } from "../lib/campaign-totals.js";
import { campaignPlacements, matchLinesToPlacements } from "../lib/line-flights.js";
import { auditLine } from "../lib/line-audit.js";
import { findCampaignForIo } from "../lib/io-match.js";
import { groupCampaigns } from "../lib/campaign-groups.js";

const now = new Date("2026-10-06T12:00:00Z");
const placement = (id, startDate, endDate, budget) => ({ id, name: "Package", startDate, endDate, budget });
const order = (orderNumber, revision, budget, start, end, ...placements) => ({ orderNumber, revision, budget, startDate: start, endDate: end, lineItems: placements });
const key = "rac::ola";

test("different orders add up, with the earliest start and the latest end", () => {
  let totals = setCampaignTotals({}, key, order("O-1", "R1", 51000, "2026-09-27", "2026-12-26", placement("A", "2026-09-27", "2026-10-24", 13000)), "q4.pdf", now);
  totals = setCampaignTotals(totals, key, order("O-0", "R3", 49000, "2026-03-29", "2026-09-26", placement("B", "2026-03-29", "2026-04-25", 12000)), "q2.pdf", now);
  assert.deepEqual([totals[key].budget, totals[key].startDate, totals[key].endDate, totals[key].orders.length], [100000, "2026-03-29", "2026-12-26", 2]);
  assert.equal(totals[key].order, "O-1-R1 + O-0-R3");
});

test("a new revision of an order replaces the earlier revision instead of adding to it", () => {
  let totals = setCampaignTotals({}, key, order("O-1", "R1", 50000, "2026-09-27", "2026-12-26"), "r1.pdf", now);
  totals = setCampaignTotals(totals, key, order("O-1", "R2", 60000, "2026-09-27", "2026-12-26"), "r2.pdf", now);
  assert.deepEqual([totals[key].budget, totals[key].orders.length, totals[key].order], [60000, 1, "O-1-R2"]);
  const slingshot = setCampaignTotals({}, key, order("4240", "Rev1", 100, "2026-07-06", "2026-09-30"), "a.pdf", now);
  assert.equal(setCampaignTotals(slingshot, key, order("4240", "Rev2", 120, "2026-07-06", "2026-10-30"), "b.pdf", now)[key].budget, 120);
});

test("totals saved before orders could add up still load, and orders can be removed one at a time", () => {
  const legacy = normalizeTotals({ [key]: { budget: 500, startDate: "2026-09-01", endDate: "2026-09-30", fileName: "x.pdf", order: "O-9-R1" } });
  assert.deepEqual([legacy[key].budget, legacy[key].orders.length, legacy[key].order], [500, 1, "O-9-R1"]);
  let totals = setCampaignTotals({}, key, order("O-1", "R1", 100, "2026-01-01", "2026-02-01"), "a.pdf", now);
  totals = setCampaignTotals(totals, key, order("O-2", "R1", 200, "2026-03-01", "2026-04-01"), "b.pdf", now);
  const afterRemove = removeOrderFromTotals(totals, key, "O-1-R1");
  assert.equal(normalizeTotals(afterRemove)[key].budget, 200);
  assert.equal(removeOrderFromTotals(afterRemove, key, "O-2-R1")[key], undefined);
});

test("the pooled budget unit uses the summed order budget", () => {
  const totals = setCampaignTotals(setCampaignTotals({}, "a::c", order("O-1", "R1", 100, "2026-01-01", "2026-03-01"), "a.pdf", now), "a::c", order("O-2", "R1", 50, "2026-03-02", "2026-06-01"), "b.pdf", now);
  const units = budgetUnits([{ client: "A", name: "C — F1", spend: 10, budget: 1 }, { client: "A", name: "C — F2", spend: 20, budget: 1 }], totals);
  assert.equal(units.length, 1);
  assert.equal(unitsBudget(units), 150);
  assert.equal(units[0].endDate, "2026-06-01");
});

test("an order matches by base order number when a campaign holds several orders", () => {
  const groups = groupCampaigns([{ client: "R", name: "OLA — Flight 1", spend: 1 }]);
  let totals = setCampaignTotals({}, groups[0].key, order("O-1", "R1", 100, "2026-01-01", "2026-02-01"), "a.pdf", now);
  totals = setCampaignTotals(totals, groups[0].key, order("O-2", "R1", 100, "2026-03-01", "2026-04-01"), "b.pdf", now);
  const match = findCampaignForIo(groups, totals, { orderNumber: "O-1", revision: "R2", campaign: "Other" });
  assert.deepEqual([match.key, match.reason, match.isRevision], [groups[0].key, "order", true]);
});

const entry = { orders: [
  { order: "O-2-R1", placements: [placement("C", "2026-06-28", "2026-07-25", 20000), placement("A", "2026-04-26", "2026-05-30", 21000)] },
  { order: "O-1-R1", placements: [placement("B", "2026-05-31", "2026-06-27", 30000), placement("A", "2026-04-26", "2026-05-30", 21000)] }
] };
const recordLine = name => ({ kind: "record", name, record: { name } });

test("lists every placement of every order earliest first", () => {
  assert.deepEqual(campaignPlacements(entry).map(item => [item.id, item.order]), [["A", "O-2-R1"], ["A", "O-1-R1"], ["B", "O-1-R1"], ["C", "O-2-R1"]]);
  assert.deepEqual(campaignPlacements(undefined), []);
});

test("pairs 'Flight N' lines with the N-th flight and never guesses at unnumbered lines", () => {
  const placements = campaignPlacements({ orders: [{ order: "O-1", placements: [placement("A", "2026-04-26", "2026-05-30", 1), placement("B", "2026-05-31", "2026-06-27", 2), placement("C", "2026-06-28", "2026-07-25", 3)] }] });
  const lines = [recordLine("Flight 2"), recordLine("Flight 1 — Display"), recordLine("Flight 3")];
  const matched = matchLinesToPlacements(lines, placements);
  assert.deepEqual(lines.map(line => matched.get(line)?.id), ["B", "A", "C"]);
  const unnumbered = [recordLine("Alpha"), recordLine("Beta"), recordLine("Gamma")];
  assert.equal(matchLinesToPlacements(unnumbered, placements).size, 0);
  const mismatched = [recordLine("Alpha"), recordLine("Beta")];
  assert.equal(matchLinesToPlacements(mismatched, placements).size, 0);
  assert.equal(matchLinesToPlacements([recordLine("Flight 9")], placements).size, 0);
});

test("audits a line: sources, present and missing fields, and why a metric cannot be calculated", () => {
  const record = { name: "Hyperlocal — Flight 2", kpi: "CPA", spend: 30655, firstPartySpend: null, thirdPartySpend: 30655, budget: 20782.86, clicks: 245, conversions: 631, dataAsOf: "2026-09-28", source: "Zeta Global", sourceSheet: "Hyperlocal", sourceRow: 9, sourceFile: "rac.xlsx", pacing: 148 };
  const audit = auditLine({ ...record, kind: "record", record });
  assert.equal(audit.source, "From sheet “Hyperlocal”, row 9 of rac.xlsx");
  assert.deepEqual(audit.missing.sort(), ["CTR", "Flight dates", "Impressions"]);
  assert.ok(audit.notes.some(note => note.includes("Impressions are missing")));
  assert.ok(audit.notes.some(note => note.includes("No flight dates")));
  assert.equal(audit.chips.find(item => item.label === "Clicks").state, "ok");
});

test("an audit shows IO-sourced dates, flags a budget that differs from the order, and a clean line has no notes", () => {
  const record = { name: "Flight 1", kpi: "CTR", spend: 100, budget: 23751.74, impressions: 1_000_000, clicks: 500, startDate: null, endDate: null };
  const audit = auditLine({ ...record, kind: "record", record }, { placement: { startDate: "2026-04-26", endDate: "2026-05-30", budget: 21165.86 }, order: "O-D2OMH3E-R2" });
  assert.equal(audit.chips.find(item => item.label === "Flight dates").state, "ok");
  assert.ok(audit.notes.some(note => note.includes("come from the insertion order O-D2OMH3E-R2: 2026-04-26 → 2026-05-30")));
  assert.ok(audit.notes.some(note => note.includes("differs from the order's $21,165.86")));
  const clean = { name: "Line", kpi: "CTR", spend: 5, budget: 100, impressions: 1000, clicks: 10, startDate: "2026-01-01", endDate: "2026-02-01", sourceSheet: "S", sourceRow: 2 };
  assert.deepEqual(auditLine({ ...clean, kind: "record", record: clean }).notes, []);
  assert.equal(auditLine({ ...clean, kind: "record", record: clean }).source, "From sheet “S”, row 2");
});
