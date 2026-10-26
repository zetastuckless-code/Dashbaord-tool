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

/** A line's report totals from one source: the source whose dated totals reach furthest into the period. */
function reportSnapshots(record, from) {
  const all = (record.performanceSnapshots || []).filter(snapshot => !snapshot.dcm);
  const bySource = new Map();
  for (const snapshot of all) bySource.set(String(snapshot.source).toLowerCase(), [...(bySource.get(String(snapshot.source).toLowerCase()) || []), snapshot]);
  const best = [...bySource.values()].map(list => list.sort((a, b) => a.date.localeCompare(b.date))).filter(list => list.at(-1).date >= from).sort((a, b) => b.at(-1).date.localeCompare(a.at(-1).date) || b.length - a.length)[0];
  return best || [];
}
const dayCount = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * A line's running totals at the end of `day`. A dated total on that day is exact; between two dated totals the day
 * gets its share by days (an estimate), and before the flight starts everything is zero.
 */
function totalsAt(snapshots, day, startDate) {
  const exact = snapshots.find(snapshot => snapshot.date === day);
  if (exact) return { values: exact, estimated: false };
  const after = snapshots.find(snapshot => snapshot.date > day);
  let before = [...snapshots].reverse().find(snapshot => snapshot.date < day);
  if (startDate && day < startDate) return { values: {}, estimated: false };
  if (!before && startDate && after) before = { date: addDays(startDate, -1) };
  if (!before || !after) return null;
  const share = dayCount(before.date, day) / dayCount(before.date, after.date);
  return { values: Object.fromEntries(METRICS.map(metric => [metric, (Number(before[metric]) || 0) + ((Number(after[metric]) || 0) - (Number(before[metric]) || 0)) * share])), estimated: true };
}

/**
 * A line's numbers from its own report: the change in its running totals across the period. Totals dated on the
 * period's edges are exact; otherwise the edge is estimated between the totals around it. While the month is still
 * running (`soFar`), the end is the newest total in the period.
 */
function reportTotals(record, from, to, soFar = false) {
  const snapshots = reportSnapshots(record, from);
  const newest = snapshots.filter(snapshot => snapshot.date >= from && snapshot.date <= to).at(-1);
  if (!newest && (soFar || !snapshots.some(snapshot => snapshot.date > to))) return null;
  const endDay = soFar ? newest.date : to;
  const end = totalsAt(snapshots, endDay, record.startDate);
  const start = totalsAt(snapshots, addDays(from, -1), record.startDate);
  if (!end || !start) return null;
  return { through: endDay, estimated: end.estimated || start.estimated, ...Object.fromEntries(METRICS.map(metric => [metric, (Number(end.values[metric]) || 0) - (Number(start.values[metric]) || 0)])) };
}

/** The newest day a line's report covers inside the period, if any. */
const reportNewest = (record, from, to) => reportSnapshots(record, from).filter(snapshot => snapshot.date >= from && snapshot.date <= to).at(-1)?.date || null;


const round2 = value => Math.round(value * 100) / 100;
const formatAmount = value => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The most a row can bill this month: what's left of its IO amount after everything billed before, and the month's
 * budget when the IO sets one. `null` means no limit is known.
 */
export function billingLimit(row, { ioAmount = null, billedBefore = 0 } = {}) {
  const limits = [];
  if (Number.isFinite(ioAmount) && ioAmount > 0) limits.push(Math.max(0, ioAmount - billedBefore));
  const monthly = Number(row.monthlyBudget);
  if (Number.isFinite(monthly) && monthly > 0) limits.push(monthly);
  return limits.length ? round2(Math.min(...limits)) : null;
}

/**
 * Billing never goes over the IO: when a row's delivery is worth more than its limit, the billable stops at the limit
 * and the quantity drops to what that amount buys at the rate, the way the team writes it by hand.
 */
