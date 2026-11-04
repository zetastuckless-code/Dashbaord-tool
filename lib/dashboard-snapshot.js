// The dashboard written out for ChatGPT: a summary, line and billing CSVs, and a guide, kept current in a folder
// ChatGPT reads through its OneDrive connector. Everything here only formats numbers the dashboard already worked out.
import { rowsToCsv } from "./workbook-import.js";

export const SNAPSHOT_FOLDER = "Dashboard for ChatGPT";
export const SNAPSHOT_FILES = Object.freeze({ guide: "READ ME FIRST.md", summary: "Dashboard snapshot.md", lines: "Lines.csv", billing: "Billing.csv" });

const money = value => Number.isFinite(value) ? `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
const count = value => Number.isFinite(value) ? Math.round(value).toLocaleString("en-US") : "—";
const percent = value => Number.isFinite(value) ? `${value.toFixed(0)}%` : "—";
const cell = value => String(value ?? "—").replace(/\|/g, "/").replace(/\s+/g, " ").trim() || "—";
const table = (headers, rows) => rows.length ? [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map(row => `| ${row.map(cell).join(" | ")} |`)].join("\n") : "_None._";

/**
 * The summary ChatGPT reads first. `data` is what the dashboard shows now:
 * { generatedAt, today, portfolio, clients: [{ client, dataThrough, campaigns, alerts, todos, billing, status }], uploads }.
 */
export function buildSnapshotMarkdown(data) {
  const out = [];
  out.push(`# Zeta campaign dashboard snapshot`);
  out.push(`Written ${data.generatedAt} by the Zeta Campaign Pacing dashboard. It rewrites this file whenever its data changes, so it is the current state. Read "${SNAPSHOT_FILES.guide}" for what each number means.`);
  const p = data.portfolio || {};
  out.push(`## All clients\n- Live campaigns: ${p.liveCampaigns ?? "—"} across ${p.clients ?? "—"} clients\n- Spend to date (billable): ${money(p.spend)} of ${money(p.budget)} budget\n- Overall pacing: ${percent(p.pacing)} (100% is on plan)\n- Open alerts: ${p.alerts ?? 0}`);
  for (const client of data.clients || []) {
    out.push(`## ${client.client}`);
    out.push(`Data through ${client.dataThrough || "unknown"}.`);
    out.push(`### Campaigns\n${table(["Campaign", "Status", "Flight", "Budget", "Spend", "Pacing", "KPI", "Goal", "vs goal"], (client.campaigns || []).map(item => [
      item.name, item.status, item.flight, item.addedValue ? `Added value · ${count(item.impressionGoal)} impressions` : money(item.budget), money(item.spend), percent(item.pacing), item.kpi, item.goal, item.goalStatus
    ]))}`);
    if (client.alerts?.length) out.push(`### Alerts\n${client.alerts.map(alert => `- ${alert.severity === "critical" ? "Critical: " : ""}${alert.title}${alert.line ? ` (${alert.line})` : ""}${alert.detail ? `. ${alert.detail}` : ""}`).join("\n")}`);
    if (client.todos?.length) out.push(`### Open to-dos\n${client.todos.map(todo => `- ${todo.text}${todo.due ? ` (due ${todo.due})` : ""}${todo.urgent ? " · urgent" : ""}`).join("\n")}`);
    if (client.status?.length) out.push(`### Weekly status doc rows\n${table(["Campaign", "On/Off Track", "Performance Notes & Optimizations", "Notes", "Cadence", "Report name"], client.status.map(row => [row.name, row.track, row.performance, row.notes, row.cadence, row.reportName]))}`);
    for (const month of client.billing || []) {
      out.push(`### Billing · ${month.label}\nStatus: ${month.status}. Total ${money(month.total)}${month.billedOnFile !== null && month.billedOnFile !== undefined ? ` (billed on file: ${money(month.billedOnFile)})` : ""}.\n\n${table(["Line item", "Period", "From", "Quantity", "Rate", "Billable", "Billed on file", "Check"], month.rows.map(row => [row.lineItem, row.period, row.source, count(row.quantity), row.rate, money(row.billable), Number.isFinite(row.billed) ? money(row.billed) : "—", row.check]))}`);
    }
  }
  if (data.uploads?.length) out.push(`## Files pulled in, last 7 days\n${table(["When", "File", "Type", "Client", "Result"], data.uploads.map(item => [item.at, item.fileName, item.kind, item.clients, item.result]))}`);
  return `${out.join("\n\n")}\n`;
}

