import test from "node:test";
import assert from "node:assert/strict";
import { parseInsertionOrder } from "../lib/io-parser.js";
import { applyIoToCampaign, campaignFieldsFromIo } from "../lib/io-apply.js";
import { itemsToLines } from "../lib/pdf-text.js";

// Synthetic layouts that mirror the two supported IO formats (made-up names and amounts).
const zetaRio = [[
  "ADVERTISING INSERTION ORDER",
  "Agency: Example Agency",
  "Advertiser: Acme Health",
  "Campaign: Acme Fall Launch (East and West)",
  "Duration: 6/15/26 - 10/23/2026",
  "Insertion Order Effective Dates: 6/15/26 - 12/31/26",
  "Budget: $60,000.00",
  "Flight Dates Placement Name Audience Targeting Description Geo-Targeting Placement Type Placement Size Pricing Model Unit Type Unit Rate Impressions Overall Budget KPI",
  "Desktop I Mobile I Tablet 728x90, 300x250, 160x600, 300x600,",
  "6/15/26 - 10/23/2026 Cross-Screen Standard Display EAST CPM Impressions $4.00 5,000,000 $20,000.00 CTR",
  "Standard Display 320x50",
  "Primary: Decision Makers: Company size 50+ Desktop I Mobile I Tablet 728x90, 300x250,",
  "6/15/26 -12/31/26 Cross-Screen Standard Display WEST CPM Impressions $4.00 2,500,000 $10,000.00 CTR",
  "Standard Display 320x50",
  "Desktop I Mobile I Tablet",
  "6/15/26 - 9/06/26 Cross Screen Online Video EAST 15s or 30s CPM Impressions $14.00 2,142,857 $30,000.00 VCR",
  "Online Video"
]];

const agencyOrder = [[
  "FROM", "Example Agency LLC", "Contact A Person Order # O-ABC123X-R4 ACCEPTED",
  "TO ZETA GLOBAL Campaign Acme Brand 2026", "Flight 01/01/2026 - 12/31/2026", "Order total $75,000.00 Placement changes"
], [
  "Order # O-ABC123X-R4 Accepted",
  "REVISED PAAA111 Leaderboard 728 x 90 -- No 3rd party No 01/01/2026 - 12/31/2026 CPM Impressions $5.0000 10,000,000 $50,000.00",
  "1 Programmatic_Display_Banner_Example",
  "NEW PBBB222 Leaderboard 728 x 90 -- No 3rd party No 05/04/2026 - 12/31/2026 dCPV $0.1000 250,000 $25,000.00",
  "Video",
  "2 Programmatic_Video_Views_Example",
  "CANCELLED PCCC333 Leaderboard 728 x 90 -- No 3rd party No 01/01/2026 - 12/31/2026 CPM Impressions $5.0000 1,000,000 $5,000.00",
  "3 Programmatic_Cancelled_Example"
]];

const clone = value => JSON.parse(JSON.stringify(value));

test("parses a Zeta advertising IO: header facts, cleaned names, rates, and KPIs", () => {
  const io = parseInsertionOrder(zetaRio);
  assert.equal(io.valid, true);
  assert.equal(io.format, "zeta-rio");
  assert.deepEqual([io.agency, io.advertiser, io.campaign], ["Example Agency", "Acme Health", "Acme Fall Launch (East and West)"]);
  assert.deepEqual([io.startDate, io.endDate, io.budget], ["2026-06-15", "2026-10-23", 60000]);
  assert.deepEqual(io.lineItems.map(item => item.name), ["Standard Display EAST", "Standard Display WEST", "Online Video EAST"]);
  assert.deepEqual(io.lineItems.map(item => item.kpi), ["CTR", "CTR", "VCR"]);
  assert.equal(io.lineItems[0].rate, 4);
  assert.equal(io.lineItems[0].units, 5_000_000);
  assert.equal(io.lineItems[1].startDate, "2026-06-15");
  assert.equal(io.lineItems[2].endDate, "2026-09-06");
  assert.deepEqual(io.warnings, []);
});

test("cleans older Zeta IO rows that run audience and device text into the placement name", () => {
  const rows = [["ADVERTISING INSERTION ORDER", "Agency: A", "Advertiser: B", "Campaign: C", "Budget: $8,352.00",
    "6/15/26 - 10/23/2026 Cross-Screen Standard Display Primary: Large Group Decision Makers:Company size 50+ AND Behavioral: DE Desktop I Mobile I TabletStandard Display 728x90, 300x250 CPM Impressions $4.00 2,088,000 $8,352.00 CTR"]];
  assert.equal(parseInsertionOrder(rows).lineItems[0].name, "Standard Display DE · Primary");
});

test("parses an agency order with placement IDs, revision, and skips cancelled placements", () => {
  const io = parseInsertionOrder(agencyOrder);
  assert.equal(io.valid, true);
  assert.equal(io.format, "agency-order");
  assert.deepEqual([io.agency, io.campaign, io.advertiser, io.orderNumber, io.revision], ["Example Agency LLC", "Acme Brand 2026", "Acme Brand", "O-ABC123X", "R4"]);
  assert.equal(io.budget, 75000);
  assert.deepEqual(io.lineItems.map(item => [item.id, item.name, item.rateType, item.budget]), [
    ["PAAA111", "Programmatic_Display_Banner_Example", "CPM", 50000],
    ["PBBB222", "Programmatic_Video_Views_Example", "dCPV", 25000]
  ]);
  assert.match(io.warnings.join(" "), /1 cancelled placement was left out/);
});

