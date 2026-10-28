import test from "node:test";
import assert from "node:assert/strict";
import { parseInsertionOrder } from "../lib/io-parser.js";
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

test("rebuilds visual lines from pdf.js text items by baseline and column order", () => {
  const item = (str, x, y, width = str.length * 5) => ({ str, width, transform: [1, 0, 0, 1, x, y] });
  const lines = itemsToLines([item("$4.00", 200, 700), item("CPM", 100, 700.5), item("Budget:", 10, 720), item("$1.00", 70, 720), item("", 0, 0)]);
  assert.deepEqual(lines, ["Budget: $1.00", "CPM $4.00"]);
});

// Synthetic Slingshot-style internet order: numbered lines, placement name on following lines, repeating page headers.
const pageHeader = ["Slingshot, LLC - 1 Example St", "INTERNET ORDER", "Publication : Zeta Global Corp Order No. : 004999 Date : 10/1/2026", "Client : Acme Tools Page : 2 of 3 Ven/Rep : z1", "Division : Acme Tools Buyer : A Buyer", "Product : Acme Tools Description : Acme-", "ToolsTest2026 - Zeta", "Campaign :", "Start End Net", "Line Date Date Creative Size Type Amount"];
const internetOrder = [[
  "Slingshot, LLC - 1 Example St", "INTERNET ORDER", "Zeta Global Corp",
  "Publication : Zeta Global Corp Order No. : 004999 Date : 10/1/2026", "Client : Acme Tools Page : 1 of 3 Ven/Rep : z1", "Division : Acme Tools Buyer : A Buyer",
  "Product : Acme Tools Description : Acme-", "ToolsTest2026 - Zeta", "Campaign :", "Start End Net", "Line Date Date Creative Size Type Amount",
  "001 7/6/2026 9/30/2026 728x90, 300x250, 1,000,000 Impressions @ 5,000.00", "160x600, 300x600, 5.0000 CPM", "Projected : 1,000,000 Impressions",
  "Placement : Cross-Device_Chicago DMA_Standard Display", "Instructions : Site Served",
  "002 7/6/2026 9/30/2026 728x90, 300x250, 2,000,000 Impressions @ 10,000.00", "160x600, 300x600, 5.0000 CPM", "Projected : 2,000,000 Impressions"
], [
  ...pageHeader,
  "Placement : Cross-DeviceAustin DMA_Standard Display", "Instructions : Site Served",
  "003 7/6/2026 9/30/2026 .00", "Placement : Added Value_Ad Serving Fee Coverage",
  "004 9/8/2026 9/30/2026 728x90, 300x250, .00", "Projected : 18,670", "Placement : Cross-Device_Chicago DMA_Prospecting_Standard Display_Added", "Value", "Instructions : Site Served", "Estimated Impressions: 18,670"
], [
  ...pageHeader,
  "Sub-Total : 15,000.00", "Order Total $15,000.00", "Agency Authorization: Date: 10/01/26"
]];

test("parses a Slingshot internet order across page breaks, with rates, added-value lines, and the revision from the file name", () => {
  const io = parseInsertionOrder(internetOrder, { fileName: "Acme IO #4999 Rev2 - signed.pdf" });
  assert.equal(io.valid, true);
  assert.equal(io.format, "internet-order");
  assert.deepEqual([io.agency, io.advertiser, io.campaign, io.orderNumber, io.revision], ["Slingshot, LLC", "Acme Tools", "Acme-ToolsTest2026 - Zeta", "4999", "Rev2"]);
  assert.deepEqual([io.startDate, io.endDate, io.budget, io.lineTotal], ["2026-07-06", "2026-09-30", 15000, 15000]);
  assert.deepEqual(io.lineItems.map(item => [item.id, item.name, item.budget]), [
    ["001", "Chicago DMA Standard Display", 5000],
    ["002", "Austin DMA Standard Display", 10000],
    ["003", "Added Value Ad Serving Fee Coverage", 0],
    ["004", "Chicago DMA Prospecting Standard Display Added Value", 0]
  ]);
  assert.deepEqual([io.lineItems[0].rateType, io.lineItems[0].rate, io.lineItems[0].units, io.lineItems[0].unit], ["CPM", 5, 1_000_000, "Impressions"]);
  assert.equal(io.lineItems[3].units, 18670);
  assert.deepEqual(io.lineItems.map(item => Boolean(item.addedValue)), [false, false, true, true]);
  assert.match(io.warnings.join(" "), /2 added-value placements have no budget/);
});

test("reads a Zeta IO laid out as packages with written-out flight dates", () => {
  const io = parseInsertionOrder([[
    "ADVERTISING INSERTION ORDER", "Agency: Dieste Dallas", "Advertiser: Carter BloodCare", "Campaign: Carter BloodCare 2H 2026",
    "Insertion Order Effective Dates: July 27, 2026 - December 20, 2026", "Budget: $29,938.00",
    "July 27, 2026 - December 20, 2026 AA Package Programmatic Tactics Reaching Carter Bloodcare's Target Audience - - - - - - - - -",
    "- Cross-Screen Streaming Audio Zeta Demographic Targeting Desktop I Mobile I TabletStreaming Audio 1x1, 30s Max CPM Impressions $22.00 724,455 $15,938.00 ACR",
    "August 31, 2026 - October 25, 2026 USH Package Programmatic Tactics Reaching Carter Bloodcare's Target Audience - - - - - - - - -",
    "- Cross-Screen Streaming Audio Preference, Spanish Bilingual, A18+ Streaming Audio 1x1, 30s Max CPM Impressions $22.00 636,364 $14,000.00 ACR",
    "July 27, 2026 - December 20, 2026 Added Value Zeta Post-Campaign Insights & Analytics Reports - - - - - - - - -",
    "Totals $22.00 1,360,818 $29,938.00"
  ]]);
  assert.equal(io.valid, true);
  assert.deepEqual([io.startDate, io.endDate, io.budget], ["2026-07-27", "2026-12-20", 29938]);
  assert.deepEqual(io.lineItems.filter(item => !item.addedValue).map(item => [item.name, item.startDate, item.endDate, item.budget]), [
    ["AA Package", "2026-07-27", "2026-12-20", 15938], ["USH Package", "2026-08-31", "2026-10-25", 14000]
  ]);
  assert.equal(io.lineItems.filter(item => item.addedValue).length, 1);
});

