import test from "node:test";
import assert from "node:assert/strict";
import { billingFileMonth, billingMonth, billingSheets, billingWindow, computeClientBilling, importedHistory, parseBillingSheet, previousMonth } from "../lib/billing.js";

const days = (from, to, metrics) => {
  const result = {};
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += 86_400_000) result[new Date(time).toISOString().slice(0, 10)] = { ...metrics };
  return result;
};
const line = (name, delivery, extra = {}) => ({ client: "Carter", name, startDate: "2026-07-01", endDate: "2026-12-31", thirdPartyDelivery: delivery, ...extra });

test("a calendar month bills each row from its lines' DSP days at the CPM, with discount and gaps reported", () => {
  const records = [line("Carter — AA Audio", { DSP: days("2026-09-01", "2026-09-30", { impressions: 1000, spend: 22 }) }), line("Carter — Hispanic Audio", { DSP: days("2026-09-01", "2026-09-29", { impressions: 2000, spend: 44 }) })];
  const config = { rows: [{ id: "a", lineName: "Streaming Audio", source: "DSP", rateType: "cpm", rate: 22, discount: 10, lines: ["Carter — AA Audio", "Carter — Hispanic Audio"] }] };
  const result = computeClientBilling(config, records, "2026-09");
  assert.equal(result.rows[0].quantity, 30 * 1000 + 29 * 2000);
  assert.equal(result.rows[0].gross, 1936);
  assert.equal(result.rows[0].net, 1742.4);
  assert.deepEqual(result.missingDays, ["2026-09-30"]);
  assert.equal(result.ready, false);
  // Spend passed through bills the DSP spend itself.
  const spend = computeClientBilling({ rows: [{ ...config.rows[0], rateType: "spend", discount: 0 }] }, records, "2026-09");
  assert.equal(spend.rows[0].revenue, 30 * 22 + 29 * 44);
});

test("custom periods run from the day after the last billed day, labelled with their full period", () => {
  const config = { periodMode: "custom", periods: [{ from: "2026-08-02", to: "2026-08-29" }, { from: "2026-08-30", to: "2026-09-26" }, { from: "2026-09-27", to: "2026-10-24" }], history: { "2026-08": { to: "2026-08-29" } } };
  const window = billingWindow(config, "2026-09");
  assert.equal(window.from, "2026-08-30");
  assert.deepEqual(window.periods.map(period => [period.label, period.from, period.to]), [["08/30/2026 - 09/26/2026", "2026-08-30", "2026-09-26"], ["09/27/2026 - 10/24/2026", "2026-09-27", "2026-09-30"]]);
});

test("a past Final Billing tab becomes billing rows", () => {
  const rows = [
    [null],
    ["Customer  / Agency NameName", "Advertiser / Brand Name", "Sales Force ID", "Campaign Name", "Line Item (Internal Display Name)", null, "Quantity", "Rate", "Revenue", "PO #", "Currency", "Note", "Gross Amount", "Net Amount", "Billable Amount ( Gross / Net )"],
    ["Agency Name from IO", "Brand", "Sales force Opp ID", "Campaign name as per IO", "Mode", null, "Impressions count as per the delivery", "Rate mentioned on the IO", "Quantity * rate / 1000"],
    ["Anchor Trading", "Rent-A-Center", "006X", "RAC OLA", "RAC_OLA", "08/30/2026 - 09/26/2026", 5351598, 3.25, 17392.69, null, "USD", "Quarterly discounts", null, null, 17392.69],
    [null, null, null, null, null, "09/27/2026 - 10/24/2026", 332541, 3.25, 1080.76],
    ["Avail Media", "Media Desk", "006Y", "NMISC", "NMISC YouTube", null, 828626, "CPV 0.05", 31005.56, null, null, null, 25003.68, 24000, 24000]
  ];
  const parsed = parseBillingSheet(rows);
  assert.equal(parsed.agency, "Anchor Trading");
  assert.equal(parsed.rows.length, 2);
  assert.deepEqual(parsed.periods, [{ from: "2026-08-30", to: "2026-09-26" }, { from: "2026-09-27", to: "2026-10-24" }]);
  assert.equal(parsed.rows[0].rateType, "cpm");
  assert.equal(parsed.rows[0].note, "Quarterly discounts");
  assert.equal(parsed.rows[1].rateType, "cpv");
  assert.equal(parsed.rows[1].discount, 4.01);
});

