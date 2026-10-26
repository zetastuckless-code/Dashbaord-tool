// Monthly billing: each client's billing rows (set up once, or read from last month's billing file), filled from the
// DCM and DSP days the dashboard already stores, and written out in the Final Billing layout.

export const BILLING_KEY = "northstar-billing";
export const SOURCES = { DSP: "DSP", CM360: "DCM", report: "Client report" };
export const RATE_TYPES = { cpm: "CPM", cpv: "CPV", spend: "Spend passed through", flat: "Flat fee" };
const DAY_MS = 86_400_000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function readBilling(storage) {
  try {
    const value = JSON.parse(storage.getItem(BILLING_KEY));
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function writeBilling(storage, billing) {
  try { storage.setItem(BILLING_KEY, JSON.stringify(billing)); } catch { /* kept in memory for this visit */ }
  return billing;
}

const iso = time => new Date(time).toISOString().slice(0, 10);
const addDays = (day, count) => iso(Date.parse(`${day}T00:00:00Z`) + count * DAY_MS);
export const monthLabel = month => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
export const monthName = month => MONTHS[Number(month.slice(5, 7)) - 1];
export function previousMonth(today = new Date()) {
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  return date.toISOString().slice(0, 7);
}
/**
 * The month billing is working on. In the first week of a month that's the month just ended (billing is pulled then);
 * after that it's the current month, month to date.
 */
export function billingMonth(today = new Date()) {
  if (today.getDate() <= 7) return previousMonth(new Date(Date.UTC(today.getFullYear(), today.getMonth(), 15)));
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}
export function monthRange(month) {
  const [year, index] = month.split("-").map(Number);
  return { from: `${month}-01`, to: iso(Date.UTC(year, index, 0)) };
}
const daysBetween = (from, to) => {
  const days = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
};
const usDate = day => `${day.slice(5, 7)}/${day.slice(8, 10)}/${day.slice(0, 4)}`;

/**
 * The days a month's billing covers, split into the client's billing periods. Calendar billing is the month itself.
 * Custom periods (like 08/30–09/26) run from the day after the last billed day to the month's end, and each part keeps
 * its full period as its label, so a period that runs into next month is billed for its days so far.
 */
export function billingWindow(config, month) {
  const range = monthRange(month);
  if (config.periodMode !== "custom" || !config.periods?.length) return { ...range, periods: [{ label: "", from: range.from, to: range.to }] };
  const lastBilled = Object.entries(config.history || {}).filter(([key]) => key < month).map(([, value]) => value.to).sort().at(-1);
  const from = lastBilled ? addDays(lastBilled, 1) : range.from;
  const periods = config.periods
    .filter(period => period.from && period.to && period.from <= range.to && period.to >= from)
    .sort((a, b) => a.from.localeCompare(b.from))
    .map(period => ({ label: `${usDate(period.from)} - ${usDate(period.to)}`, from: period.from > from ? period.from : from, to: period.to < range.to ? period.to : range.to }));
  return { from, to: range.to, periods: periods.length ? periods : [{ label: "", from, to: range.to }] };
}

const METRICS = ["impressions", "clicks", "spend", "videoCompletions", "videoStarts"];

/** One line's numbers over a run of days from DCM or DSP, with any days that are missing. */
function deliveryTotals(record, source, days) {
  const stored = record.thirdPartyDelivery?.[source] || {};
  const totals = Object.fromEntries(METRICS.map(metric => [metric, 0]));
  const missing = [];
  for (const day of days) {
    const metrics = stored[day];
    if (!metrics) { missing.push(day); continue; }
    for (const metric of METRICS) if (Number.isFinite(metrics[metric])) totals[metric] += metrics[metric];
  }
  return { totals, missing };
}

/**
 * A line's numbers from its own report: the change between two dated totals that sit exactly on the period's edges.
 * While the month is still running (`soFar`), the end is the newest total in the period instead.
 */
function reportTotals(record, from, to, soFar = false) {
  const snapshots = (record.performanceSnapshots || []).filter(snapshot => !snapshot.dcm);
  const end = soFar ? snapshots.filter(snapshot => snapshot.date >= from && snapshot.date <= to).sort((a, b) => b.date.localeCompare(a.date))[0] : snapshots.find(snapshot => snapshot.date === to);
  const before = addDays(from, -1);
  const start = snapshots.find(snapshot => snapshot.date === before) || (record.startDate && record.startDate >= from ? { date: before } : null);
  if (!end || !start) return null;
  return { through: end.date, ...Object.fromEntries(METRICS.map(metric => [metric, (Number(end[metric]) || 0) - (Number(start[metric]) || 0)])) };
}

const round2 = value => Math.round(value * 100) / 100;

/** Fills one billing row for each of the window's periods. With `today` inside the month, it bills the days so far. */
export function computeBillingRow(row, records, window, today = null) {
  const lines = records.filter(record => (row.lines || []).includes(record.name));
  return window.periods.map(period => {
    const days = daysBetween(period.from, period.to);
    const totals = Object.fromEntries(METRICS.map(metric => [metric, 0]));
    const missing = new Set();
    const soFar = Boolean(today) && period.to >= today;
    const throughDates = [];
    let unavailable = !lines.length;
    for (const line of lines) {
      // A line only needs data for the days it was live, and in a running month only up to its newest data.
      let liveDays = days.filter(day => (!line.startDate || day >= line.startDate) && (!line.endDate || day <= line.endDate));
      if (soFar) {
        const stored = row.source === "report" ? [] : Object.keys(line.thirdPartyDelivery?.[row.source] || {});
        const newest = row.source === "report" ? null : stored.filter(day => day >= period.from && day < today).sort().at(-1);
        if (row.source !== "report") liveDays = liveDays.filter(day => day < today && (!newest || day <= newest));
        if (newest) throughDates.push(newest);
      }
      if (!liveDays.length) continue;
      if (row.source === "report") {
        const figures = reportTotals(line, liveDays[0], liveDays.at(-1), soFar);
        if (!figures) { unavailable = true; continue; }
        if (soFar) throughDates.push(figures.through);
        for (const metric of METRICS) totals[metric] += figures[metric];
      } else {
        const result = deliveryTotals(line, row.source, liveDays);
        result.missing.forEach(day => missing.add(day));
        for (const metric of METRICS) totals[metric] += result.totals[metric];
      }
    }
    const rate = Number(row.rate) || 0;
    const quantity = row.rateType === "cpv" ? totals.videoCompletions : totals.impressions;
    const revenue = row.rateType === "cpm" ? quantity * rate / 1000 : row.rateType === "cpv" ? quantity * rate : row.rateType === "spend" ? totals.spend : rate;
    const gross = round2(revenue);
    const net = round2(gross * (1 - (Number(row.discount) || 0) / 100));
    return { row, period, quantity: Math.round(quantity), rate, revenue: gross, gross, net, billable: net, totals, missingDays: [...missing].sort(), unavailable, soFar, through: soFar ? throughDates.sort().at(-1) || null : null };
  });
}

/** A month's billing for one client. `today` (YYYY-MM-DD) marks a month still running, billed through its newest data. */
export function computeClientBilling(config, records, month, today = null) {
  const window = billingWindow(config, month);
  const running = Boolean(today) && window.to >= today;
  const rows = (config.rows || []).filter(row => row.include !== false).flatMap(row => computeBillingRow(row, records, window, running ? today : null));
  const missingDays = [...new Set(rows.flatMap(item => item.missingDays))].sort();
  const unavailable = rows.filter(item => item.unavailable).map(item => item.row.lineName || item.row.campaignName);
  const through = running ? rows.map(item => item.through).filter(Boolean).sort().at(-1) || null : null;
  return { month, window, rows, missingDays, unavailable: [...new Set(unavailable)], total: round2(rows.reduce((sum, item) => sum + item.billable, 0)), ready: !running && rows.length > 0 && !missingDays.length && !unavailable.length, running, through };
}

const HEADERS = ["Customer  / Agency NameName", "Advertiser / Brand Name", "Sales Force ID", "Campaign Name", "Line Item (Internal Display Name)", "", "Quantity", "Rate", "Revenue", "PO #", "Currency", "Note", "Gross Amount", "Net Amount", "Billable Amount ( Gross / Net )"];
const HINTS = ["Agency Name from IO", "Brand / Advertiser Name from IO", "Sales force Opp ID", "Campaign name as per IO", "Mode of Advertisement as per delivery / IO", "", "Impressions count as per the delivery", "Rate mentioned on the IO", "Quantity * rate / 1000", "PO numbers provided on the IO/If Required", "Currency mentioned on the IO", "Any special Instruction for specifi that Opp", "Pre-Discount AMOUNT", "Post-Discount AMOUNT", "Which we need to bill customer"];
const MONEY = "[$$-409]#,##0.00";
// The blue of Zeta's client reports, with white bold text.
const ZETA_HEADER = { fontWeight: "bold", backgroundColor: "#003399", textColor: "#FFFFFF" };
const COUNT = "#,##0";

/** The workbook as sheet data for write-excel-file: Final Billing in the standard layout, then the days behind it. */
export function billingSheets(config, result, clientName) {
  const header = HEADERS.map(value => ({ value, ...ZETA_HEADER, wrap: true }));
  const hints = HINTS.map(value => ({ value, fontStyle: "italic", textColor: "#595959", wrap: true }));
  const first = 4;
  const body = result.rows.map((item, index) => {
    const at = first + index;
    const rateCell = item.row.rateType === "cpv" ? `CPV ${item.rate}` : item.row.rateType === "flat" ? item.rate : item.rate || "";
    const revenue = item.row.rateType === "cpm" ? { type: "Formula", value: `G${at}*H${at}/1000`, format: MONEY } : item.row.rateType === "cpv" ? { type: "Formula", value: `G${at}*${item.rate}`, format: MONEY } : { value: item.revenue, format: MONEY };
    const discount = Number(item.row.discount) || 0;
    return [
      config.agency || "", config.advertiser || clientName, item.row.sfid || "", item.row.campaignName || "", item.row.lineName || "", item.period.label,
      { value: item.quantity, format: COUNT }, rateCell, revenue, item.row.po || "", config.currency || "USD", item.row.note || "",
      { type: "Formula", value: `I${at}`, format: MONEY },
      discount ? { type: "Formula", value: `M${at}*(1-${discount}/100)`, format: MONEY } : { type: "Formula", value: `M${at}`, format: MONEY },
      { type: "Formula", value: `N${at}`, format: MONEY }
    ];
  });
  const last = first + body.length - 1;
  const totals = body.length ? ["", "", "", "", "", "Total", { type: "Formula", value: `SUM(G${first}:G${last})`, format: COUNT, fontWeight: "bold" }, "", { type: "Formula", value: `SUM(I${first}:I${last})`, format: MONEY, fontWeight: "bold" }, "", "", "", { type: "Formula", value: `SUM(M${first}:M${last})`, format: MONEY, fontWeight: "bold" }, { type: "Formula", value: `SUM(N${first}:N${last})`, format: MONEY, fontWeight: "bold" }, { type: "Formula", value: `SUM(O${first}:O${last})`, format: MONEY, fontWeight: "bold" }] : [];
  const finalBilling = [[], header, hints, ...body, ...(body.length ? [totals] : [])];
  // The raw data tab: the DCM or DSP rows themselves, or a line's daily totals where its rows weren't kept.
  const RAW_HEADERS = ["Date", "Campaign", "Campaign ID", "Placement / Line item", "Creative", "Impressions", "Clicks", "Media cost", "Video starts", "Video completions", "Conversions", "Revenue", "Billing line", "Dashboard line", "Source"];
  const source = [RAW_HEADERS.map(value => ({ value, ...ZETA_HEADER }))];
  const count = value => ({ value: Number.isFinite(value) ? value : 0, format: COUNT });
  for (const item of result.rows) {
    const rows = item.rawRows?.length ? item.rawRows : (item.lineDays || []).map(day => ({ ...day, campaign: "", campaignId: "", placement: "All placements (daily total)", creative: "", line: day.name }));
    for (const row of rows) source.push([{ value: new Date(`${row.date}T00:00:00Z`), type: Date, format: "mm/dd/yyyy" }, row.campaign || "", row.campaignId || "", row.placement || "", row.creative || "", count(row.impressions), count(row.clicks), { value: Number.isFinite(row.spend) ? row.spend : 0, format: MONEY }, count(row.videoStarts), count(row.videoCompletions), count(row.conversions), { value: Number.isFinite(row.revenue) ? row.revenue : 0, format: MONEY }, item.row.lineName || item.row.campaignName || "", row.line || "", SOURCES[item.row.source]]);
  }
  if (source.length > 1) {
    const end = source.length;
    source.push(["Total", "", "", "", "", ..."FGHIJKL".split("").map(column => ({ type: "Formula", value: `SUM(${column}2:${column}${end})`, format: ["H", "L"].includes(column) ? MONEY : COUNT, fontWeight: "bold" })), "", "", ""]);
  }
  return [
    { data: finalBilling, sheet: "Final Billing", columns: [22, 22, 20, 34, 40, 22, 14, 10, 14, 18, 10, 24, 14, 14, 18].map(width => ({ width })) },
    { data: source, sheet: "3P Billing Data Source Data", columns: [12, 40, 14, 44, 44, 14, 10, 14, 12, 16, 12, 14, 30, 36, 8].map(width => ({ width })) }
  ];
}

/** Every day behind each billed row, for the source tab (DCM and DSP rows only; a report only has dated totals). */
export function attachLineDays(result, records) {
  for (const item of result.rows) {
    if (item.row.source === "report") { item.lineDays = []; continue; }
    const lines = records.filter(record => (item.row.lines || []).includes(record.name));
    item.lineDays = daysBetween(item.period.from, item.period.to).flatMap(date => lines.flatMap(line => {
      const metrics = line.thirdPartyDelivery?.[item.row.source]?.[date];
      return metrics ? [{ date, name: line.name, ...metrics }] : [];
    }));
  }
  return result;
}

export const billingFileName = (config, clientName, month) => `${(config.rows || []).find(row => row.sfid)?.sfid ? `${config.rows.find(row => row.sfid).sfid}_-_` : ""}${clientName.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "")}_Billing_${monthName(month)}.xlsx`;

/**
 * Reads a past Final Billing tab into billing rows: the header row is found by its labels, since columns move a little
 * between templates. Rates like "CPV 0.05" become CPV; a row whose revenue isn't quantity × rate ÷ 1000 is spend passed
 * through; a net below gross becomes a discount.
 */
export function parseBillingSheet(rows) {
  const norm = value => String(value ?? "").toLowerCase().replace(/[^a-z#]+/g, " ").trim();
  const headerIndex = rows.findIndex(row => row.some(cell => /customer.*agency/.test(norm(cell))) && row.some(cell => /quantity/.test(norm(cell))));
  if (headerIndex < 0) return null;
  const header = rows[headerIndex].map(norm);
  const find = test => header.findIndex(test);
  const col = {
    agency: find(text => /customer.*agency/.test(text)), advertiser: find(text => /advertiser/.test(text)), sfid: find(text => /sales force/.test(text)),
    campaign: find(text => /^campaign name/.test(text)), line: find(text => /^line item/.test(text)), quantity: find(text => /^quantity/.test(text)),
    rate: find(text => /^rate/.test(text)), revenue: find(text => /^revenue/.test(text)), po: find(text => /^po/.test(text)), currency: find(text => /^currency/.test(text)),
    note: find(text => /^note/.test(text)), gross: find(text => /^gross/.test(text)), net: find(text => /^net/.test(text))
  };
  const cell = (row, key) => col[key] >= 0 ? row[col[key]] : null;
  const number = value => { const parsed = Number(String(value ?? "").replace(/[$,\s]/g, "")); return Number.isFinite(parsed) && String(value ?? "").trim() !== "" ? parsed : null; };
  const result = { agency: "", advertiser: "", currency: "USD", rows: [], periods: [] };
  let previous = null;
  for (const row of rows.slice(headerIndex + 1)) {
    const quantity = number(cell(row, "quantity"));
    const periodText = row.map(value => String(value ?? "")).find(value => /^\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}\/\d{2}\/\d{4}$/.test(value.trim()));
    if (periodText) {
      const [from, to] = periodText.split("-").map(part => part.trim()).map(part => `${part.slice(6, 10)}-${part.slice(0, 2)}-${part.slice(3, 5)}`);
      if (!result.periods.some(period => period.from === from)) result.periods.push({ from, to });
    }
    const line = String(cell(row, "line") ?? "").trim();
    const campaign = String(cell(row, "campaign") ?? "").trim();
    if (quantity === null || (!line && !campaign && !previous)) continue;
    // A continuation row (another period of the line above) leaves the names blank.
    if (!line && !campaign) continue;
    const rateText = String(cell(row, "rate") ?? "").trim();
    const rate = number(rateText) ?? number(rateText.replace(/^cpv/i, ""));
    const revenue = number(cell(row, "revenue"));
    const gross = number(cell(row, "gross")) ?? revenue;
    const net = number(cell(row, "net"));
    const isCpv = /^cpv/i.test(rateText);
    // A hand-adjusted quantity can carry a stray minus sign (Highmark's OLV row: −4,393,857 at $14 for $61,514); it's still CPM.
    const cpmRevenue = rate !== null ? Math.abs(quantity) * rate / 1000 : null;
    const rateType = isCpv ? "cpv" : rate !== null && (revenue === null || Math.abs(revenue - cpmRevenue) < 1) ? "cpm" : "spend";
    const discount = gross && net && net < gross ? Math.round((1 - net / gross) * 10000) / 100 : 0;
    result.agency ||= String(cell(row, "agency") ?? "").trim();
    result.advertiser ||= String(cell(row, "advertiser") ?? "").trim();
    const currency = String(cell(row, "currency") ?? "").trim();
    if (currency) result.currency = currency;
    previous = { sfid: String(cell(row, "sfid") ?? "").trim(), campaignName: campaign, lineName: line || campaign, rate: rate ?? "", rateType, discount, po: ["n/a", "none"].includes(String(cell(row, "po") ?? "").trim().toLowerCase()) ? "" : String(cell(row, "po") ?? "").trim(), note: String(cell(row, "note") ?? "").trim() };
    result.rows.push(previous);
  }
  return result;
}
