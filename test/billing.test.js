import test from "node:test";
import assert from "node:assert/strict";
import { billingMonth, billingSheets, billingWindow, computeClientBilling, parseBillingSheet, previousMonth } from "../lib/billing.js";

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
