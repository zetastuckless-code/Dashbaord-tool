// The report builder's "Export with data": the report on one tab and, on a second, every DCM and DSP row behind it,
// the same way the billing file carries its source data. Sheets are in write-excel-file's format.

const MONEY = "[$$-409]#,##0.00";
const RATE = "[$$-409]#,##0.00";
const PERCENT = "0.00\"%\"";
const COUNT = "#,##0";
const HEADER = { fontWeight: "bold", backgroundColor: "#003399", textColor: "#FFFFFF" };
const FORMATS = { money: MONEY, rate: RATE, percent: PERCENT, count: COUNT };
const date = day => ({ value: new Date(`${day}T00:00:00Z`), type: Date, format: "mm/dd/yyyy" });
// A blank (no conversions, so no CPA) is an empty cell: the Excel writer can't format a cell with nothing in it.
const number = (value, format) => Number.isFinite(value) ? { value, type: Number, format } : null;

/**
 * The report tab: one row per group (and date, when the report is by day, week, month, or quarter) with the chosen
 * columns, then the total. `columns` are [key, label, kind] as the builder shows them; `bucketText` labels a date bucket.
 */
export function reportSheet(report, columns, { groupLabel = "Group", bucketText = bucket => bucket } = {}) {
  const byDate = report.grain !== "total";
  const header = [...(byDate ? ["Date"] : []), groupLabel, ...columns.map(([, label]) => label), "Days", "Estimated days"].map(value => ({ value, ...HEADER }));
  const cells = row => columns.map(([key, , kind]) => number(row[key], FORMATS[kind] || COUNT));
  const rows = report.rows.map(row => [...(byDate ? [bucketText(row.bucket)] : []), row.group, ...cells(row), row.days, row.estimatedDays]);
  const total = [...(byDate ? [""] : []), { value: "Total", fontWeight: "bold" }, ...cells(report.total).map(cell => cell && { ...cell, fontWeight: "bold" }), report.total.days, report.total.estimatedDays];
  return [header, ...rows, total];
}

/**
 * The data tab: each DCM or DSP row kept for the lines in the report, or a line's daily totals where its rows weren't
 * kept (imported before rows were stored), with which dashboard line it belongs to.
 */
export function rawDataSheet(rows) {
  const headers = ["Date", "Source", "Campaign", "Campaign ID", "Placement / Line item", "Creative", "Impressions", "Clicks", "Media cost", "Video starts", "Video completions", "Conversions", "Revenue", "Dashboard line"];
  const sheet = [headers.map(value => ({ value, ...HEADER }))];
  for (const row of rows) {
    sheet.push([date(row.date), row.source === "CM360" ? "DCM" : row.source || "", row.campaign || "", row.campaignId || "", row.placement || "", row.creative || "", number(row.impressions || 0, COUNT), number(row.clicks || 0, COUNT), number(row.spend || 0, MONEY), number(row.videoStarts || 0, COUNT), number(row.videoCompletions || 0, COUNT), number(row.conversions || 0, COUNT), number(row.revenue || 0, MONEY), row.line || ""]);
  }
  if (sheet.length > 1) {
    const end = sheet.length;
    sheet.push(["Total", "", "", "", "", "", ..."GHIJKLM".split("").map(column => ({ type: "Formula", value: `SUM(${column}2:${column}${end})`, format: ["I", "M"].includes(column) ? MONEY : COUNT, fontWeight: "bold" })), ""]);
  }
  return sheet;
}

/** A line's DCM and DSP days as daily-total rows, for lines whose individual rows weren't kept. */
export function dailyTotalRows(record, start, end) {
  const rows = [];
  for (const source of ["DSP", "CM360"]) {
    for (const [day, metrics] of Object.entries(record.thirdPartyDelivery?.[source] || {})) {
      if (day < start || day > end) continue;
      rows.push({ date: day, source, campaign: "", campaignId: "", placement: "All placements (daily total)", creative: "", ...metrics, line: record.name });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source));
}

export function reportWorkbook({ report, columns, rawRows, groupLabel, bucketText }) {
  return [
    { data: reportSheet(report, columns, { groupLabel, bucketText }), sheet: "Report", columns: [...(report.grain !== "total" ? [{ width: 16 }] : []), { width: 44 }, ...columns.map(() => ({ width: 14 })), { width: 8 }, { width: 14 }] },
    { data: rawDataSheet(rawRows), sheet: "DCM & DSP data", columns: [12, 8, 34, 14, 52, 40, 13, 10, 13, 12, 16, 12, 13, 40].map(width => ({ width })) }
  ];
}
