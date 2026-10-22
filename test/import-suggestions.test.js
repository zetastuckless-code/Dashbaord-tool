import test from "node:test";
import assert from "node:assert/strict";
import { assignmentKey, suggestCampaigns } from "../lib/import-assignment.js";
import { groupCampaigns } from "../lib/campaign-groups.js";
import { setCampaignTotals } from "../lib/campaign-totals.js";

const shell = (client, name) => ({ client, name, source: "Manual", spend: 0 });
const order = (budget, startDate, endDate, placements = []) => ({ orderNumber: "O-1", budget, startDate, endDate, lineItems: placements.map((value, index) => ({ id: `p${index}`, name: `Flight ${index + 1}`, startDate, endDate, budget: value })) });
const setup = () => {
  const campaigns = [shell("McMaster-Carr", "McMaster B2B Test 2026"), shell("Rent A Center", "RAC_National_Hyperlocal_Q2_2026"), shell("Rent A Center", "RAC_National_OLA_Q4_2026"), shell("Carter BloodCare", "Carter BloodCare 2H 2026")];
  const groups = groupCampaigns(campaigns);
  let totals = setCampaignTotals({}, groups[0].key, order(331200, "2026-07-06", "2026-10-30"), "a.pdf");
  totals = setCampaignTotals(totals, groups[1].key, order(134580.86, "2026-04-26", "2026-10-24", [21165.86, 20782.86]), "b.pdf");
  totals = setCampaignTotals(totals, groups[2].key, order(51002.21, "2026-09-27", "2026-12-26", [13285.3]), "c.pdf");
  totals = setCampaignTotals(totals, groups[3].key, order(29938, "2026-07-27", "2026-12-20"), "d.pdf");
  return { groups, totals };
};
const row = (client, campaign, line, extra = {}) => ({ client, name: `${campaign} — ${line}`, ...extra });

test("suggests the one IO campaign a client has, even with no shared words", () => {
  const { groups, totals } = setup();
  const rows = [row("McMaster-Carr Supply Company", "Slingshot Agency-McMaster-Carr Display Q3", "Chicago", { deliveryStart: "2026-07-06", deliveryEnd: "2026-10-12" })];
  assert.equal(suggestCampaigns(rows, groups, totals)[assignmentKey(rows[0])], groups[0].key);
});

test("uses shared words and checks that delivery dates and budgets fit the IO", () => {
  const { groups, totals } = setup();
  const hyperlocal = row("Rent A Center", "Hyperlocal", "Flight 2", { budget: 20782.86 });
  const olaQ2 = row("Rent A Center", "OLA", "Flight 1", { budget: 50903.88 });
  const suggestions = suggestCampaigns([hyperlocal, olaQ2], groups, totals);
  assert.equal(suggestions[assignmentKey(hyperlocal)], groups[1].key);
  assert.equal(suggestions[assignmentKey(olaQ2)], undefined);
});

test("leaves a report that delivered before the IO flight unassigned", () => {
  const { groups, totals } = setup();
  const firstHalf = row("Carter BloodCare", "Carter BloodCare 1H 2026 Audio", "Streaming Audio", { deliveryStart: "2026-04-01", deliveryEnd: "2026-06-30" });
  const secondHalf = row("Carter BloodCare", "Carter BloodCare Q3-Q4 2026 Streaming Audio", "AA Audio", { deliveryStart: "2026-08-20", deliveryEnd: "2026-09-30" });
  const suggestions = suggestCampaigns([firstHalf, secondHalf], groups, totals);
  assert.equal(suggestions[assignmentKey(firstHalf)], undefined);
  assert.equal(suggestions[assignmentKey(secondHalf)], groups[3].key);
});

test("does not suggest anything for a report that already matches a campaign by name", () => {
  const { groups, totals } = setup();
  const rows = [row("Rent A Center", "RAC_National_Hyperlocal_Q2_2026", "Flight 1")];
  assert.deepEqual(suggestCampaigns(rows, groups, totals), {});
});