function applyLimit(items, limit) {
  if (limit === null) return items;
  let left = limit;
  return items.map(item => {
    if (item.billable <= left) { left = round2(left - item.billable); return { ...item, limit }; }
    const billable = round2(Math.max(0, left));
    left = 0;
    const discount = Number(item.row.discount) || 0;
    const gross = discount ? round2(billable / (1 - discount / 100)) : billable;
    const quantity = item.row.rateType === "cpm" && item.rate ? Math.round(gross / item.rate * 1000) : item.row.rateType === "cpv" && item.rate ? Math.round(gross / item.rate) : item.quantity;
    return { ...item, limit, capped: true, deliveredQuantity: item.quantity, deliveredBillable: item.billable, quantity, revenue: gross, gross, net: billable, billable };
  });
}

/** Fills one billing row for each of the window's periods. With `today` inside the month, it bills the days so far. */
export function computeBillingRow(row, records, window, today = null, budget = {}) {
  return applyLimit(rowPeriods(row, records, window, today), billingLimit(row, budget));
}

function rowPeriods(row, records, window, today) {
  const lines = records.filter(record => (row.lines || []).includes(record.name));
  return window.periods.map(period => {
    const days = daysBetween(period.from, period.to);
    const totals = Object.fromEntries(METRICS.map(metric => [metric, 0]));
    const missing = new Set();
    const soFar = Boolean(today) && period.to >= today;
    const throughDates = [];
    let unavailable = !lines.length;
    let reportLines = 0;
    let estimated = false;
    for (const line of lines) {
      // A line only needs data for the days it was live, and in a running month only up to its newest data.
      let liveDays = days.filter(day => (!line.startDate || day >= line.startDate) && (!line.endDate || day <= line.endDate));
      const stored = row.source === "report" ? [] : Object.keys(line.thirdPartyDelivery?.[row.source] || {}).filter(day => day >= period.from && day <= period.to && (!soFar || day < today));
      // DCM or DSP days bill a line only while they're as current as its uploaded report (the DSP numbers in its raw
      // tab) and have no gaps; otherwise the report bills it.
      const reportDay = row.source === "report" ? null : reportNewest(line, period.from, period.to);
      const sourceDays = liveDays.filter(day => day <= (stored.sort().at(-1) || ""));
      const sourceComplete = stored.length && sourceDays.every(day => stored.includes(day)) && (soFar || stored.sort().at(-1) >= liveDays.at(-1));
      const fromReport = row.source === "report" || (Boolean(reportDay) && (!sourceComplete || reportDay > stored.sort().at(-1)));
      if (fromReport && row.source !== "report") reportLines += 1;
      if (soFar && !fromReport) {
        const newest = stored.filter(day => day < today).sort().at(-1);
        liveDays = liveDays.filter(day => day < today && (!newest || day <= newest));
        if (newest) throughDates.push(newest);
      }
      if (!liveDays.length) continue;
      if (fromReport) {
        const figures = reportTotals(line, liveDays[0], liveDays.at(-1), soFar);
        if (!figures) { unavailable = true; continue; }
        if (figures.estimated) estimated = true;
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
    return { row, period, quantity: Math.round(quantity), rate, revenue: gross, gross, net, billable: net, totals, missingDays: [...missing].sort(), unavailable, soFar, through: soFar ? throughDates.sort().at(-1) || null : null, fromReport: reportLines > 0, estimated };
  });
}

/** Everything a row has billed before `month`: its starting amount plus each month downloaded since. */
export function billedBefore(config, row, month) {
  const downloaded = Object.entries(config.history || {}).filter(([key]) => key < month).reduce((sum, [, entry]) => sum + (Number(entry.rows?.[row.id]) || 0), 0);
  return round2((Number(row.billedBefore) || 0) + downloaded);
}

/**
 * A month's billing for one client. `today` (YYYY-MM-DD) marks a month still running, billed through its newest data.
 * `ioAmounts` gives each row's IO amount (by row id) when the row doesn't set its own.
 */
export function computeClientBilling(config, records, month, today = null, { ioAmounts = {} } = {}) {
  const window = billingWindow(config, month);
  const running = Boolean(today) && window.to >= today;
  const ioAmountOf = row => Number(row.ioAmount) > 0 ? Number(row.ioAmount) : Number.isFinite(ioAmounts[row.id]) ? ioAmounts[row.id] : null;
  const rows = (config.rows || []).filter(row => row.include !== false).flatMap(row => computeBillingRow(row, records, window, running ? today : null, { ioAmount: ioAmountOf(row), billedBefore: billedBefore(config, row, month) }));
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
    // A capped row bills the amount left on the IO, so its revenue is that amount rather than quantity × rate.
    const revenue = item.capped ? { value: item.revenue, format: MONEY } : item.row.rateType === "cpm" ? { type: "Formula", value: `G${at}*H${at}/1000`, format: MONEY } : item.row.rateType === "cpv" ? { type: "Formula", value: `G${at}*${item.rate}`, format: MONEY } : { value: item.revenue, format: MONEY };
    const splitNote = item.estimated ? "From report totals split by days; check against the final report" : "";
    const capNote = item.capped ? `Capped at the IO: ${formatAmount(item.billable)} billed of ${formatAmount(item.deliveredBillable)} delivered` : "";
    const discount = Number(item.row.discount) || 0;
    return [
      config.agency || "", config.advertiser || clientName, item.row.sfid || "", item.row.campaignName || "", item.row.lineName || "", item.period.label,
      { value: item.quantity, format: COUNT }, rateCell, revenue, item.row.po || "", config.currency || "USD", [item.row.note, splitNote, capNote].filter(Boolean).join(" · "),
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
    note: find(text => /^note/.test(text)), gross: find(text => /^gross/.test(text)), net: find(text => /^net/.test(text)), billable: find(text => /^billable/.test(text))
  };
  const cell = (row, key) => col[key] >= 0 ? row[col[key]] : null;
  const number = value => { const parsed = Number(String(value ?? "").replace(/[$,\s]/g, "")); return Number.isFinite(parsed) && String(value ?? "").trim() !== "" ? parsed : null; };
  // What a row billed: its billable (net) amount, else gross, else revenue.
  const billedAmount = row => number(cell(row, "billable")) ?? number(cell(row, "net")) ?? number(cell(row, "gross")) ?? number(cell(row, "revenue")) ?? 0;
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
    if (!line && !campaign) { if (previous) previous.billed = round2(previous.billed + billedAmount(row)); continue; }
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
    previous = { sfid: String(cell(row, "sfid") ?? "").trim(), campaignName: campaign, lineName: line || campaign, rate: rate ?? "", rateType, discount, po: ["n/a", "none"].includes(String(cell(row, "po") ?? "").trim().toLowerCase()) ? "" : String(cell(row, "po") ?? "").trim(), note: String(cell(row, "note") ?? "").trim(), billed: round2(billedAmount(row)) };
    result.rows.push(previous);
  }
  return result;
}

/**
 * The month a past billing file billed: its last custom period's month, else the month in its file name
 * ("…_Billing_September.xlsx", the most recent September), else the month before `today`'s billing month.
 */
export function billingFileMonth(fileName, periods = [], today = new Date()) {
  const last = periods.map(period => period.to).sort().at(-1);
  if (last) return last.slice(0, 7);
  const current = billingMonth(today);
  const named = MONTHS.findIndex(name => new RegExp(`(^|[^a-z])${name.toLowerCase()}`).test(String(fileName).toLowerCase()));
  if (named < 0) return previousMonth(new Date(`${current}-15T12:00:00Z`));
  const year = Number(current.slice(0, 4)) - (named + 1 > Number(current.slice(5, 7)) ? 1 : 0);
  return `${year}-${String(named + 1).padStart(2, "0")}`;
}

/** The history entry a past billing file leaves: what each row billed that month, so the IO cap counts it. */
export function importedHistory(month, periods, rows) {
  const range = monthRange(month);
  const inMonth = periods.filter(period => period.to.slice(0, 7) === month).sort((a, b) => a.from.localeCompare(b.from));
  return { from: inMonth[0]?.from || range.from, to: inMonth.at(-1)?.to || range.to, importedAt: new Date().toISOString(), total: round2(rows.reduce((sum, row) => sum + (Number(row.billed) || 0), 0)), rows: Object.fromEntries(rows.map(row => [row.id, Number(row.billed) || 0])) };
}