/** One row per dashboard line, for questions the summary doesn't answer. */
export function buildLinesCsv(lines) {
  const headers = ["client", "campaign", "line", "status", "flight_start", "flight_end", "budget", "billable_spend", "media_spend", "impressions", "clicks", "ctr_percent", "conversions", "revenue", "video_completions", "vcr_percent", "kpi", "kpi_value", "kpi_goal", "kpi_vs_goal", "pacing_percent", "data_through", "dcm_through", "dsp_through"];
  return rowsToCsv([headers, ...lines.map(line => headers.map(key => line[key] ?? ""))]);
}

/** Every billing row of every client for the months in the snapshot, with each line's part when it has lines. */
export function buildBillingCsv(clients) {
  const headers = ["client", "month", "status", "line_item", "line", "period", "source", "rate_type", "rate", "quantity", "billable", "billed_on_file", "data", "check"];
  const rows = [headers];
  for (const client of clients) {
    for (const month of client.billing || []) {
      for (const row of month.rows) {
        rows.push([client.client, month.month, month.status, row.lineItem, "", row.period, row.source, row.rateType, row.rate, row.quantity, row.billable, row.billed ?? "", row.data || "", row.check]);
        for (const line of row.lines || []) rows.push([client.client, month.month, month.status, row.lineItem, line.name, row.period, line.source, row.rateType, row.rate, line.quantity, line.billable ?? "", "", line.data, ""]);
      }
    }
  }
  return rowsToCsv(rows);
}

/** How ChatGPT should read the folder and answer. Written once and kept the same unless the dashboard changes. */
export function buildGuide() {
  return `# How to use the dashboard files

These files are written by the Zeta Campaign Pacing dashboard and rewritten whenever its data changes. Treat them as the current numbers. Never invent a number that isn't in them; if something isn't here, say so.

## The files
- **${SNAPSHOT_FILES.summary}**: start here. Every client's campaigns, pacing, KPIs against goals, alerts, open to-dos, this week's status doc rows, and billing for this month and last month.
- **${SNAPSHOT_FILES.lines}**: one row per dashboard line with its full numbers. Use it for line-level questions and anything the summary doesn't show.
- **${SNAPSHOT_FILES.billing}**: every billing row for this month and last month, followed by a row for each of its lines. Use it to check billing.
- The "Reporting packs" folder next to this one has per-client packs with period-over-period comparisons and the raw DCM and DSP rows.

## What the numbers mean
- **Spend / billable_spend** is what the client is billed: delivered impressions or views at the IO rate, from DCM or DSP. **media_spend** is what the DSP reported spending. Don't mix them; client-facing numbers use billable spend.
- **Pacing** compares spend to a straight-line plan from the flight start to today. 100% is on plan; under 90% is behind; over 110% is ahead.
- **Added value** campaigns are free ($0). They pace on impressions against the IO's impression goal, and bill nothing.
- **KPI vs goal**: "on" meets the goal, "close" is within the tolerance, "off" misses it. For CPA and CPC lower is better; for CTR, VCR, and ROAS higher is better. ROAS is revenue per dollar spent, written as dollars ($3.86).
- **Data through** is the newest day of numbers. Recent days can be missing until the next report arrives.

## Billing
- Billing reads only DCM and DSP numbers, through the last day they cover. "Data through" with days "not in yet" means the month isn't finished.
- "Billed on file" is what was actually billed (from the billing file or the downloaded month). A difference between it and "Billable" is worth pointing out.
- A row's "Check" column says what to look at: missing days, lines with no DCM or DSP days, or gaps someone marked as fine.

## How to answer
- Lead with the answer and the number, then the reason. Name the client, campaign, and dates.
- When asked for a client report or email, use that client's section and its reporting pack; keep only the numbers that matter.
- For the weekly status doc, use the "Weekly status doc rows" table: one row per campaign, in that column order.
- For billing checks, go row by row: confirm the dates are complete, the quantity times the rate gives the billable amount, and the lines add up to the row. List anything that looks wrong.
`;
}

/** The prompt to paste into a ChatGPT project so it knows where the files are and how to use them. */
export function buildChatGptPrompt({ folder = "my morning brief folder" } = {}) {
  return `My campaign dashboard writes its current numbers to OneDrive, in "${folder}" › "${SNAPSHOT_FOLDER}". Use the OneDrive connector to read that folder whenever I ask about campaigns, pacing, KPIs, billing, client reports, or the weekly status doc.

Start every answer by reading "${SNAPSHOT_FILES.guide}" and "${SNAPSHOT_FILES.summary}". Use "${SNAPSHOT_FILES.lines}" for line-level detail and "${SNAPSHOT_FILES.billing}" for billing checks. Read the files fresh each time; they change during the day.

Only use numbers from these files. If something I ask about isn't in them, tell me rather than guessing. Say which date the numbers run through.`;
}