test("the workbook has the Final Billing layout with live formulas and totals", () => {
  const result = computeClientBilling({ rows: [{ id: "a", lineName: "Display", source: "CM360", rateType: "cpm", rate: 5, lines: ["X"] }] }, [line("X", { CM360: days("2026-09-01", "2026-09-30", { impressions: 100 }) })], "2026-09");
  const [finalBilling, source] = billingSheets({ agency: "Slingshot", currency: "USD" }, { ...result, rows: result.rows.map(item => ({ ...item, lineDays: [] })) }, "McMaster");
  assert.equal(finalBilling.sheet, "Final Billing");
  assert.equal(finalBilling.data[1][0].value, "Customer  / Agency NameName");
  assert.equal(finalBilling.data[3][6].value, 3000);
  assert.equal(finalBilling.data[3][8].value, "G4*H4/1000");
  assert.equal(finalBilling.data[4][14].value, "SUM(O4:O4)");
  assert.equal(source.sheet, "3P Billing Data Source Data");
  assert.equal(previousMonth(new Date("2026-01-03T12:00:00Z")), "2025-12");
});

test("the raw data tab lists the DCM or DSP rows themselves, with totals, under Zeta blue headers", () => {
  const result = computeClientBilling({ rows: [{ id: "a", lineName: "Display", source: "CM360", rateType: "cpm", rate: 5, lines: ["X"] }] }, [line("X", { CM360: days("2026-09-01", "2026-09-30", { impressions: 100 }) })], "2026-09");
  result.rows[0].rawRows = [{ date: "2026-09-01", campaign: "NSP 2026", campaignId: "347", placement: "Zeta_Display_300x250", creative: "Ad A", impressions: 60, clicks: 1, spend: 0.2, line: "X" }, { date: "2026-09-01", campaign: "NSP 2026", campaignId: "347", placement: "Zeta_Display_300x250", creative: "Ad B", impressions: 40, clicks: 0, spend: 0.1, line: "X" }];
  const [finalBilling, source] = billingSheets({}, result, "NSP");
  assert.equal(finalBilling.data[1][0].backgroundColor, "#003399");
  assert.equal(source.data[0][3].value, "Placement / Line item");
  assert.equal(source.data.length, 4);
  assert.equal(source.data[2][4], "Ad B");
  assert.equal(source.data[3][5].value, "SUM(F2:F3)");
});

test("storage levels and local storage use", async () => {
  const { localStorageUsed, storageLevel } = await import("../lib/line-delivery-store.js");
  const items = { a: "12345", bb: "x" };
  const storage = { get length() { return Object.keys(items).length; }, key: index => Object.keys(items)[index], getItem: key => items[key] };
  assert.equal(localStorageUsed(storage), 1 + 5 + 2 + 1);
  assert.equal(storageLevel(0.5), "ok");
  assert.equal(storageLevel(0.65), "filling");
  assert.equal(storageLevel(0.85), "full");
});

test("billing works on this month, except in the first week when last month is pulled", () => {
  assert.equal(billingMonth(new Date(2026, 9, 26)), "2026-10");
  assert.equal(billingMonth(new Date(2026, 10, 3)), "2026-10");
  assert.equal(billingMonth(new Date(2026, 10, 8)), "2026-11");
  assert.equal(billingMonth(new Date(2027, 0, 2)), "2026-12");
});

test("a running month bills month to date through the newest data, and isn't marked ready", () => {
  const dsp = line("Carter — AA Audio", { DSP: days("2026-10-01", "2026-10-22", { impressions: 1000, spend: 22 }) });
  const config = { rows: [{ source: "DSP", rateType: "cpm", rate: 22, lines: ["Carter — AA Audio"] }] };
  const result = computeClientBilling(config, [dsp], "2026-10", "2026-10-26");
  assert.equal(result.running, true);
  assert.equal(result.ready, false);
  assert.equal(result.through, "2026-10-22");
  assert.deepEqual(result.missingDays, []);
  assert.equal(result.rows[0].quantity, 22_000);
  // From the client's report: the newest total in the month, against the total on the last day of September.
  const snapshots = [{ date: "2026-09-30", impressions: 50_000 }, { date: "2026-10-17", impressions: 70_000 }, { date: "2026-10-22", impressions: 80_000 }];
  const report = line("McMaster — NY", {}, { performanceSnapshots: snapshots });
  const fromReport = computeClientBilling({ rows: [{ source: "report", rateType: "cpm", rate: 5, lines: ["McMaster — NY"] }] }, [report], "2026-10", "2026-10-26");
  assert.equal(fromReport.rows[0].quantity, 30_000);
  assert.equal(fromReport.through, "2026-10-22");
  assert.deepEqual(fromReport.unavailable, []);
});

