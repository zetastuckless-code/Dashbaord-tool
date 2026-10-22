import test from "node:test";
import assert from "node:assert/strict";
import { applyIoPlan, ioLines, matchRecordsToIoLines } from "../lib/io-plan.js";
import { setCampaignTotals } from "../lib/campaign-totals.js";

const placement = (id, name, startDate, endDate, budget) => ({ id, name, startDate, endDate, budget });
const entryFor = (lineItems, extra = {}) => setCampaignTotals({}, "acme::spring", { orderNumber: "4240", budget: lineItems.reduce((sum, item) => sum + item.budget, 0), startDate: lineItems.map(item => item.startDate).sort()[0], endDate: lineItems.map(item => item.endDate).sort().at(-1), lineItems, ...extra }, "io.pdf")["acme::spring"];
const record = (line, extra = {}) => ({ client: "Acme", name: `Spring — ${line}`, spend: 100, ...extra });

test("lines with the same name are one line: budgets add up and dates span both flights", () => {
  const lines = ioLines(entryFor([
    placement("001", "Chicago DMA Standard Display", "2026-07-06", "2026-09-30", 27600),
    placement("002", "Phoenix DMA Standard Display", "2026-07-06", "2026-09-30", 27600),
    placement("030", "Chicago DMA Standard Display", "2026-10-05", "2026-10-30", 15800)
  ]));
  assert.deepEqual(lines.map(line => [line.name, line.budget, line.startDate, line.endDate, line.placements.length]), [
    ["Chicago DMA Standard Display", 43400, "2026-07-06", "2026-10-30", 2], ["Phoenix DMA Standard Display", 27600, "2026-07-06", "2026-09-30", 1]
  ]);
});

test("matches report lines by the IO line's distinctive words, including aliases", () => {
  const entry = entryFor([placement("001", "New York DMA Standard Display", "2026-07-06", "2026-10-30", 41600), placement("002", "Raleigh-Durham DMA Standard Display", "2026-07-06", "2026-10-30", 34100)]);
  const ny = record("NY", { aliases: ["New York"] });
  const raleigh = record("Raleigh");
  const matches = matchRecordsToIoLines([ny, raleigh], entry);
  assert.equal(matches.get(ny).line.name, "New York DMA Standard Display");
  assert.equal(matches.get(raleigh).line.name, "Raleigh-Durham DMA Standard Display");
});

test("matches Flight N to the N-th placement by date, and placement IDs in the line name", () => {
  const entry = entryFor([placement("P3F0ZJN", "Test Package", "2026-04-26", "2026-05-30", 21000), placement("P3F0ZTL", "Standard Display Package", "2026-05-31", "2026-06-27", 30000), placement("P3F0ZVW", "Standard Display Package", "2026-06-28", "2026-07-25", 20000)]);
  const first = record("Flight 1");
  const third = record("Flight 3");
  const byId = record("P3F0ZTL_Cross Screen");
  const matches = matchRecordsToIoLines([first, third, byId], entry);
  assert.equal(matches.get(first).line.name, "Test Package");
  assert.equal(matches.get(third).line.name, "Standard Display Package");
  assert.equal(matches.get(byId).line.name, "Standard Display Package");
});

test("matches by budget, then pairs the last line left when its dates fit", () => {
  const entry = entryFor([placement("a", "AA Package", "2026-07-27", "2026-12-20", 15938), placement("b", "USH Package", "2026-08-31", "2026-10-25", 14000)]);
  const byBudget = record("General Audio", { budget: 15938 });
  const leftover = record("Hispanic Audio", { deliveryStart: "2026-08-31", deliveryEnd: "2026-09-29" });
  const matches = matchRecordsToIoLines([byBudget, leftover], entry);
  assert.equal(matches.get(byBudget).line.name, "AA Package");
  assert.equal(matches.get(leftover).line.name, "USH Package");
});

test("flags lines delivered outside the IO flight and lines the IO does not plan", () => {
  const entry = entryFor([placement("a", "AA Package", "2026-07-27", "2026-12-20", 15938), placement("b", "USH Package", "2026-08-31", "2026-10-25", 14000)]);
  const old = record("Old Audio", { deliveryStart: "2026-04-01", deliveryEnd: "2026-06-30" });
  const extraA = record("Mystery One");
  const extraB = record("Mystery Two");
  const matches = matchRecordsToIoLines([old, extraA, extraB], entry);
  assert.equal(matches.get(old).status, "outside");
  assert.deepEqual([matches.get(extraA).status, matches.get(extraB).status], ["unplanned", "unplanned"]);
});

test("applyIoPlan gives each line its IO line's dates, or the IO flight, so status follows the IO", () => {
  const totals = { "acme::spring": entryFor([placement("001", "Chicago DMA Standard Display", "2026-07-06", "2026-09-30", 27600), placement("030", "Chicago DMA Standard Display", "2026-10-05", "2026-10-30", 15800), placement("002", "Phoenix DMA Standard Display", "2026-07-06", "2026-09-30", 27600)]) };
  const chicago = record("Chicago", { startDate: "2026-07-06", endDate: "2026-09-30" });
  const unknown = record("Somewhere", { startDate: "2026-07-06", endDate: "2026-09-30" });
  const other = { client: "Zed", name: "Brand — Display", startDate: "2026-01-01", endDate: "2026-02-01" };
  const [nextChicago, nextUnknown, nextOther] = applyIoPlan([chicago, unknown, other], totals);
  assert.deepEqual([nextChicago.startDate, nextChicago.endDate, nextChicago.ioLineName, nextChicago.ioLineStatus], ["2026-07-06", "2026-10-30", "Chicago DMA Standard Display", "matched"]);
  assert.deepEqual([nextUnknown.startDate, nextUnknown.endDate, nextUnknown.ioLineStatus], ["2026-07-06", "2026-10-30", "unplanned"]);
  assert.equal(nextOther, other);
  const again = applyIoPlan([nextChicago, nextUnknown, nextOther], totals);
  assert.equal(again[0], nextChicago);
});

test("matches report lines named by channel to IO lines that spell out the channel", () => {
  const entry = entryFor([
    placement("a", "Programmatic_Display_Banner_ZETA GLOBAL_Display_D", "2026-01-01", "2026-12-31", 927233.88),
    placement("b", "Programmatic_Video_General_ZETA GLOBAL_YouTube_D", "2026-01-01", "2026-12-31", 415825.78),
    placement("c", "Programmatic_Video_Trueview Instream Skip_ZETA GLOBAL_YouTube_Video_Views_Campaign_D", "2026-05-04", "2026-12-31", 78140.08)
  ]);
  const display = { client: "Acme", name: "Spring", channel: "Display", spend: 100 };
  const youtube = record("YouTube");
  const views = record("YouTube (Video Views)");
  const matches = matchRecordsToIoLines([display, youtube, views], entry);
  assert.equal(matches.get(display).line.name, "Programmatic_Display_Banner_ZETA GLOBAL_Display_D");
  assert.equal(matches.get(youtube).line.name, "Programmatic_Video_General_ZETA GLOBAL_YouTube_D");
  assert.equal(matches.get(views).line.name, "Programmatic_Video_Trueview Instream Skip_ZETA GLOBAL_YouTube_Video_Views_Campaign_D");
});
