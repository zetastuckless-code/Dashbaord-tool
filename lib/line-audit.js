import { resolveSpend, discrepancyStatus } from "./source-comparison.js";

const has = value => Number.isFinite(value);

/**
 * Describes what a line actually carries so someone can check an import: where each number came from, which fields
 * are present or missing, and anything that looks off. `state` is "ok", "missing" (expected but absent), or "na".
 */
export function auditLine(line, { placement = null, order = null, flightAware = null } = {}) {
  const record = line.record || line;
  const chips = [];
  const chip = (label, value, state, display = value) => chips.push({ label, value: display, state });
  const kpi = String(record.kpi || "").toUpperCase();
  const spend = resolveSpend(line, "billing");
  chip("Spend", spend, has(spend) && spend > 0 ? "ok" : "missing");
  if (has(line.firstPartySpend) || has(line.thirdPartySpend)) {
    chip("1st-party spend", line.firstPartySpend ?? null, has(line.firstPartySpend) ? "ok" : "na");
    chip("3rd-party spend", line.thirdPartySpend ?? null, has(line.thirdPartySpend) ? "ok" : "na");
  }
  chip("Budget", line.budget ?? null, has(line.budget) && line.budget > 0 ? "ok" : "missing");
  chip("Impressions", line.impressions ?? null, has(line.impressions) ? "ok" : "missing");
  if (has(line.dspImpressions)) chip("DSP impressions", line.dspImpressions, "ok");
  chip("Clicks", line.clicks ?? null, has(line.clicks) ? "ok" : "missing");
  const ctr = has(line.impressions) && line.impressions > 0 && has(line.clicks) ? line.clicks / line.impressions * 100 : null;
  chip("CTR", ctr, ctr === null ? "missing" : "ok", ctr === null ? null : `${ctr.toFixed(3)}%`);
  if (has(line.conversions) || kpi === "CPA") chip("Conversions", line.conversions ?? null, has(line.conversions) ? "ok" : "missing");
  if (has(line.revenue) || kpi === "ROAS") chip("Revenue", line.revenue ?? null, has(line.revenue) ? "ok" : "missing");
  if (has(line.videoStarts) || has(line.videoCompletions) || kpi === "VCR") {
    chip("Video starts", line.videoStarts ?? null, has(line.videoStarts) ? "ok" : "missing");
    chip("Video completes", line.videoCompletions ?? null, has(line.videoCompletions) ? "ok" : "missing");
  }
  const dates = line.startDate && line.endDate;
  chip("Flight dates", dates ? `${line.startDate} → ${line.endDate}` : placement ? `${placement.startDate} → ${placement.endDate}` : null, dates || placement ? "ok" : "missing");

  const notes = [];
  if (!has(line.impressions)) notes.push("Impressions are missing, so CTR and CPM cannot be calculated.");
  if (has(line.impressions) && !has(line.clicks)) notes.push("Clicks are missing, so CTR cannot be calculated.");
  if (!(has(line.budget) && line.budget > 0)) notes.push("No budget on this line; pacing falls back to the campaign order total or is unavailable.");
  const discrepancy = discrepancyStatus(line, 10);
  if (discrepancy.flagged) notes.push(`First- and third-party spend differ by ${discrepancy.label.replace(" source variance", "")}.`);
  if (placement) {
    notes.push(`Flight dates come from the insertion order${order ? ` ${order}` : ""}: ${placement.startDate} → ${placement.endDate}${placement.budget ? `, order budget $${Number(placement.budget).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : ""}.`);
    if (has(line.budget) && has(placement.budget) && Math.abs(line.budget - placement.budget) > Math.max(1, placement.budget * 0.02)) notes.push(`Report budget $${line.budget.toLocaleString("en-US", { minimumFractionDigits: 2 })} differs from the order's $${placement.budget.toLocaleString("en-US", { minimumFractionDigits: 2 })} for this flight.`);
  } else if (!dates) {
    notes.push("No flight dates on this line. Apply an insertion order to the campaign to pull them in.");
  }
  if (flightAware !== null && has(record.pacing) && Math.abs(flightAware - record.pacing) > 5) notes.push(`Pacing is ${Math.round(flightAware)}% against the flight dates but the report states ${Math.round(record.pacing)}%.`);

  const origin = record.sourceSheet
    ? `sheet “${record.sourceSheet}”${record.sourceRow ? `, row ${record.sourceRow}` : ""}${record.sourceFile ? ` of ${record.sourceFile}` : ""}`
    : record.sourceFile ? `file ${record.sourceFile}` : null;
  return {
    source: origin ? `From ${origin}` : "Source not recorded (imported before row sources were tracked; re-import the report to capture it).",
    dataThrough: record.dataAsOf || null,
    system: record.source || null,
    chips,
    notes,
    missing: chips.filter(item => item.state === "missing").map(item => item.label)
  };
}