test("a CPM row with a minus sign on its hand-adjusted quantity still reads as CPM", () => {
  const rows = [
    ["Customer  / Agency NameName", "Advertiser / Brand Name", "Sales Force ID", "Campaign Name", "Line Item (Internal Display Name)", "Quantity", "Rate", "Revenue", "PO #", "Currency", "Note", "Gross Amount", "Net Amount", "Billable Amount ( Gross / Net )"],
    ["TRUth", "Highmark", "006PM00000ZbYkwYAF", "TruMC-Highmark-Highmark - COMM - Legacy & SEPA", "Standard Display", 10_395_311, 4, 41_581.244, "DSTE-PO0026447-2", "USD", null, 41_581.244, 41_581.244, 41_581.244],
    ["TRUth", "Highmark", "006PM00000ZbYkwYAF", "TruMC-Highmark-Highmark - COMM - Legacy & SEPA", "OLV", -4_393_857, 14, 61_514, "DSTE-PO0026447-2", "USD", null, 61_514, 61_514, 61_514]
  ];
  const parsed = parseBillingSheet(rows);
  assert.deepEqual(parsed.rows.map(row => [row.lineName, row.rateType, row.rate]), [["Standard Display", "cpm", 4], ["OLV", "cpm", 14]]);
});

test("billing never goes over the IO: the billable stops at what's left and the quantity drops to match", () => {
  const olv = line("Highmark — Online Video SEPA", { CM360: days("2026-09-01", "2026-09-30", { impressions: 218_019 }) });
  const row = { id: "olv", source: "CM360", rateType: "cpm", rate: 14, lines: ["Highmark — Online Video SEPA"] };
  // $150,000 on the IO, $88,486 billed before: $61,514 left, though September delivered 6,540,570 impressions ($91,568).
  const config = { rows: [{ ...row, ioAmount: "150000", billedBefore: "88486" }], history: {} };
  const result = computeClientBilling(config, [olv], "2026-09");
  const [item] = result.rows;
  assert.equal(item.capped, true);
  assert.equal(item.billable, 61_514);
  assert.equal(item.deliveredQuantity, 6_540_570);
  assert.equal(item.quantity, 4_393_857);
  assert.equal(Math.round(item.deliveredBillable), 91_568);
  // The next month starts from what was downloaded: nothing is left, so nothing more is billed.
  const october = computeClientBilling({ ...config, history: { "2026-09": { rows: { olv: 61_514 } } } }, [line("Highmark — Online Video SEPA", { CM360: days("2026-10-01", "2026-10-31", { impressions: 100_000 }) })], "2026-10");
  assert.equal(october.rows[0].billable, 0);
  // Under the cap, the row bills what delivered, and the IO amount can come from the IO itself.
  const under = computeClientBilling({ rows: [row], history: {} }, [olv], "2026-09", null, { ioAmounts: { olv: 500_000 } });
  assert.equal(under.rows[0].capped, undefined);
  assert.equal(Math.round(under.rows[0].billable), 91_568);
});

test("a monthly budget caps each month on its own", () => {
  const display = line("NSP — Display", { DSP: days("2026-09-01", "2026-09-30", { impressions: 847_385 }) });
  const config = { rows: [{ id: "d", source: "DSP", rateType: "cpm", rate: 3.96, monthlyBudget: "70637.39", lines: ["NSP — Display"] }], history: {} };
  const [item] = computeClientBilling(config, [display], "2026-09").rows;
  assert.equal(item.billable, 70_637.39);
  assert.equal(item.capped, true);
});