test("warns when line budgets do not add up to the stated order total", () => {
  const pages = clone(zetaRio);
  pages[0][6] = "Budget: $99,000.00";
  const io = parseInsertionOrder(pages);
  assert.equal(io.valid, true);
  assert.match(io.warnings[0], /total \$60,000\.00 but the order states \$99,000\.00/);
});

test("rejects unrecognized PDFs and orders with no placement rows", () => {
  const unknown = parseInsertionOrder([["Just a menu", "Soup $5.00"]]);
  assert.equal(unknown.valid, false);
  assert.match(unknown.errors[0], /not a recognized insertion order/);
  const empty = parseInsertionOrder([["ADVERTISING INSERTION ORDER", "Agency: A", "Advertiser: B", "Campaign: C"]]);
  assert.equal(empty.valid, false);
  assert.match(empty.errors[0], /No placement rows/);
});

test("makes unique line IDs when placement names repeat", () => {
  const rows = [["ADVERTISING INSERTION ORDER", "Agency: A", "Advertiser: B", "Campaign: C", "Budget: $200.00",
    "6/1/26 - 6/30/26 Standard Display CPM Impressions $4.00 25,000 $100.00 CTR", "6/1/26 - 6/30/26 Standard Display CPM Impressions $4.00 25,000 $100.00 CTR"]];
  assert.deepEqual(parseInsertionOrder(rows).lineItems.map(item => item.id), ["io-standard-display", "io-standard-display-2"]);
});

test("applies an IO to a new campaign as flights, a budget revision, and the IO reference", () => {
  const io = parseInsertionOrder(zetaRio);
  const now = new Date("2026-10-06T12:00:00Z");
  const result = applyIoToCampaign({ client: "Acme Health", name: "Acme Fall Launch", budget: null }, io, { fileName: "acme-io.pdf", now });
  assert.equal(result.applied, 3);
  assert.equal(result.revised, true);
  assert.equal(result.campaign.budget, 60000);
  assert.equal(result.campaign.budgetSource, "io");
  assert.equal(result.campaign.budgetRevisions.length, 1);
  assert.equal(result.campaign.ioFileName, "acme-io.pdf");
  assert.equal(result.campaign.startDate, "2026-06-15");
  assert.equal(result.campaign.lineItemFlights[0].rateType, "CPM");
  assert.equal(result.campaign.lineItemFlights[2].kpi, "VCR");
});

test("re-applying a revised IO updates flights by ID and only revises the budget when it changed", () => {
  const first = applyIoToCampaign({ client: "A", name: "B", budget: null }, parseInsertionOrder(agencyOrder), { fileName: "r4.pdf" }).campaign;
  const again = applyIoToCampaign(first, parseInsertionOrder(agencyOrder), { fileName: "r4.pdf" });
  assert.equal(again.campaign.lineItemFlights.length, 2);
  assert.equal(again.revised, false);
  assert.equal(again.campaign.budgetRevisions.length, 1);
  const revisedPages = clone(agencyOrder);
  revisedPages[0][5] = "Order total $70,000.00 Placement changes";
  revisedPages[1][1] = "REVISED PAAA111 Leaderboard 728 x 90 -- No 3rd party No 01/01/2026 - 12/31/2026 CPM Impressions $5.0000 8,000,000 $45,000.00";
  const revised = applyIoToCampaign(again.campaign, parseInsertionOrder(revisedPages), { fileName: "r5.pdf" });
  assert.equal(revised.campaign.budget, 70000);
  assert.equal(revised.campaign.budgetRevisions.length, 2);
  assert.equal(revised.campaign.lineItemFlights.find(flight => flight.id === "PAAA111").budget, 45000);
});

test("can apply selected placements only and leave the campaign budget alone", () => {
  const io = parseInsertionOrder(zetaRio);
  const result = applyIoToCampaign({ client: "A", name: "B", budget: 1234, budgetSource: "manual" }, io, { selectedIds: ["io-online-video-east"], setBudget: false });
  assert.equal(result.applied, 1);
  assert.equal(result.campaign.budget, 1234);
  assert.equal(result.campaign.budgetSource, "manual");
  assert.equal(result.campaign.lineItemFlights.length, 1);
});

test("prefills a new campaign from the order", () => {
  assert.deepEqual(campaignFieldsFromIo(parseInsertionOrder(agencyOrder), "o.pdf"), { client: "Acme Brand", name: "Acme Brand 2026", startDate: "2026-01-01", endDate: "2026-12-31", budget: 75000, budgetSource: "io", ioFileName: "o.pdf", ioOrder: "O-ABC123X-R4" });
});

test("rebuilds visual lines from pdf.js text items by baseline and column order", () => {
  const item = (str, x, y, width = str.length * 5) => ({ str, width, transform: [1, 0, 0, 1, x, y] });
  const lines = itemsToLines([item("$4.00", 200, 700), item("CPM", 100, 700.5), item("Budget:", 10, 720), item("$1.00", 70, 720), item("", 0, 0)]);
  assert.deepEqual(lines, ["Budget: $1.00", "CPM $4.00"]);
});