test("reads a Zeta IO whose placement row carries its own written-out flight dates and pricing", () => {
  const io = parseInsertionOrder([[
    "ADVERTISING INSERTION ORDER", "Agency: Example Agency", "Advertiser: Acme Health", "Campaign: Acme Health International 2026",
    "Insertion Order Effective Dates: February 4, 2026 - December 31, 2026", "Budget: $100,000.00",
    "February 4, 2026 - December 31, 2026 Package Programmatic Tactics Reaching Your Target Audience - - - - - - - - -",
    "February 4, 2026 - December 31, 2026 Cross-Screen Standard Display CPM Impressions $5.00 20,000,000 $100,000.00 Awareness/CTR",
    "Bonus Display IMPs 600,000",
    "February 4, 2026 - December 31, 2026 Added Value Ad Serving Fees + - - - - - - - -",
    "Totals $4.85 20,600,000 $100,000.00"
  ]]);
  assert.equal(io.valid, true);
  const paid = io.lineItems.filter(item => !item.addedValue);
  assert.deepEqual(paid.map(item => [item.name, item.startDate, item.endDate, item.budget, item.units, item.rate, item.kpi]), [
    ["Standard Display", "2026-02-04", "2026-12-31", 100000, 20000000, 5, "CTR"]
  ]);
  assert.equal(io.warnings.some(warning => /total \$0/.test(warning)), false);
});

test("names lines of flight packages by flight and tactic, and renumbers a repeated flight label", () => {
  const io = parseInsertionOrder([[
    "ADVERTISING INSERTION ORDER", "Agency: Example Agency", "Advertiser: Acme Foods", "Campaign: Acme Omnichannel 2026",
    "Insertion Order Effective Dates: March 4, 2026 - December 31, 2026", "Budget: $200,000.00",
    "March 4, 2026 - April 15, 2026 F1 Package Programmatic Tactics Reaching Your Target Audience - - - - - - - - -",
    "- Cross-Screen Standard Display •Zeta Demographic Targeting:A18+ CPM Impressions $4.50 5,000,000 $22,500.00 Awareness",
    "- Cross-Screen Standard Display •Look-a-like Modeling & Retargeting dCPM Impressions $1.75 - $11.00 3,000,000 $30,000.00 Clicks $0.55 CPC",
    "May 25, 2026 - September 7, 2026 F2 Package Programmatic Tactics Reaching Your Target Audience - - - - - - - - -",
    "- Cross-Screen Standard Display CPM Impressions $4.50 10,000,000 $45,000.00 Awareness",
    "- Cross-Screen Pre-Roll Video VAST or VPAID, 30s Max CPM Impressions $14.00 5,000,000 $70,000.00 VCR",
    "November 15, 2026 - December 31, 2026 F2 Package Programmatic Tactics Reaching Your Target Audience - - - - - - - - -",
    "- Cross-Screen Pre-Roll Video VAST or VPAID, 30s Max CPM Impressions $14.00 2,321,429 $32,500.00 VCR",
    "Totals $7.47 25,321,429 $200,000.00"
  ]]);
  assert.equal(io.valid, true);
  assert.deepEqual(io.lineItems.map(item => [item.name, item.startDate, item.budget, item.kpi]), [
    ["F1 Standard Display Awareness", "2026-03-04", 22500, null],
    ["F1 Standard Display Clicks", "2026-03-04", 30000, "CPC"],
    ["F2 Standard Display", "2026-05-25", 45000, null],
    ["F2 Pre-Roll Video", "2026-05-25", 70000, "VCR"],
    ["F3 Pre-Roll Video", "2026-11-15", 32500, "VCR"]
  ]);
  assert.equal(new Set(io.lineItems.map(item => item.id)).size, io.lineItems.length);
});

test("reads a no-cost Zeta IO with dashes for rate and budget and a misspelled month", () => {
  const io = parseInsertionOrder([[
    "ADVERTISING INSERTION ORDER", "Agency: Agency A", "Advertiser: Advertiser A", "Campaign: Advertiser A No-Cost IMPs",
    "Insertion Order Effective Dates: Novmeber 16, 2026 - December 27, 2026", "Budget: $0.00",
    "Novmeber 16, 2026 - December 27, 2026 Package Programmatic Tactics Reaching Your Target Audience - - - - - - - - -",
    "Novmeber 16, 2026 - December 27, 2026 Cross-Screen Standard Display Zeta Propensity Audience:Charities and Causes, County Targeting (See Geo Tab) Desktop I Mobile I TabletStandard Display 728x90, 300x250 CPM Impressions - 2,000,000 - CTR",
    "Totals $0.00 2,000,000 $0.00"
  ]]);
  assert.equal(io.valid, true);
  assert.deepEqual([io.startDate, io.endDate, io.budget], ["2026-11-16", "2026-12-27", 0]);
  assert.deepEqual(io.lineItems.map(item => [item.name, item.rateType, item.rate, item.units, item.budget, item.kpi]), [["Standard Display", "CPM", 0, 2000000, 0, "CTR"]]);
});
