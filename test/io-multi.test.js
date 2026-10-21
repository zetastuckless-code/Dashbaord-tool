import test from "node:test";
import assert from "node:assert/strict";
import { parseInsertionOrder } from "../lib/io-parser.js";
import { itemsToLines } from "../lib/pdf-text.js";
import { findCampaignForIo } from "../lib/io-match.js";
import { groupCampaigns } from "../lib/campaign-groups.js";

// Synthetic agency order whose rows start with icon-font glyphs (private-use characters) and a client/product header line.
const glyph = "";
const order = (campaign, product, ...rows) => [[
  "FROM", "Example Trading", "Contact A Person Order # O-ZZZ111-R1 ACCEPTED", `Campaign ${campaign}`, "Flight 09/27/2026 - 12/26/2026", "Order total $30,000.00 Placement changes"
], [
  "Order # O-ZZZ111-R1 Accepted",
  `MCPE 7 / ACM / ${product.toUpperCase()} / 1234 - DIGITAL / ACME RENTALS / ${product.toUpperCase()} / ${campaign}`,
  ...rows.flatMap(([id, start, end, cost, name], index) => [`${glyph} NEW ${glyph} ${id} —— —— —— No —— No ${start} - ${end} CPM Impressions $3.2500 1,000,000 ${cost}`, `${index + 1} ${name}`, "PLACEMENT DESCRIPTION: Cross Screen"])
]];
const olaOrder = order("ACM_National_OLA_Q4_2026", "OLA", ["PAAA111", "09/27/2026", "10/24/2026", "$10,000.00", "Cross Screen Standard Display Package_2026-09-27_2026-10-24"], ["PAAA222", "10/25/2026", "11/28/2026", "$20,000.00", "PAAA222_Cross Screen Standard Display Package"]);

test("reads rows that start with icon-font glyphs and strips them from extracted lines", () => {
  assert.deepEqual(itemsToLines([{ str: `${glyph} NEW`, width: 20, transform: [1, 0, 0, 1, 0, 100] }, { str: "P3KRDXM", width: 40, transform: [1, 0, 0, 1, 40, 100] }]), ["NEW P3KRDXM"]);
  const io = parseInsertionOrder(olaOrder);
  assert.equal(io.valid, true);
  assert.equal(io.lineItems.length, 2);
  assert.deepEqual(io.lineItems.map(item => [item.id, item.name, item.budget]), [["PAAA111", "Standard Display Package", 10000], ["PAAA222", "Standard Display Package", 20000]]);
});

test("takes the client and product from the order header line, title-casing an all-caps client", () => {
  const io = parseInsertionOrder(olaOrder);
  assert.deepEqual([io.advertiser, io.product, io.campaign], ["Acme Rentals", "Ola", "ACM_National_OLA_Q4_2026"]);
});

test("maps each of several orders to the right campaign by the short name inside the order's campaign name", () => {
  const groups = groupCampaigns([
    { client: "Acme Rentals", name: "Drive To Store — Flight 1", spend: 1 },
    { client: "Acme Rentals", name: "Hyperlocal — Flight 1", spend: 1 },
    { client: "Acme Rentals", name: "OLA — Flight 1", spend: 1 }
  ]);
  const ola = findCampaignForIo(groups, {}, parseInsertionOrder(olaOrder));
  assert.deepEqual([ola.reason, groups.find(group => group.key === ola.key).name], ["name", "OLA"]);
  const hyper = findCampaignForIo(groups, {}, { orderNumber: "O-X", campaign: "ACM_National_Hyperlocal_Q2_2026" });
  assert.equal(groups.find(group => group.key === hyper.key).name, "Hyperlocal");
  assert.equal(findCampaignForIo(groups, {}, { orderNumber: "O-Y", campaign: "ACM_National_Unrelated_2026" }), null);
});

test("prefers the longest matching group name and gives up on a tie", () => {
  const groups = groupCampaigns([{ client: "A", name: "Display — F1", spend: 1 }, { client: "A", name: "Display Awareness — F1", spend: 1 }]);
  const specific = findCampaignForIo(groups, {}, { orderNumber: "O-1", campaign: "A_Display_Awareness_Q4" });
  assert.equal(groups.find(group => group.key === specific.key).name, "Display Awareness");
  const tie = groupCampaigns([{ client: "A", name: "OLA — F1", spend: 1 }, { client: "B", name: "OLA — F1", spend: 1 }]);
  assert.equal(findCampaignForIo(tie, {}, { orderNumber: "O-2", campaign: "National_OLA_Q4" }), null);
});
