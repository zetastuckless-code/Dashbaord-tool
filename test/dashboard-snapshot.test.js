import test from "node:test";
import assert from "node:assert/strict";
import { buildBillingCsv, buildChatGptPrompt, buildGuide, buildLinesCsv, buildSnapshotMarkdown, SNAPSHOT_FILES, SNAPSHOT_FOLDER } from "../lib/dashboard-snapshot.js";

const data = {
  generatedAt: "Nov 4, 2026, 9:00 AM",
  portfolio: { clients: 1, liveCampaigns: 1, spend: 12000, budget: 40000, pacing: 96.4, alerts: 1 },
  clients: [{
    client: "McMaster-Carr", dataThrough: "2026-11-02",
    campaigns: [{ name: "McMaster Q3 2026 - Zeta", status: "live", flight: "2026-07-06 to 2026-12-31", budget: 40000, spend: 12000, pacing: 96.4, kpi: "0.12% CTR", goal: "0.10%", goalStatus: "on" }],
    alerts: [{ severity: "warning", title: "Under pacing", line: "NY", detail: "Pacing at 82%" }],
    todos: [{ text: "Send the October recap", due: "2026-11-05", urgent: true }],
    status: [{ name: "McMaster Q3 2026 - Zeta", track: "On Track", performance: "CTR 0.12% vs 0.10% goal | Chicago leads", notes: "", cadence: "Weekly", reportName: "McMaster weekly" }],
    billing: [{ month: "2026-10", label: "October 2026", status: "Ready", total: 75917.98, billedOnFile: null, rows: [{ lineItem: "Display", period: "2026-10-01 to 2026-10-31", source: "DCM", rateType: "cpm", rate: 5, quantity: 15183596, billable: 75917.98, billed: null, data: "through 2026-10-30", check: "OK", lines: [{ name: "NY", source: "DCM", quantity: 2585930, billable: 12929.65, data: "2026-10-01 to 2026-10-30, 30 days" }] }] }]
  }],
  uploads: [{ at: "Nov 2, 8:34 AM", fileName: "2253817_McMaster.zip", kind: "DCM report", clients: "McMaster-Carr", result: "Imported · 9 lines" }]
};

test("the snapshot summary covers every client's campaigns, alerts, to-dos, status rows, billing, and recent files", () => {
  const text = buildSnapshotMarkdown(data);
  assert.match(text, /Written Nov 4, 2026, 9:00 AM/);
  assert.match(text, /Overall pacing: 96%/);
  assert.match(text, /## McMaster-Carr/);
  assert.match(text, /\| McMaster Q3 2026 - Zeta \| live \| 2026-07-06 to 2026-12-31 \| \$40,000\.00 \| \$12,000\.00 \| 96% \| 0\.12% CTR \| 0\.10% \| on \|/);
  assert.match(text, /- Under pacing \(NY\)\. Pacing at 82%/);
  assert.match(text, /Send the October recap \(due 2026-11-05\) · urgent/);
  // Pipes in a cell can't break the table.
  assert.match(text, /CTR 0\.12% vs 0\.10% goal \/ Chicago leads/);
  assert.match(text, /### Billing · October 2026\nStatus: Ready\. Total \$75,917\.98\./);
  assert.match(text, /2253817_McMaster\.zip/);
});

test("the line and billing CSVs hold the detail, each billing row followed by its lines", () => {
  const lines = buildLinesCsv([{ client: "McMaster-Carr", campaign: "McMaster Q3 2026 - Zeta", line: "NY", billable_spend: 12929.65, kpi: "CTR" }]);
  assert.match(lines.split("\n")[0], /^client,campaign,line,status,flight_start/);
  assert.match(lines, /McMaster-Carr,McMaster Q3 2026 - Zeta,NY,,,,,12929\.65/);
  const billing = buildBillingCsv(data.clients).trim().split("\n");
  assert.equal(billing.length, 3);
  assert.match(billing[1], /^McMaster-Carr,2026-10,Ready,Display,,/);
  assert.match(billing[2], /^McMaster-Carr,2026-10,Ready,Display,NY,/);
});

test("the guide and prompt point ChatGPT at the folder and the files", () => {
  const guide = buildGuide();
  for (const name of Object.values(SNAPSHOT_FILES)) if (name !== SNAPSHOT_FILES.guide) assert.match(guide, new RegExp(name.replace(".", "\\.")));
  assert.match(guide, /Never invent a number/);
  const prompt = buildChatGptPrompt({ folder: "Morning brief" });
  assert.match(prompt, new RegExp(`"Morning brief" › "${SNAPSHOT_FOLDER}"`));
  assert.match(prompt, /READ ME FIRST\.md/);
});