test("a DSP row whose lines have no DSP days bills from the uploaded report's raw-tab numbers, month to date", () => {
  const snapshots = [{ date: "2026-09-30", impressions: 3_000_000, spend: 15000 }, { date: "2026-10-17", impressions: 4_000_000, spend: 20000 }, { date: "2026-10-22", impressions: 4_400_000, spend: 22000 }];
  const records = [line("Display", {}, { performanceSnapshots: snapshots }), line("Video", { DSP: days("2026-10-01", "2026-10-20", { impressions: 1000 }) })];
  const config = { periodMode: "month", rows: [{ id: "a", lineName: "Display", source: "DSP", rateType: "cpm", rate: 5, lines: ["Display"] }, { id: "b", lineName: "Video", source: "DSP", rateType: "cpm", rate: 10, lines: ["Video"] }] };
  const result = computeClientBilling(config, records, "2026-10", "2026-10-26");
  assert.equal(result.rows[0].fromReport, true);
  assert.equal(result.rows[0].quantity, 1_400_000);
  assert.equal(result.rows[0].billable, 7000);
  assert.equal(result.rows[1].fromReport, false);
  assert.equal(result.rows[1].quantity, 20_000);
  assert.equal(result.through, "2026-10-22");
});

test("a past billing file keeps what each row billed, for the month in its periods or its file name", () => {
  const rows = [[], ["Customer / Agency Name", "Advertiser", "Sales Force ID", "Campaign Name", "Line Item", "", "Quantity", "Rate", "Revenue", "PO #", "Currency", "Note", "Gross Amount", "Net Amount", "Billable Amount"],
    ["Agency", "Brand", "006X", "Camp", "Display", "", 2_000_000, 5, 10000, "", "USD", "", 10000, 9000, 9000],
    ["", "", "", "", "", "", 400_000, 5, 2000, "", "USD", "", 2000, 1800, 1800]];
  const parsed = parseBillingSheet(rows);
  assert.equal(parsed.rows[0].billed, 10800);
  assert.equal(billingFileMonth("006X_-_Highmark_Billing_September.xlsx", [], new Date("2026-10-26T12:00:00")), "2026-09");
  assert.equal(billingFileMonth("Billing_December.xlsx", [], new Date("2026-10-26T12:00:00")), "2025-12");
  assert.equal(billingFileMonth("x.xlsx", [{ from: "2026-08-30", to: "2026-09-26" }]), "2026-09");
  const history = importedHistory("2026-09", [], [{ id: "a", billed: 10800 }]);
  assert.deepEqual([history.from, history.to, history.total, history.rows.a], ["2026-09-01", "2026-09-30", 10800, 10800]);
  const config = { periodMode: "month", history: { "2026-09": history }, rows: [{ id: "a", lineName: "Display", source: "DSP", rateType: "cpm", rate: 5, ioAmount: 12000, lines: ["Display"] }] };
  const result = computeClientBilling(config, [line("Display", { DSP: days("2026-10-01", "2026-10-31", { impressions: 100_000 }) })], "2026-10");
  assert.equal(result.rows[0].billable, 1200);
  assert.equal(result.rows[0].capped, true);
});

test("report totals that miss the month's edges are split by days, and a newer report beats stale DCM days", () => {
  const snapshots = [{ date: "2026-09-28", source: "Zeta", impressions: 2_800_000, spend: 14000 }, { date: "2026-10-12", source: "Zeta", impressions: 4_200_000, spend: 21000 }, { date: "2026-10-25", source: "Zeta", impressions: 5_500_000, spend: 27500 }];
  const records = [line("Display", { CM360: days("2026-10-01", "2026-10-07", { impressions: 50_000, spend: 250 }) }, { performanceSnapshots: snapshots })];
  const config = { periodMode: "month", rows: [{ id: "a", lineName: "Display", source: "CM360", rateType: "cpm", rate: 4, lines: ["Display"] }] };
  const running = computeClientBilling(config, records, "2026-10", "2026-10-26");
  // Sep 30 sits 2 of 14 days between the Sep 28 and Oct 12 totals: 2,800,000 + 1,400,000 × 2/14 = 3,000,000.
  assert.equal(running.rows[0].fromReport, true);
  assert.equal(running.rows[0].estimated, true);
  assert.equal(running.rows[0].quantity, 2_500_000);
  assert.equal(running.through, "2026-10-25");
  // September, closed: Sep 1 to Sep 30 needs both edges; the start falls before the first total, the flight began Jul 1.
  const september = computeClientBilling({ ...config, rows: [{ ...config.rows[0], source: "report" }] }, records, "2026-09");
  assert.equal(september.rows[0].unavailable, false);
  assert.ok(september.rows[0].quantity > 0);
});

test("the IO pace spreads the whole IO by day, so a month with two flights expects its days' share", () => {
  // Two flights, Sep 15 to Oct 10 and Oct 20 to Nov 18: the IO runs Sep 15 to Nov 18 (65 days), $65,000 = $1,000 a day.
  const records = [line("Flight 1", { DSP: days("2026-10-01", "2026-10-10", { impressions: 100_000 }) }, { startDate: "2026-09-15", endDate: "2026-10-10" }), line("Flight 2", { DSP: days("2026-10-20", "2026-10-31", { impressions: 100_000 }) }, { startDate: "2026-10-20", endDate: "2026-11-18" })];
  const config = { periodMode: "month", rows: [{ id: "a", lineName: "Display", source: "DSP", rateType: "cpm", rate: 5, ioAmount: 65000, lines: ["Flight 1", "Flight 2"] }] };
  const closed = computeClientBilling(config, records, "2026-10");
  assert.equal(closed.pace.expected, 31000);
  assert.equal(closed.pace.delivered, 11000);
  assert.equal(Math.round(closed.pace.deviation * 100), -65);
  const running = computeClientBilling(config, records, "2026-10", "2026-10-11");
  assert.equal(running.pace.expectedToDate, 10000);
  assert.equal(running.pace.delivered, 5000);
  const monthly = computeClientBilling({ ...config, rows: [{ ...config.rows[0], monthlyBudget: 20000 }] }, records, "2026-10");
  assert.equal(monthly.pace.expected, 20000);
});

test("the IO's monthly amounts come first: they cap the month and set what it expects", async () => {
  const records = [line("Display", { DSP: days("2026-10-01", "2026-10-31", { impressions: 400_000 }) }, { startDate: "2026-01-01", endDate: "2026-12-31" })];
  const config = { periodMode: "month", rows: [{ id: "a", lineName: "Display", source: "DSP", rateType: "cpm", rate: 3.96, ioAmount: 927233.88, lines: ["Display"] }] };
  const result = computeClientBilling(config, records, "2026-10", null, { ioMonthly: { a: 40000 } });
  assert.equal(result.pace.expected, 40000);
  assert.equal(result.rows[0].capped, true);
  assert.equal(result.rows[0].billable, 40000);
  // With no monthly amount, it spreads the whole IO by day.
  assert.equal(computeClientBilling(config, records, "2026-10").pace.expected, Math.round(927233.88 / 365 * 31 * 100) / 100);
});

test("weekly projections keep the newest number, and are due from Friday until updated", async () => {
  const { latestProjection, projectionDue, setProjection } = await import("../lib/billing.js");
  let config = setProjection({}, "2026-10", 50000, new Date("2026-10-16T15:00:00Z"));
  config = setProjection(config, "2026-10", 52000, new Date("2026-10-23T15:00:00Z"));
  config = setProjection(config, "2026-10", 51000, new Date("2026-10-23T18:00:00Z"));
  assert.deepEqual(config.projections["2026-10"].map(item => item.amount), [50000, 51000]);
  assert.equal(latestProjection(config, "2026-10").amount, 51000);
  assert.equal(projectionDue(config, "2026-10-24"), false);
  assert.equal(projectionDue(config, "2026-10-30"), true);
  assert.equal(projectionDue(config, "2026-10-28"), false);
});

test("hand edits to an IO change its budget and lines until a new IO replaces them", async () => {
  const { normalizeTotals, setCampaignTotals, setTotalsEdits } = await import("../lib/campaign-totals.js");
  const { ioLines } = await import("../lib/io-plan.js");
  const io = { orderNumber: "O-1", budget: 100000, startDate: "2026-01-01", endDate: "2026-12-31", lineItems: [{ id: "P1", name: "Display", startDate: "2026-01-01", endDate: "2026-12-31", budget: 100000, months: { "2026-10": 8000 } }] };
  let totals = setCampaignTotals({}, "c::x", io);
  totals = setTotalsEdits(totals, "c::x", { budget: 90000, lines: { display: { budget: 90000, endDate: "2026-11-30", months: { "2026-10": 5000 } } } });
  const entry = normalizeTotals(totals)["c::x"];
  assert.equal(entry.budget, 90000);
  const [line] = ioLines(entry);
  assert.deepEqual([line.budget, line.endDate, line.months["2026-10"], line.edited], [90000, "2026-11-30", 5000, true]);
  const replaced = normalizeTotals(setCampaignTotals(totals, "c::x", { ...io, revision: "R2" }))["c::x"];
  assert.equal(replaced.budget, 100000);
  assert.equal(replaced.edits, undefined);
});
