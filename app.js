import { escapeHtml, validateCampaignCsv } from "./lib/importer.js";
import { addImportRecord, createImportRecord, exportImportHistoryCsv, fingerprintBytes, hasSuccessfulFingerprint, readImportHistory, writeImportHistory } from "./lib/import-history.js";
import { discrepancyStatus, resolveSpend } from "./lib/source-comparison.js";
import { applyCampaignSettings } from "./lib/campaign-settings.js";
import { budgetRevisionHistory, createBudgetRevision, exportBudgetRevisionsCsv, latestBudgetRevision } from "./lib/budget-revisions.js";
import { DEFAULT_ALERT_RULES, evaluateCampaignAlerts, validateAlertRules } from "./lib/alert-engine.js";
import { createCampaign } from "./lib/campaign-creation.js";
import { readColumnPreferences, writeColumnPreferences } from "./lib/column-preferences.js";
import { readReportFile, rowsToCsv } from "./lib/workbook-import.js";
import { evaluateDataHealth } from "./lib/data-health.js";
import { calculatePortfolioPacing, calculateSpendPacing, campaignFlightStatus, effectivePacing } from "./lib/spend-pacing.js";
import { calculateAvailableKpis } from "./lib/metric-calculations.js";
import { dashboardFlightStatus, filterCampaigns } from "./lib/campaign-filters.js";
import { acknowledgeAlert, readAcknowledgedAlerts, removeAcknowledgment, unacknowledgedAlerts, writeAcknowledgedAlerts } from "./lib/alert-acknowledgments.js";
import { exportCampaignsCsv } from "./lib/dashboard-export.js";
import { campaignSnapshotHistory, compareLatestSnapshots, exportPerformanceSnapshotsCsv, periodMetrics, periodSpend } from "./lib/performance-snapshots.js";
import { exportLineItemFlightsCsv, importLineItemFlightsCsv, removeLineItemFlight, saveLineItemFlight, summarizeLineItemBudgets } from "./lib/line-item-flights.js";
import { sortCampaigns } from "./lib/campaign-sort.js";
import { filterCampaignsByAttention } from "./lib/campaign-attention.js";
import { DEFAULT_DASHBOARD_VIEW, readDashboardView, writeDashboardView } from "./lib/dashboard-view.js";
import { aggregateKpiView, resolveKpiView } from "./lib/kpi-view.js";
import { buildPortfolioSpendTrend, exportPortfolioSpendTrendCsv } from "./lib/portfolio-trend.js";
import { exportAlertsCsv } from "./lib/alert-export.js";
import { exportValidationIssuesCsv } from "./lib/validation-export.js";
import { isCampaignArchived, setCampaignArchived } from "./lib/campaign-archive.js";
import { createWorkspaceBackup, restoreWorkspaceBackup, validateWorkspaceBackup } from "./lib/workspace-backup.js";
import { previewCampaignImport } from "./lib/import-preview.js";
import { applyImportRollback, clearImportRollback, createImportRollback, createRemovalUndo, readImportRollback, readUndoStack, undoLabel, writeImportRollback } from "./lib/import-rollback.js";
import { removeDailySource, removeGroupRecords, removeLineItem, removeRecordAt, removeSnapshot } from "./lib/campaign-removal.js";
import { buildMappingReview, exportMappingReviewCsv } from "./lib/mapping-review.js";
import { filterImportAudit, summarizeImportAudit } from "./lib/import-audit.js";
import { readSavedViews, removeNamedView, saveNamedView, writeSavedViews } from "./lib/saved-views.js";
import { resetWorkspaceStorage } from "./lib/workspace-reset.js";
import { applyDailyDelivery, exportDailyDeliveryCsv } from "./lib/daily-delivery-import.js";
import { buildClientRollup } from "./lib/client-rollup.js";
import { applyLineItems } from "./lib/line-item-import.js";
import { readIoPdf } from "./lib/io-reader.js";
import { budgetUnits, readCampaignTotals, removeCampaignTotals, removeOrderFromTotals, setCampaignTotals, unitsBudget, unitsPacing, writeCampaignTotals } from "./lib/campaign-totals.js";
import { campaignPlacements, matchLinesToPlacements } from "./lib/line-flights.js";
import { auditLine } from "./lib/line-audit.js";
import { campaignGroupName, groupKey } from "./lib/campaign-groups.js";
import { dailyPacingView } from "./lib/daily-pacing.js";
import { applyBulkEdits, lineKey, validateBulkEdits } from "./lib/bulk-edit.js";
import { findCampaignForIo } from "./lib/io-match.js";
import { pacingBand } from "./lib/client-rollup.js";
import { applyAssignments, assignmentKey, initialChoices, KEEP, lineLabel, readAssignments, rememberAssignments, SKIP } from "./lib/import-assignment.js";
import { applySetupEdits, rowsForCreatedGroup, setupFieldsFromRow, validateSetupEdits } from "./lib/new-campaign-setup.js";
import { mergeCampaignImports } from "./lib/import-merge.js";
import { applyIoToCampaign, campaignFieldsFromIo } from "./lib/io-apply.js";
import { computeMetrics, formatMetric, MAX_ROW_METRICS, METRIC_CATALOG, metricLabel } from "./lib/metric-catalog.js";
import { groupCampaigns } from "./lib/campaign-groups.js";
import { metricsForCampaign, readMetricPrefs, reorderMetrics, resetCampaignMetrics, setCampaignMetrics, writeMetricPrefs } from "./lib/campaign-metric-prefs.js";
import { addLedgerEntries, clearFolderHandle, folderSyncSupported, isProcessed, ledgerKey, listReportFiles, loadFolderHandle, planAutoImport, readLedger, resolveFileHandle, reviewItems, saveFolderHandle, SYNC_INTERVAL_MS, writeLedger } from "./lib/folder-sync.js";

const sampleCampaigns = [
  { client: "Apex Athletics", owner: "Jordan Davis", channel: "Display", short: "AA", className: "apex", name: "Always On · Retargeting", spend: 184200, firstPartySpend: 184200, thirdPartySpend: 179600, billingSource: "1st party", budget: 240000, pacing: 112, kpi: "CPA", value: "$48.20", target: "Target $36.50", source: "1st party", updated: "8 min ago" },
  { client: "Apex Athletics", owner: "Jordan Davis", channel: "Video", short: "AA", className: "apex", name: "Fall Video · Prospecting", spend: 221400, firstPartySpend: 216800, thirdPartySpend: 221400, billingSource: "CM360", budget: 380000, pacing: 101, kpi: "VCR", value: "74.8%", target: "Target 70%", source: "CM360", updated: "8 min ago" },
  { client: "Lumon Home", owner: "Morgan Lee", channel: "Display", short: "LH", className: "lumon", name: "Fall Product Launch", spend: 146800, firstPartySpend: 128500, thirdPartySpend: 146800, billingSource: "CM360", budget: 280000, pacing: 79, kpi: "ROAS", value: "4.2×", target: "Target 3.5×", source: "CM360", updated: "1 hr ago" },
  { client: "Nova Finance", owner: "Taylor Kim", channel: "Display", short: "NF", className: "nova", name: "Q3 Brand Awareness", spend: 131800, firstPartySpend: 131800, thirdPartySpend: 113100, billingSource: "1st party", budget: 340000, pacing: 96, kpi: "CTR", value: "0.82%", target: "Target 0.75%", source: "1st party", updated: "24 min ago" }
];

let campaigns = loadCampaigns();
let importHistory = readImportHistory(localStorage);
let selectedSource = "billing";
let clientScope = new URLSearchParams(location.search).get("client");
let alertRules = loadAlertRules();
let visibleColumns = readColumnPreferences(localStorage);
let acknowledgedAlertIds = readAcknowledgedAlerts(localStorage);
let activeAlertId = null;
let dashboardView = readDashboardView(localStorage);
let currentSpendTrend = [];
let currentVisibleAlerts = [];
let currentValidationIssues = [];
let pendingWorkspaceBackup = null;
let pendingValidatedImport = null;
let selectedFile = null;
let savedViews = readSavedViews(localStorage);

function loadCampaigns() {
  try {
    const stored = JSON.parse(localStorage.getItem("northstar-campaigns"));
    return Array.isArray(stored) && stored.length ? stored : sampleCampaigns;
  } catch {
    return sampleCampaigns;
  }
}

function loadAlertRules() {
  try {
    const rules = { ...DEFAULT_ALERT_RULES, ...(JSON.parse(localStorage.getItem("northstar-alert-rules")) || {}) };
    return validateAlertRules(rules).valid ? rules : { ...DEFAULT_ALERT_RULES };
  } catch {
    return { ...DEFAULT_ALERT_RULES };
  }
}

const formatMoney = value => value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(2)}M` : `$${(value / 1000).toFixed(1)}K`;
const formatExactMoney = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
const hasBudget = campaign => Number.isFinite(campaign.budget) && campaign.budget > 0;
const BUDGET_HINTS = {
  manual: "Type the approved amount. Reports will not overwrite it.",
  io: "Attach the IO and enter its total. Reports will not overwrite it.",
  report: "Optional. Leave blank to take the budget from the first report that includes one."
};

function syncBudgetSourceFields() {
  const source = document.querySelector("#new-campaign-budget-source").value;
  document.querySelector("#new-campaign-budget-hint").textContent = BUDGET_HINTS[source];
  document.querySelector("#new-campaign-budget").required = source !== "report";
  document.querySelector("#new-campaign-io").required = source === "io";
  document.querySelector("#new-campaign-io-label").firstChild.textContent = source === "io" ? "Approved insertion order (required)" : "Insertion order (optional)";
}
document.querySelector("#new-campaign-budget-source").addEventListener("change", syncBudgetSourceFields);
syncBudgetSourceFields();

// Pacing numbers take their colour from the same thresholds the alerts use: red over, amber under, green on track.
const paceClass = pacing => Number.isFinite(pacing) ? `pace-${pacingBand(pacing, alertRules)}` : "";
const formatCount = value => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

function renderCampaigns(filter = "all", statusFilter = document.querySelector("#status-filter")?.value || "all", ownerFilter = document.querySelector("#owner-filter")?.value || "all", channelFilter = document.querySelector("#channel-filter")?.value || "all", query = document.querySelector("#campaign-search")?.value || "") {
  // The client account view ignores the saved client filter and always shows that client only.
  if (clientScope && !campaigns.some(campaign => campaign.client === clientScope)) { clientScope = null; history.replaceState({}, "", location.pathname); }
  filter = clientScope ?? filter;
  const matchingRows = filterCampaigns(campaigns, { client: filter, status: statusFilter, owner: ownerFilter, channel: channelFilter, query });
  const activeAlerts = unacknowledgedAlerts(evaluateAlerts(matchingRows), acknowledgedAlertIds);
  const filteredRows = filterCampaignsByAttention(matchingRows, activeAlerts, document.querySelector("#attention-filter")?.value);
  const rows = sortCampaigns(filteredRows, { mode: document.querySelector("#campaign-sort")?.value, spendView: selectedSource });
  const period = document.querySelector("#period-filter")?.value || "current";
  document.querySelector("#campaign-rows").innerHTML = rows.map(campaign => {
    const discrepancy = discrepancyStatus(campaign);
    const pacing = effectivePacing({ ...campaign, spend: resolveSpend(campaign, "billing") });
    const pacingLabel = pacing === null ? "—" : Number(pacing.toFixed(1));
    const pacingStatus = pacing === null ? "Not started" : pacing > 105 ? "High" : pacing < 85 ? "Low" : "On track";
    const pacingWarning = pacing !== null && (pacing < 85 || pacing > 105);
    const status = dashboardFlightStatus(campaign);
    const statusLabel = { live: "Live", scheduled: "Scheduled", completed: "Completed", archived: "Archived" }[status];
    const campaignIndex = campaigns.indexOf(campaign);
    const selectedPeriodSpend = period === "current" ? resolveSpend(campaign, selectedSource) : periodSpend(campaign, period);
    const selectedKpi = resolveKpiView(campaign, document.querySelector("#kpi-view")?.value, period === "current" ? campaign : periodMetrics(campaign, period));
    return `
    <tr>
      <td><button class="campaign-name campaign-detail-button" data-campaign-index="${campaignIndex}"><span class="client-mark ${campaign.className}">${escapeHtml(campaign.short)}</span><span><strong>${escapeHtml(campaign.name)}</strong><small>${escapeHtml(campaign.client)}</small></span></button></td>
      <td data-column="status"><span class="status-${status}">${statusLabel}</span></td>
      <td data-column="spend"><strong>${selectedPeriodSpend === null ? "—" : formatMoney(selectedPeriodSpend)}</strong></td>
      <td data-column="budget">${hasBudget(campaign) ? formatMoney(campaign.budget) : '<span class="warning-text">Needed</span>'}</td>
      <td data-column="pacing" class="pacing-cell"><div class="pacing-value"><strong class="${paceClass(pacing)}">${pacingLabel}${pacing === null ? "" : "%"}</strong><span class="${paceClass(pacing)}">${pacingStatus}</span></div><div class="mini-track ${pacingWarning ? "warn" : ""}"><span style="width:${Math.min(pacing || 0, 100)}%"></span></div></td>
      <td data-column="kpi" class="kpi"><strong>${escapeHtml(selectedKpi?.formatted || "—")} ${escapeHtml(selectedKpi?.metric || document.querySelector("#kpi-view")?.value || campaign.kpi)}</strong><small>${escapeHtml(selectedKpi?.target || (period === "current" ? "Required components unavailable" : "Period components unavailable"))}</small></td>
      <td data-column="source"><span class="source-tag ${campaign.source === "CM360" ? "third" : ""}">${escapeHtml((campaign.sources || [campaign.source]).join(" + "))}</span>${discrepancy.flagged ? `<small class="variance-flag">! ${discrepancy.label}</small>` : ""}</td>
      <td data-column="updated">${escapeHtml(campaign.updated)}</td>
      <td><button class="row-button" aria-label="Options for ${escapeHtml(campaign.name)}">•••</button></td>
    </tr>`;
  }).join("");
  const activeRows = rows.filter(campaign => dashboardFlightStatus(campaign) === "live");
  const selectedKpiView = document.querySelector("#kpi-view")?.value || "primary";
  const portfolioKpi = aggregateKpiView(activeRows, selectedKpiView);
  document.querySelector("#campaign-kpi-heading").textContent = selectedKpiView === "primary" ? "Primary KPI" : selectedKpiView;
  document.querySelector("#portfolio-kpi-label").textContent = portfolioKpi.metric;
  document.querySelector("#portfolio-kpi-value").textContent = portfolioKpi.formatted;
  document.querySelector("#portfolio-kpi-coverage").textContent = `${portfolioKpi.coverage}/${portfolioKpi.total} with data`;
  renderSpendChart(activeRows);
  document.querySelector("#campaign-count").textContent = `Showing ${rows.length} campaign${rows.length === 1 ? "" : "s"} · ${activeRows.length} live`;
  const activeUnits = budgetUnits(activeRows, campaignTotals);
  const budget = unitsBudget(activeUnits);
  const comparablePeriodRows = period === "current" ? activeRows : activeRows.filter(item => periodSpend(item, period) !== null);
  const spend = period === "current" ? activeRows.reduce((sum, item) => sum + resolveSpend(item, selectedSource), 0) : comparablePeriodRows.reduce((sum, item) => sum + periodSpend(item, period), 0);
  document.querySelector("#budget-value").textContent = formatMoney(budget);
  document.querySelector("#spend-value").textContent = formatMoney(spend);
  document.querySelector("#spend-metric-label").textContent = period === "current" ? "Spend to date" : `Spend · last ${period} days`;
  const utilization = spend / budget * 100 || 0;
  document.querySelector("#spend-progress").style.width = period === "current" ? `${Math.min(utilization, 100)}%` : "0%";
  document.querySelector("#utilization-value").textContent = period === "current" ? `${utilization.toFixed(1)}% utilized` : `${comparablePeriodRows.length} campaign${comparablePeriodRows.length === 1 ? "" : "s"} with history`;
  document.querySelector("#remaining-value").textContent = period === "current" ? `${formatMoney(Math.max(budget - spend, 0))} remaining` : "Reported-source change";
  const portfolio = { pacing: unitsPacing(activeUnits) };
  const portfolioValue = document.querySelector("#portfolio-pacing-value");
  const portfolioStatus = document.querySelector("#portfolio-pacing-status");
  portfolioValue.textContent = portfolio.pacing === null ? "—" : `${portfolio.pacing.toFixed(1)}%`;
  portfolioValue.classList.remove("pace-over", "pace-under", "pace-on-track");
  if (paceClass(portfolio.pacing)) portfolioValue.classList.add(paceClass(portfolio.pacing));
  portfolioStatus.textContent = portfolio.pacing === null ? "No pacing data" : portfolio.pacing > alertRules.overPacing ? "Above plan" : portfolio.pacing < alertRules.underPacing ? "Below plan" : "On track";
  portfolioStatus.className = `status-pill ${portfolio.pacing !== null && (portfolio.pacing > alertRules.overPacing || portfolio.pacing < alertRules.underPacing) ? "warning" : "good"}`;
  document.querySelector("#portfolio-pacing-target").textContent = `Target: ${alertRules.underPacing}–${alertRules.overPacing}%`;
  applyColumnVisibility();
  renderAlerts(rows);
  const portfolioRows = filterCampaigns(campaigns, { client: "all", status: statusFilter, owner: ownerFilter, channel: channelFilter, query });
  renderClientRollup(portfolioRows, unacknowledgedAlerts(evaluateAlerts(portfolioRows), acknowledgedAlertIds), filter);
  renderCampaignList(matchingRows, activeAlerts);
  applyClientScopeChrome();
  renderClientNav();
}

function renderClientRollup(rows, activeAlerts, selectedClient) {
  const period = document.querySelector("#period-filter")?.value || "current";
  const kpiView = document.querySelector("#kpi-view")?.value || "primary";
  const rollup = buildClientRollup(rows, { spendView: selectedSource, period, kpiView, alerts: activeAlerts, rules: alertRules, totals: campaignTotals });
  const grid = document.querySelector("#client-grid");
  document.querySelector("#client-rollup-context").textContent = rollup.length ? `${rollup.length} client${rollup.length === 1 ? "" : "s"} with live campaigns · select one to open its account` : "No clients have live campaigns for the current filters";
  const bandLabel = { over: "Above plan", under: "Below plan", "on-track": "On track", unknown: "No pacing" };
  grid.innerHTML = rollup.map(client => `<button type="button" class="client-card" data-client="${escapeHtml(client.client)}" aria-pressed="${client.client === selectedClient}">
    <div class="client-card-head"><span class="client-mark ${escapeHtml(client.className || "")}">${escapeHtml(client.short || "")}</span><span><strong>${escapeHtml(client.client)}</strong><small>${client.liveCount} live campaign${client.liveCount === 1 ? "" : "s"}${client.latestDataAsOf ? ` · data through ${escapeHtml(client.latestDataAsOf)}` : ""}</small></span><span class="status-pill ${client.pacingBand === "on-track" ? "good" : client.pacingBand === "unknown" ? "" : "warning"}">${bandLabel[client.pacingBand]}${client.pacing === null ? "" : ` · ${client.pacing.toFixed(0)}%`}</span></div>
    <div class="client-spend"><strong>${period !== "current" && client.spendCoverage === 0 ? "—" : formatMoney(client.spend)}</strong><span>${period === "current" ? (client.budget > 0 ? `of ${formatMoney(client.budget)} budget` : "budget needed") : `last ${period} days`}</span></div>
    ${client.utilization === null ? "" : `<div class="progress-track"><span style="width:${Math.min(client.utilization, 100)}%"></span></div>`}
    <div class="client-kpi-row"><span>${escapeHtml(client.kpi.metric)} <strong>${escapeHtml(client.kpi.formatted)}</strong></span><span class="${client.criticalCount ? "warning-text" : ""}">${client.alertCount ? `${client.alertCount} alert${client.alertCount === 1 ? "" : "s"}` : "No alerts"}</span></div>
    <ul class="client-campaigns">${client.campaigns.slice(0, 4).map(campaign => `<li><span>${escapeHtml(campaign.name)}</span><span class="${campaign.pacingBand}">${campaign.pacing === null ? "—" : `${campaign.pacing.toFixed(0)}%`}${campaign.kpi ? ` · ${escapeHtml(campaign.kpi)}` : ""}</span></li>`).join("")}${client.campaigns.length > 4 ? `<li><span>+${client.campaigns.length - 4} more</span><span></span></li>` : ""}</ul>
  </button>`).join("");
}

document.querySelector("#client-grid").addEventListener("click", event => {
  const card = event.target.closest(".client-card");
  if (!card) return;
  setClientScope(card.dataset.client);
});

// --- Client account view: ?client=Name shows only that client's campaigns, independent of the saved filters ---
function setClientScope(name, { replace = false } = {}) {
  clientScope = name || null;
  const url = clientScope ? `?client=${encodeURIComponent(clientScope)}` : location.pathname;
  if (replace) history.replaceState({ client: clientScope }, "", url); else history.pushState({ client: clientScope }, "", url);
  renderCampaigns();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function applyClientScopeChrome() {
  const scoped = Boolean(clientScope);
  document.body.classList.toggle("client-view", scoped);
  document.querySelector("#clients").hidden = scoped;
  document.querySelector("#client-filter").closest(".filter-group").hidden = scoped;
  document.querySelector("#client-back").hidden = !scoped;
  const eyebrow = document.querySelector("#page-eyebrow");
  const heading = document.querySelector("#greeting");
  const subtitle = document.querySelector("#page-subtitle");
  if (!scoped) {
    eyebrow.textContent = "PERFORMANCE CENTER";
    subtitle.textContent = "Here’s how your campaigns are tracking today.";
    renderProfile();
    document.title = "Northstar | Campaign overview";
    return;
  }
  const rows = campaigns.filter(campaign => campaign.client === clientScope && !isCampaignArchived(campaign));
  const groups = groupCampaigns(rows);
  const live = groups.filter(group => group.status === "live").length;
  eyebrow.textContent = "CLIENT ACCOUNT";
  heading.textContent = clientScope;
  subtitle.textContent = `${groups.length} campaign${groups.length === 1 ? "" : "s"} · ${live} live · only ${clientScope} data is shown below.`;
  document.title = `Northstar | ${clientScope}`;
}

function renderClientNav() {
  const clients = [...new Map(campaigns.filter(campaign => !isCampaignArchived(campaign)).map(campaign => [campaign.client, campaign])).values()].sort((a, b) => a.client.localeCompare(b.client));
  document.querySelector("#client-nav-label").hidden = clients.length === 0;
  document.querySelector("#client-nav").innerHTML = clients.map(campaign => `<a class="nav-item client-nav-item${campaign.client === clientScope ? " active" : ""}" href="?client=${encodeURIComponent(campaign.client)}" data-client-link="${escapeHtml(campaign.client)}"${campaign.client === clientScope ? ' aria-current="page"' : ""}><span class="client-nav-mark ${escapeHtml(campaign.className || "")}">${escapeHtml(campaign.short || "")}</span><span class="client-nav-name">${escapeHtml(campaign.client)}</span></a>`).join("");
  const overview = document.querySelector("#nav-overview");
  overview.classList.toggle("active", !clientScope);
  if (clientScope) overview.removeAttribute("aria-current"); else overview.setAttribute("aria-current", "page");
}

document.querySelector(".sidebar").addEventListener("click", event => {
  const link = event.target.closest("[data-client-link]");
  if (link) { event.preventDefault(); setClientScope(link.dataset.clientLink); document.querySelector(".sidebar").classList.remove("open"); return; }
  if (event.target.closest("#nav-overview") && clientScope) { event.preventDefault(); setClientScope(null); }
});
document.querySelector("#client-back").addEventListener("click", event => { event.preventDefault(); setClientScope(null); });
window.addEventListener("popstate", () => {
  clientScope = new URLSearchParams(location.search).get("client");
  renderCampaigns();
});



function renderProfile() {
  let name = "";
  try { name = localStorage.getItem("northstar-profile-name") || ""; } catch { name = ""; }
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  document.querySelector("#greeting").textContent = name ? `${greeting}, ${name.split(/\s+/)[0]}` : greeting;
  document.querySelector("#profile-name").textContent = name || "Your name";
  document.querySelector("#profile-avatar").textContent = name ? name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() : "?";
}

document.querySelector("#edit-profile").addEventListener("click", () => {
  const current = localStorage.getItem("northstar-profile-name") || "";
  const next = window.prompt("Display name for the dashboard greeting", current);
  if (next === null) return;
  if (next.trim()) localStorage.setItem("northstar-profile-name", next.trim().slice(0, 60));
  else localStorage.removeItem("northstar-profile-name");
  renderProfile();
});
renderProfile();

// --- Campaign list: one expandable row per campaign with per-campaign metrics ---
let metricPrefs = readMetricPrefs(localStorage);
let auditMode = false;
try { auditMode = localStorage.getItem("northstar-audit-mode") === "on"; } catch { auditMode = false; }
let campaignTotals = readCampaignTotals(localStorage);
const evaluateAlerts = rows => evaluateCampaignAlerts(rows, alertRules, new Date(), { totals: campaignTotals });
const expandedCampaigns = new Set();
let lastCampaignGroups = [];
let metricPickerTarget = null;

function lineStatusLabel(status) {
  return { live: "Live", scheduled: "Scheduled", completed: "Completed", archived: "Archived" }[status] || "";
}

function renderCampaignList(rows, activeAlerts) {
  const period = document.querySelector("#period-filter")?.value || "current";
  const groups = groupCampaigns(rows);
  lastCampaignGroups = groups;
  const container = document.querySelector("#campaign-list-rows");
  const lineCount = groups.reduce((sum, group) => sum + group.lines.length, 0);
  document.querySelector("#campaign-list-context").textContent = groups.length ? `${groups.length} campaign${groups.length === 1 ? "" : "s"} · ${lineCount} line${lineCount === 1 ? "" : "s"} · select a row for line-item performance` : "No campaigns match the current filters";
  document.querySelector("#toggle-all-campaigns").hidden = groups.length === 0;
  syncAuditButton();
  document.querySelector("#toggle-all-campaigns").textContent = groups.length && groups.every(group => expandedCampaigns.has(group.key)) ? "Collapse all" : "Expand all";
  const options = { spendView: selectedSource, period };
  container.innerHTML = groups.map(group => {
    const keys = metricsForCampaign(metricPrefs, group.key);
    const open = expandedCampaigns.has(group.key);
    const totals = computeMetrics(group.records, { ...options, totals: campaignTotals[group.key] || null });
    const groupAlerts = activeAlerts.filter(alert => group.records.includes(alert.campaign));
    const critical = groupAlerts.some(alert => alert.severity === "critical");
    const cells = keys.map(key => `<span class="metric-cell" draggable="true" data-metric="${key}" title="Drag to reorder"><small>${escapeHtml(metricLabel(key))}</small><strong class="${key === "pacing" ? paceClass(totals.pacing) : ""}">${escapeHtml(formatMetric(key, totals[key]))}</strong></span>`).join("");
    const labels = keys.map(key => `<span>${escapeHtml(metricLabel(key))}</span>`).join("");
    // Report lines named "Flight N" take their dates from the matching placement of the campaign's insertion orders.
    const placementMatches = matchLinesToPlacements(group.lines, campaignPlacements(campaignTotals[group.key]));
    const auditOptions = line => ({ placement: placementMatches.get(line) || null, order: placementMatches.get(line)?.order || null });
    const lineRows = group.lines.map(line => {
      // A planned flight with no imported delivery has a budget only; showing zero spend or pacing would mislead.
      const lineMetrics = line.kind === "flight" ? { budget: line.budget } : computeMetrics(line.kind === "record" ? line.record : line, { ...options, period: line.kind === "record" ? period : "current" });
      const index = campaigns.indexOf(line.record);
      const placement = placementMatches.get(line) || null;
      const shownStart = line.startDate || placement?.startDate || null;
      const shownEnd = line.endDate || placement?.endDate || null;
      const fromIo = !line.startDate && Boolean(placement);
      const dates = shownStart && shownEnd ? `${escapeHtml(shownStart)} → ${escapeHtml(shownEnd)}${fromIo ? " · from IO" : ""}` : "";
      const lineStatus = line.kind === "record" ? dashboardFlightStatus({ ...line.record, startDate: shownStart || line.record.startDate, endDate: shownEnd || line.record.endDate }) : null;
      const meta = [dates, line.rate ? `${escapeHtml(line.rateType || "CPM")} $${Number(line.rate).toFixed(2)}` : ""].filter(Boolean).join(" · ");
      const lineSelectKey = stableLineKey(line);
      const lineChecked = selectionFor(group.key).has(lineSelectKey);
      return `<div class="campaign-line${lineChecked ? " selected" : ""}"><label class="line-check"><input type="checkbox" data-select-line="${escapeHtml(lineSelectKey)}" data-group="${escapeHtml(group.key)}" aria-label="Select ${escapeHtml(line.name || "line")}"${lineChecked ? " checked" : ""} /></label><span class="campaign-line-status">${line.kind === "record" ? `<span class="status-dot-label ${lineStatus}">${lineStatusLabel(lineStatus)}</span>` : ""}</span><span class="campaign-title"><strong>${escapeHtml(line.name || "Line item")}</strong><small>${meta || "&nbsp;"}</small></span>${keys.map(key => `<span class="metric-cell"><strong class="${key === "pacing" ? paceClass(lineMetrics.pacing) : ""}">${escapeHtml(formatMetric(key, lineMetrics[key]))}</strong></span>`).join("")}<span class="campaign-line-actions"><button class="campaign-line-open" type="button" data-open-campaign="${index}">Details</button><button class="campaign-line-remove" type="button" data-remove-line="${index}" data-line-kind="${line.kind === "record" ? "record" : "item"}" data-line-id="${escapeHtml(String(line.id ?? ""))}" data-line-name="${escapeHtml(line.name || "this line")}" aria-label="Remove ${escapeHtml(line.name || "line")}" title="Remove">✕</button></span></div>${auditMode ? renderLineAudit(auditLine(line, auditOptions(line))) : ""}`;
    }).join("");
    const auditSummary = !auditMode ? "" : (() => {
      const gaps = group.lines.filter(line => auditLine(line, auditOptions(line)).missing.some(label => ["Spend", "Budget", "Impressions", "Clicks", "CTR"].includes(label))).length;
      return gaps ? ` · ${gaps} line${gaps === 1 ? "" : "s"} missing data` : " · all lines complete";
    })();
    return `<article class="campaign-card${open ? " open" : ""}" data-group-key="${escapeHtml(group.key)}" style="--metric-count:${keys.length}">
      <div class="campaign-card-head" data-toggle-campaign="${escapeHtml(group.key)}">
        <button class="campaign-toggle" type="button" aria-expanded="${open}" aria-label="${open ? "Collapse" : "Expand"} ${escapeHtml(group.name)}">›</button>
        <span class="status-dot-label ${group.status}">${lineStatusLabel(group.status)}</span>
        <span class="campaign-title"><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(group.client)}${group.startDate && group.endDate ? ` · ${escapeHtml(group.startDate)} → ${escapeHtml(group.endDate)}` : ""} · ${group.lines.length} line${group.lines.length === 1 ? "" : "s"}${campaignTotals[group.key] ? ` · budget from ${campaignTotals[group.key].orders.length > 1 ? `${campaignTotals[group.key].orders.length} IOs` : "IO"}` : ""}${auditSummary}</small></span>
        ${cells}
        <span class="campaign-card-actions">${groupAlerts.length ? `<span class="campaign-alert-badge${critical ? " critical" : ""}" title="${groupAlerts.length} open alert${groupAlerts.length === 1 ? "" : "s"}">${groupAlerts.length}</span>` : ""}<button class="campaign-icon-button" type="button" data-edit-metrics="${escapeHtml(group.key)}" aria-label="Choose metrics for ${escapeHtml(group.name)}" title="Choose metrics">⚙</button></span>
      </div>
      ${open ? `<div class="campaign-lines">${selectionFor(group.key).size ? `<div class="campaign-lines-bulk"><strong>${resolveSelection(group.key).length} selected</strong><button type="button" data-bulk-edit="${escapeHtml(group.key)}">Edit selected…</button><button type="button" class="danger" data-bulk-remove="${escapeHtml(group.key)}">Remove selected</button><button type="button" data-bulk-clear="${escapeHtml(group.key)}">Clear</button></div>` : ""}<div class="campaign-lines-labels"><label class="line-check"><input type="checkbox" data-select-all-lines="${escapeHtml(group.key)}" aria-label="Select all lines"${group.lines.length && group.lines.every(line => selectionFor(group.key).has(stableLineKey(line))) ? " checked" : ""} /></label><span></span><span>Line item</span>${labels}<span></span></div>${lineRows}<div class="campaign-lines-footer"><button class="campaign-remove" type="button" data-remove-campaign="${escapeHtml(group.key)}">Remove campaign…</button></div></div>` : ""}
    </article>`;
  }).join("");
}

// --- Audit view: what each line carries and where it came from ---
const AUDIT_MONEY = new Set(["Spend", "1st-party spend", "3rd-party spend", "Budget", "Revenue"]);
function renderLineAudit(audit) {
  const display = item => item.state === "missing" ? "missing" : item.value === null || item.value === undefined ? "—" : typeof item.value === "number" ? (AUDIT_MONEY.has(item.label) ? formatExactMoney(item.value) : formatCount(item.value)) : item.value;
  return `<div class="campaign-line-audit"><p class="audit-source">${escapeHtml(audit.source)}${audit.dataThrough ? ` · data through ${escapeHtml(audit.dataThrough)}` : ""}${audit.system ? ` · ${escapeHtml(audit.system)}` : ""}</p><div class="audit-chips">${audit.chips.map(item => `<span class="audit-chip ${item.state}"><small>${escapeHtml(item.label)}</small>${escapeHtml(display(item))}</span>`).join("")}</div>${audit.notes.length ? `<ul class="audit-notes">${audit.notes.map(note => `<li>${escapeHtml(note)}</li>`).join("")}</ul>` : ""}</div>`;
}

function syncAuditButton() {
  const button = document.querySelector("#toggle-audit");
  button.setAttribute("aria-pressed", String(auditMode));
  button.textContent = auditMode ? "Hide audit" : "Audit data";
  button.classList.toggle("active", auditMode);
}
document.querySelector("#toggle-audit").addEventListener("click", () => {
  auditMode = !auditMode;
  try { localStorage.setItem("northstar-audit-mode", auditMode ? "on" : "off"); } catch { /* the toggle still works for this session */ }
  if (auditMode) lastCampaignGroups.forEach(group => expandedCampaigns.add(group.key));
  renderCampaigns(document.querySelector("#client-filter").value);
});

// --- Multi-select on campaign lines: bulk edit and bulk remove ---
// Selections are stored by stable identity (not list position) so an import or removal can never point them at another line.
const selectedLines = new Map();
const recordIdentity = record => [record.client, record.name, record.campaignId, record.source].map(value => String(value ?? "").trim().toLowerCase()).join("::");
const stableLineKey = line => line.kind === "record" ? `r|${recordIdentity(line.record)}` : `i|${recordIdentity(line.record)}|${line.id ?? ""}`;
const selectionFor = key => selectedLines.get(key) || new Set();

/** Selected lines of one campaign, resolved to current positions; anything that no longer exists is dropped. */
function resolveSelection(groupKeyValue) {
  const wanted = selectionFor(groupKeyValue);
  const group = lastCampaignGroups.find(item => item.key === groupKeyValue);
  if (!group) return [];
  return group.lines.filter(line => wanted.has(stableLineKey(line))).map(line => ({ line, index: campaigns.indexOf(line.record), key: lineKey(campaigns.indexOf(line.record), line.kind, line.id) })).filter(entry => entry.index >= 0);
}

function setLineSelected(groupKeyValue, key, selected) {
  const set = new Set(selectionFor(groupKeyValue));
  if (selected) set.add(key); else set.delete(key);
  if (set.size) selectedLines.set(groupKeyValue, set); else selectedLines.delete(groupKeyValue);
}

document.querySelector("#campaign-list-rows").addEventListener("change", event => {
  const box = event.target.closest("[data-select-line]");
  const all = event.target.closest("[data-select-all-lines]");
  if (box) setLineSelected(box.dataset.group, box.dataset.selectLine, box.checked);
  else if (all) {
    const group = lastCampaignGroups.find(item => item.key === all.dataset.selectAllLines);
    group?.lines.forEach(line => setLineSelected(group.key, stableLineKey(line), all.checked));
  } else return;
  renderCampaigns(document.querySelector("#client-filter").value);
});

document.querySelector("#campaign-list-rows").addEventListener("click", event => {
  const clear = event.target.closest("[data-bulk-clear]");
  if (clear) { selectedLines.delete(clear.dataset.bulkClear); renderCampaigns(document.querySelector("#client-filter").value); return; }
  const remove = event.target.closest("[data-bulk-remove]");
  if (remove) { bulkRemove(remove.dataset.bulkRemove); return; }
  const edit = event.target.closest("[data-bulk-edit]");
  if (edit) openBulkEdit(edit.dataset.bulkEdit);
});

const describeSelection = entries => {
  const lines = entries.filter(entry => entry.line.kind === "record").length;
  const items = entries.length - lines;
  return [lines ? `${lines} line${lines === 1 ? "" : "s"}` : "", items ? `${items} line item${items === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ");
};

function bulkRemove(groupKeyValue) {
  const entries = resolveSelection(groupKeyValue);
  if (!entries.length) return;
  const summary = describeSelection(entries);
  applyRemoval(`removing ${summary}`, `Remove ${summary} and their imported data from this campaign?`, () => {
    const itemsByIndex = new Map();
    const recordIndexes = [];
    for (const { line, index } of entries) {
      if (line.kind === "record") recordIndexes.push(index);
      else itemsByIndex.set(index, [...(itemsByIndex.get(index) || []), line.id]);
    }
    for (const [index, ids] of itemsByIndex) campaigns[index] = ids.reduce((record, id) => removeLineItem(record, id), campaigns[index]);
    const groups = new Set(recordIndexes.map(index => groupKey(campaigns[index])));
    [...recordIndexes].sort((a, b) => b - a).forEach(index => { campaigns = removeRecordAt(campaigns, index); });
    groups.forEach(dropOrphanTotals);
    selectedLines.delete(groupKeyValue);
  });
}

const bulkEditDialog = document.querySelector("#bulk-edit-dialog");
let bulkEditGroup = null;

function openBulkEdit(groupKeyValue) {
  const entries = resolveSelection(groupKeyValue);
  if (!entries.length) return;
  bulkEditGroup = groupKeyValue;
  const hasRecords = entries.some(entry => entry.line.kind === "record");
  const hasItems = entries.some(entry => entry.line.kind !== "record");
  document.querySelector("#bulk-edit-form").reset();
  document.querySelector("#bulk-edit-summary").textContent = `Editing ${describeSelection(entries)}. Leave a field blank to keep its current value.`;
  document.querySelector("#bulk-edit-lines").hidden = !hasRecords;
  document.querySelector("#bulk-edit-items").hidden = !hasItems;
  document.querySelector("#bulk-edit-error").hidden = true;
  bulkEditDialog.showModal();
}

document.querySelectorAll(".close-bulk-edit").forEach(button => button.addEventListener("click", () => bulkEditDialog.close()));
document.querySelector("#bulk-edit-form").addEventListener("submit", event => {
  event.preventDefault();
  const value = id => document.querySelector(id).value.trim();
  const edits = { owner: value("#bulk-owner"), channel: value("#bulk-channel"), kpi: value("#bulk-kpi"), target: value("#bulk-target"), billingSource: value("#bulk-billing"), reportCadence: value("#bulk-cadence"), startDate: value("#bulk-start"), endDate: value("#bulk-end"), budget: value("#bulk-budget") };
  const errors = validateBulkEdits(edits);
  const error = document.querySelector("#bulk-edit-error");
  if (Object.values(edits).every(field => field === "")) errors.push("Fill in at least one field to change.");
  if (errors.length) { error.textContent = errors.join(" "); error.hidden = false; return; }
  const entries = resolveSelection(bulkEditGroup);
  if (!entries.length) { bulkEditDialog.close(); return; }
  writeImportRollback(localStorage, createRemovalUndo({ campaigns, importHistory, campaignTotals, label: `editing ${describeSelection(entries)}` }));
  campaigns = applyBulkEdits(campaigns, entries.map(entry => entry.key), edits).campaigns;
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  bulkEditDialog.close();
  refreshAfterDataChange();
  showToast("Lines updated", `${describeSelection(entries)} updated. Use Undo to revert.`);
});

// Drag a metric on a campaign row to reorder that campaign's metrics.
let draggedMetric = null;
const campaignListRows = document.querySelector("#campaign-list-rows");
const clearDropMarks = () => campaignListRows.querySelectorAll(".drop-before, .drop-after").forEach(cell => cell.classList.remove("drop-before", "drop-after"));
campaignListRows.addEventListener("dragstart", event => {
  const cell = event.target.closest?.(".metric-cell[data-metric]");
  if (!cell) return;
  draggedMetric = { group: cell.closest("[data-group-key]").dataset.groupKey, metric: cell.dataset.metric };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedMetric.metric);
  cell.classList.add("dragging");
});
campaignListRows.addEventListener("dragover", event => {
  const cell = event.target.closest?.(".metric-cell[data-metric]");
  if (!draggedMetric || !cell || cell.closest("[data-group-key]").dataset.groupKey !== draggedMetric.group || cell.dataset.metric === draggedMetric.metric) return;
  event.preventDefault();
  clearDropMarks();
  const box = cell.getBoundingClientRect();
  cell.classList.add(event.clientX > box.left + box.width / 2 ? "drop-after" : "drop-before");
});
campaignListRows.addEventListener("drop", event => {
  const cell = event.target.closest?.(".metric-cell[data-metric]");
  if (!draggedMetric || !cell || cell.closest("[data-group-key]").dataset.groupKey !== draggedMetric.group) return;
  event.preventDefault();
  const after = cell.classList.contains("drop-after");
  const reordered = reorderMetrics(metricsForCampaign(metricPrefs, draggedMetric.group), draggedMetric.metric, cell.dataset.metric, after);
  metricPrefs = writeMetricPrefs(localStorage, setCampaignMetrics(metricPrefs, draggedMetric.group, reordered));
  draggedMetric = null;
  renderCampaigns(document.querySelector("#client-filter").value);
});
campaignListRows.addEventListener("dragend", () => { draggedMetric = null; clearDropMarks(); campaignListRows.querySelectorAll(".dragging").forEach(cell => cell.classList.remove("dragging")); });

document.querySelector("#campaign-list-rows").addEventListener("click", event => {
  const edit = event.target.closest("[data-edit-metrics]");
  if (edit) { openMetricPicker(edit.dataset.editMetrics); return; }
  const open = event.target.closest("[data-open-campaign]");
  if (open) { openCampaignDialog(Number(open.dataset.openCampaign)); return; }
  const head = event.target.closest("[data-toggle-campaign]");
  if (!head) return;
  const key = head.dataset.toggleCampaign;
  if (expandedCampaigns.has(key)) expandedCampaigns.delete(key); else expandedCampaigns.add(key);
  renderCampaigns(document.querySelector("#client-filter").value);
});

document.querySelector("#toggle-all-campaigns").addEventListener("click", () => {
  const allOpen = lastCampaignGroups.every(group => expandedCampaigns.has(group.key));
  lastCampaignGroups.forEach(group => allOpen ? expandedCampaigns.delete(group.key) : expandedCampaigns.add(group.key));
  renderCampaigns(document.querySelector("#client-filter").value);
});

const metricPickerDialog = document.querySelector("#metric-picker-dialog");

function openMetricPicker(key) {
  metricPickerTarget = key;
  const group = lastCampaignGroups.find(item => item.key === key);
  const selected = new Set(key === null ? metricPrefs.defaults : metricsForCampaign(metricPrefs, key));
  document.querySelector("#metric-picker-title").textContent = key === null ? "Metrics for all campaigns" : "Choose metrics";
  document.querySelector("#metric-picker-subtitle").textContent = key === null ? "Replaces every campaign's metrics and the default for new campaigns." : `${group?.name || "Campaign"} · ${group?.client || ""}`;
  document.querySelector("#metric-picker-reset").hidden = key === null;
  const ordered = [...(key === null ? metricPrefs.defaults : metricsForCampaign(metricPrefs, key)), ...METRIC_CATALOG.map(metric => metric.key).filter(metricKey => !selected.has(metricKey))];
  document.querySelector("#metric-picker-grid").innerHTML = ordered.map(metricKey => `<div class="metric-pick" draggable="true" data-key="${metricKey}"><span class="metric-pick-handle" aria-hidden="true">⋮⋮</span><label><input type="checkbox" name="row-metric" value="${metricKey}"${selected.has(metricKey) ? " checked" : ""} />${escapeHtml(metricLabel(metricKey))}</label><span class="metric-pick-moves"><button type="button" data-move="up" aria-label="Move ${escapeHtml(metricLabel(metricKey))} up">↑</button><button type="button" data-move="down" aria-label="Move ${escapeHtml(metricLabel(metricKey))} down">↓</button></span></div>`).join("");
  updateMetricPickerCount();
  document.querySelector("#metric-picker-error").hidden = true;
  metricPickerDialog.showModal();
}

function updateMetricPickerCount() {
  const count = document.querySelectorAll('input[name="row-metric"]:checked').length;
  document.querySelector("#metric-picker-count").textContent = `${count} of ${MAX_ROW_METRICS} selected · shown in the order listed`;
}

document.querySelector("#metric-picker-grid").addEventListener("click", event => {
  const button = event.target.closest("[data-move]");
  if (!button) return;
  const item = button.closest(".metric-pick");
  const sibling = button.dataset.move === "up" ? item.previousElementSibling : item.nextElementSibling;
  if (!sibling) return;
  if (button.dataset.move === "up") sibling.before(item); else sibling.after(item);
  button.focus();
});
let draggedPick = null;
const metricPickerGrid = document.querySelector("#metric-picker-grid");
metricPickerGrid.addEventListener("dragstart", event => {
  const item = event.target.closest?.(".metric-pick");
  if (!item) return;
  draggedPick = item;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", item.dataset.key);
  item.classList.add("dragging");
});
metricPickerGrid.addEventListener("dragover", event => {
  const target = event.target.closest?.(".metric-pick");
  if (!draggedPick || !target || target === draggedPick) return;
  event.preventDefault();
  const box = target.getBoundingClientRect();
  if (event.clientY > box.top + box.height / 2) target.after(draggedPick); else target.before(draggedPick);
});
metricPickerGrid.addEventListener("dragend", () => { draggedPick?.classList.remove("dragging"); draggedPick = null; });
document.querySelector("#metric-picker-grid").addEventListener("change", event => {
  const checked = document.querySelectorAll('input[name="row-metric"]:checked');
  if (checked.length > MAX_ROW_METRICS) { event.target.checked = false; }
  updateMetricPickerCount();
});
document.querySelectorAll(".close-metric-picker").forEach(button => button.addEventListener("click", () => metricPickerDialog.close()));
document.querySelector("#customize-all-metrics").addEventListener("click", () => openMetricPicker(null));
document.querySelector("#metric-picker-reset").addEventListener("click", () => {
  metricPrefs = writeMetricPrefs(localStorage, resetCampaignMetrics(metricPrefs, metricPickerTarget));
  metricPickerDialog.close();
  renderCampaigns(document.querySelector("#client-filter").value);
});
document.querySelector("#metric-picker-form").addEventListener("submit", event => {
  event.preventDefault();
  const selection = [...document.querySelectorAll('input[name="row-metric"]:checked')].map(input => input.value);
  if (!selection.length) {
    const error = document.querySelector("#metric-picker-error");
    error.textContent = "Choose at least one metric.";
    error.hidden = false;
    return;
  }
  metricPrefs = writeMetricPrefs(localStorage, setCampaignMetrics(metricPrefs, metricPickerTarget, selection));
  metricPickerDialog.close();
  renderCampaigns(document.querySelector("#client-filter").value);
});

// --- Spend chart: cumulative vs. plan, or daily spend against the baseline daily budget ---
let chartMode = "cumulative";
let currentDailyView = null;
try { chartMode = localStorage.getItem("northstar-chart-mode") === "daily" ? "daily" : "cumulative"; } catch { chartMode = "cumulative"; }

const todayIso = () => new Date().toISOString().slice(0, 10);

function setChartMode(mode) {
  chartMode = mode;
  try { localStorage.setItem("northstar-chart-mode", mode); } catch { /* the toggle still works without storage */ }
  renderCampaigns(document.querySelector("#client-filter").value);
}

document.querySelector("#chart-mode").addEventListener("click", event => {
  const button = event.target.closest("[data-chart-mode]");
  if (button && button.dataset.chartMode !== chartMode) setChartMode(button.dataset.chartMode);
});

function renderDailyChart(points, units, chart) {
  const view = dailyPacingView(points, units, { today: todayIso() });
  currentDailyView = view;
  const days = view.days;
  const bars = document.querySelector("#spend-chart-bars");
  const note = document.querySelector("#spend-chart-note");
  if (!days.length) {
    chart.hidden = true;
    document.querySelector("#spend-chart-empty").hidden = false;
    document.querySelector("#spend-chart-empty").textContent = "The daily view needs at least two dated reports.";
    document.querySelector("#spend-chart-x-axis").hidden = true;
    document.querySelector("#spend-chart-y-axis").hidden = true;
    note.hidden = true;
    return;
  }
  const maximum = Math.max(...days.flatMap(day => [day.actual, day.baseline]), 1);
  const step = 760 / days.length;
  const barWidth = Math.max(1, step * 0.68);
  const y = value => 256 - value / maximum * 236;
  bars.innerHTML = days.map((day, index) => {
    const percent = day.baseline > 0 ? day.actual / day.baseline * 100 : null;
    const band = percent === null ? "on-track" : pacingBand(percent, alertRules);
    return `<rect class="daily-bar pace-bar-${band}${day.estimated ? " estimated" : ""}" x="${(index * step + (step - barWidth) / 2).toFixed(2)}" y="${y(day.actual).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${(256 - y(day.actual)).toFixed(2)}"><title>${day.date}: ${formatExactMoney(day.actual)}${day.baseline > 0 ? ` vs ${formatExactMoney(day.baseline)} baseline (${Math.round(percent)}%)` : ""}${day.estimated ? " · averaged between reports" : ""}</title></rect>`;
  }).join("");
  const baselinePoints = days.map((day, index) => `${index ? "L" : "M"}${(index * step + step / 2).toFixed(2)},${y(day.baseline).toFixed(2)}`).join(" ");
  document.querySelector("#spend-chart-baseline").setAttribute("d", baselinePoints);
  document.querySelector("#spend-chart-y-axis").innerHTML = [maximum, maximum * 2 / 3, maximum / 3, 0].map(value => `<span>${formatMoney(value)}</span>`).join("");
  const labels = [...new Set([days[0], days[Math.floor((days.length - 1) / 2)], days.at(-1)])];
  document.querySelector("#spend-chart-x-axis").innerHTML = labels.map(day => `<span>${new Date(`${day.date}T00:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" })}</span>`).join("");
  const parts = [];
  if (view.recentBaseline > 0) parts.push(`Baseline ${formatExactMoney(view.recentBaseline)}/day`);
  if (view.recentActual !== null) parts.push(`last ${Math.min(7, days.length)} days averaged ${formatExactMoney(view.recentActual)}/day${view.recentPercent === null ? "" : ` (${Math.round(view.recentPercent)}% of baseline)`}`);
  if (view.requiredFromToday !== null) parts.push(`needs ${formatExactMoney(view.requiredFromToday)}/day from today to spend the remaining budget by the end dates`);
  if (view.skippedUnits) parts.push(`${view.skippedUnits} campaign${view.skippedUnits === 1 ? "" : "s"} without a budget or flight dates ${view.skippedUnits === 1 ? "is" : "are"} left out of the baseline`);
  note.hidden = false;
  note.textContent = parts.join(" · ") || "Add budgets and flight dates to see a daily baseline.";
  chart.setAttribute("aria-label", `Daily spend against the baseline daily budget from ${days[0].date} to ${days.at(-1).date}`);
}

function renderSpendChart(visibleCampaigns) {
  const points = buildPortfolioSpendTrend(visibleCampaigns, { spendView: selectedSource }).filter(point => point.actual !== null);
  currentSpendTrend = points;
  const daily = chartMode === "daily";
  document.querySelectorAll("#chart-mode [data-chart-mode]").forEach(button => {
    const active = button.dataset.chartMode === chartMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelector("#spend-chart-legend").innerHTML = daily
    ? '<span><i class="actual"></i>Daily spend</span><span><i class="baseline"></i>Baseline daily budget</span>'
    : '<span><i class="actual"></i>Actual</span><span><i class="planned"></i>Planned</span>';
  document.querySelector("#spend-chart-title").textContent = daily ? "Daily spend vs. baseline" : "Spend performance";
  for (const id of ["#spend-chart-area", "#spend-chart-planned", "#spend-chart-actual"]) document.querySelector(id).style.display = daily ? "none" : "";
  document.querySelector("#spend-chart-bars").style.display = daily ? "" : "none";
  document.querySelector("#spend-chart-baseline").style.display = daily ? "" : "none";
  document.querySelector("#spend-chart-note").hidden = true;
  document.querySelector("#export-spend-trend").disabled = points.length === 0;
  const chart = document.querySelector("#spend-chart");
  const empty = document.querySelector("#spend-chart-empty");
  const hasTrend = points.length >= 2;
  const sourceLabel = { billing: "Billing", first: "1st-party", third: "3rd-party" }[selectedSource];
  const coverage = points.at(-1);
  document.querySelector("#spend-chart-context").textContent = coverage ? `${sourceLabel} spend ${daily ? "per day vs. the budget baseline" : "vs. plan"} · ${coverage.historyCampaigns}/${coverage.totalCampaigns} campaigns with history` : `${sourceLabel} spend ${daily ? "per day" : "vs. plan"} across active campaigns`;
  chart.hidden = !hasTrend;
  empty.hidden = hasTrend;
  empty.textContent = "Import at least two dated campaign reports to display the portfolio trend.";
  document.querySelector("#spend-chart-x-axis").hidden = !hasTrend;
  document.querySelector("#spend-chart-y-axis").hidden = !hasTrend;
  if (!hasTrend) return;
  if (daily) { renderDailyChart(points, budgetUnits(visibleCampaigns, campaignTotals), chart); return; }
  const maximum = Math.max(...points.flatMap(point => [point.actual || 0, point.planned || 0]), 1);
  const coordinate = (point, index, key) => `${index / (points.length - 1) * 760},${256 - (point[key] || 0) / maximum * 236}`;
  const pathFor = key => points.map((point, index) => `${index ? "L" : "M"}${coordinate(point, index, key)}`).join(" ");
  const actualPath = pathFor("actual");
  document.querySelector("#spend-chart-actual").setAttribute("d", actualPath);
  document.querySelector("#spend-chart-planned").setAttribute("d", pathFor("planned"));
  document.querySelector("#spend-chart-area").setAttribute("d", `${actualPath} L760,256 L0,256 Z`);
  document.querySelector("#spend-chart-y-axis").innerHTML = [maximum, maximum * 2 / 3, maximum / 3, 0].map(value => `<span>${formatMoney(value)}</span>`).join("");
  const labels = [...new Set([points[0], points[Math.floor((points.length - 1) / 2)], points.at(-1)])];
  document.querySelector("#spend-chart-x-axis").innerHTML = labels.map(point => `<span>${new Date(`${point.date}T00:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" })}</span>`).join("");
  chart.setAttribute("aria-label", `Actual and planned cumulative spend from ${points[0].date} to ${points.at(-1).date}`);
}

document.querySelector("#export-spend-trend").addEventListener("click", () => {
  const daily = chartMode === "daily" && currentDailyView?.days.length;
  if (!daily && !currentSpendTrend.length) return;
  const text = daily
    ? rowsToCsv([["date", "daily_spend", "baseline_daily_budget", "percent_of_baseline", "averaged_between_reports"], ...currentDailyView.days.map(day => [day.date, Number(day.actual.toFixed(2)), Number(day.baseline.toFixed(2)), day.baseline > 0 ? Number((day.actual / day.baseline * 100).toFixed(1)) : "", day.estimated ? "yes" : "no"])])
    : exportPortfolioSpendTrendCsv(currentSpendTrend, selectedSource);
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `northstar-${daily ? "daily-spend" : "spend-trend"}-${selectedSource}-${todayIso()}.csv` });
  link.click();
  URL.revokeObjectURL(url);
});

function applyColumnVisibility() {
  document.querySelectorAll("[data-column]").forEach(cell => { cell.hidden = !visibleColumns.includes(cell.dataset.column); });
}

function refreshClientFilter() {
  const select = document.querySelector("#client-filter");
  const selected = select.value;
  const clients = [...new Set(campaigns.map(campaign => campaign.client))].sort();
  select.innerHTML = '<option value="all">All clients</option>' + clients.map(client => `<option value="${escapeHtml(client)}">${escapeHtml(client)}</option>`).join("");
  select.value = clients.includes(selected) ? selected : "all";
  const ownerSelect = document.querySelector("#owner-filter");
  const selectedOwner = ownerSelect.value;
  const owners = [...new Set(campaigns.map(campaign => campaign.owner).filter(Boolean))].sort();
  ownerSelect.innerHTML = '<option value="all">All owners</option>' + owners.map(owner => `<option value="${escapeHtml(owner)}">${escapeHtml(owner)}</option>`).join("");
  ownerSelect.value = owners.includes(selectedOwner) ? selectedOwner : "all";
  const channelSelect = document.querySelector("#channel-filter");
  const selectedChannel = channelSelect.value;
  const channels = [...new Set(campaigns.map(campaign => campaign.channel).filter(Boolean))].sort();
  channelSelect.innerHTML = '<option value="all">All channels</option>' + channels.map(channel => `<option value="${escapeHtml(channel)}">${escapeHtml(channel)}</option>`).join("");
  channelSelect.value = channels.includes(selectedChannel) ? selectedChannel : "all";
}

function captureDashboardView() {
  dashboardView = writeDashboardView(localStorage, {
    client: document.querySelector("#client-filter").value,
    period: document.querySelector("#period-filter").value,
    status: document.querySelector("#status-filter").value,
    owner: document.querySelector("#owner-filter").value,
    channel: document.querySelector("#channel-filter").value,
    attention: document.querySelector("#attention-filter").value,
    sort: document.querySelector("#campaign-sort").value,
    query: document.querySelector("#campaign-search").value,
    spendSource: selectedSource,
    kpiView: document.querySelector("#kpi-view").value
  });
}

function applyDashboardView(view) {
  const assignOption = (selector, value) => {
    const select = document.querySelector(selector);
    select.value = [...select.options].some(option => option.value === value) ? value : "all";
  };
  assignOption("#client-filter", view.client);
  assignOption("#period-filter", view.period);
  assignOption("#status-filter", view.status);
  assignOption("#owner-filter", view.owner);
  assignOption("#channel-filter", view.channel);
  assignOption("#attention-filter", view.attention);
  assignOption("#campaign-sort", view.sort);
  assignOption("#kpi-view", view.kpiView);
  document.querySelector("#campaign-search").value = view.query;
  selectedSource = view.spendSource;
  document.querySelectorAll(".segmented button").forEach(button => {
    const active = button.dataset.source === selectedSource;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

document.querySelector("#client-filter").addEventListener("change", event => renderCampaigns(event.target.value));
document.querySelector("#status-filter").addEventListener("change", event => renderCampaigns(document.querySelector("#client-filter").value, event.target.value));
document.querySelector("#owner-filter").addEventListener("change", event => renderCampaigns(document.querySelector("#client-filter").value, document.querySelector("#status-filter").value, event.target.value));
document.querySelector("#channel-filter").addEventListener("change", event => renderCampaigns(document.querySelector("#client-filter").value, document.querySelector("#status-filter").value, document.querySelector("#owner-filter").value, event.target.value));
document.querySelector("#campaign-search").addEventListener("input", () => renderCampaigns(document.querySelector("#client-filter").value));
document.querySelector("#campaign-sort").addEventListener("change", () => renderCampaigns(document.querySelector("#client-filter").value));
document.querySelector("#attention-filter").addEventListener("change", () => renderCampaigns(document.querySelector("#client-filter").value));
document.querySelector("#kpi-view").addEventListener("change", () => renderCampaigns(document.querySelector("#client-filter").value));
document.querySelector('[aria-label="Search"]').addEventListener("click", () => document.querySelector("#campaign-search").focus());
document.querySelector("#period-filter").addEventListener("change", () => renderCampaigns(document.querySelector("#client-filter").value));
document.querySelector(".control-bar").addEventListener("change", captureDashboardView);
document.querySelector("#campaign-search").addEventListener("input", captureDashboardView);
document.querySelector("#reset-dashboard-view").addEventListener("click", () => {
  dashboardView = writeDashboardView(localStorage, DEFAULT_DASHBOARD_VIEW);
  applyDashboardView(dashboardView);
  renderCampaigns();
});

function renderSavedViews() {
  const container = document.querySelector("#saved-view-list");
  container.innerHTML = savedViews.length ? savedViews.map(item => `<div><span><strong>${escapeHtml(item.name)}</strong><small>${item.savedAt ? `Saved ${new Date(item.savedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : "Saved dashboard view"}</small></span><span><button class="text-button" type="button" data-open-view="${escapeHtml(item.id)}">Open</button><button class="text-button destructive-text" type="button" data-delete-view="${escapeHtml(item.id)}">Delete</button></span></div>`).join("") : '<p class="history-empty">No dashboard views have been saved yet.</p>';
}

document.querySelector("#manage-saved-views").addEventListener("click", () => {
  document.querySelector("#saved-view-name").value = "";
  document.querySelector("#saved-view-error").hidden = true;
  renderSavedViews();
  savedViewsDialog.showModal();
});
document.querySelectorAll(".close-saved-views").forEach(button => button.addEventListener("click", () => savedViewsDialog.close()));
document.querySelector("#saved-views-form").addEventListener("submit", event => {
  event.preventDefault();
  captureDashboardView();
  const result = saveNamedView(savedViews, document.querySelector("#saved-view-name").value, dashboardView);
  const error = document.querySelector("#saved-view-error");
  if (!result.valid) { error.textContent = result.error; error.hidden = false; return; }
  savedViews = writeSavedViews(localStorage, result.views);
  document.querySelector("#saved-view-name").value = "";
  error.hidden = true;
  renderSavedViews();
});
document.querySelector("#saved-view-list").addEventListener("click", event => {
  const openButton = event.target.closest("[data-open-view]");
  const deleteButton = event.target.closest("[data-delete-view]");
  if (openButton) {
    const selected = savedViews.find(item => item.id === openButton.dataset.openView);
    if (!selected) return;
    dashboardView = writeDashboardView(localStorage, selected.view);
    applyDashboardView(dashboardView);
    renderCampaigns(document.querySelector("#client-filter").value);
    savedViewsDialog.close();
  }
  if (deleteButton) {
    savedViews = writeSavedViews(localStorage, removeNamedView(savedViews, deleteButton.dataset.deleteView));
    renderSavedViews();
  }
});
document.querySelector("#export-dashboard-button").addEventListener("click", () => {
  const matching = filterCampaigns(campaigns, { client: document.querySelector("#client-filter").value, status: document.querySelector("#status-filter").value, owner: document.querySelector("#owner-filter").value, channel: document.querySelector("#channel-filter").value, query: document.querySelector("#campaign-search").value });
  const activeAlerts = unacknowledgedAlerts(evaluateAlerts(matching), acknowledgedAlertIds);
  const exportRows = filterCampaignsByAttention(matching, activeAlerts, document.querySelector("#attention-filter").value);
  const csv = exportCampaignsCsv(exportRows, { sort: document.querySelector("#campaign-sort").value, spendView: selectedSource, period: document.querySelector("#period-filter").value, kpiView: document.querySelector("#kpi-view").value });
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `northstar-campaigns-${new Date().toISOString().slice(0, 10)}.csv` });
  link.click();
  URL.revokeObjectURL(url);
});
document.querySelectorAll(".segmented button").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".segmented button").forEach(item => { item.classList.remove("active"); item.setAttribute("aria-pressed", "false"); });
  button.classList.add("active");
  button.setAttribute("aria-pressed", "true");
  selectedSource = button.dataset.source;
  captureDashboardView();
  renderCampaigns(document.querySelector("#client-filter").value);
}));

const dialog = document.querySelector("#upload-dialog");
const campaignDialog = document.querySelector("#campaign-dialog");
const alertDialog = document.querySelector("#alert-dialog");
const createCampaignDialog = document.querySelector("#create-campaign-dialog");
const columnDialog = document.querySelector("#column-dialog");
const workspaceBackupDialog = document.querySelector("#workspace-backup-dialog");
const importAuditDialog = document.querySelector("#import-audit-dialog");
const savedViewsDialog = document.querySelector("#saved-views-dialog");
let activeCampaignIndex = null;
document.querySelector("#workspace-backup-button").addEventListener("click", () => {
  pendingWorkspaceBackup = null;
  document.querySelector("#workspace-backup-input").value = "";
  document.querySelector("#workspace-backup-error").hidden = true;
  document.querySelector("#restore-workspace-backup").disabled = true;
  workspaceBackupDialog.showModal();
});
document.querySelectorAll(".close-workspace-backup").forEach(button => button.addEventListener("click", () => workspaceBackupDialog.close()));
document.querySelector("#download-workspace-backup").addEventListener("click", () => {
  const backup = createWorkspaceBackup({ campaigns, importHistory, alertRules, visibleColumns, acknowledgedAlerts: acknowledgedAlertIds, dashboardView, savedViews, metricPrefs, campaignTotals });
  const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `northstar-workspace-${new Date().toISOString().slice(0, 10)}.json` });
  link.click();
  URL.revokeObjectURL(url);
});
document.querySelector("#workspace-backup-input").addEventListener("change", async event => {
  const result = event.target.files[0] ? validateWorkspaceBackup(await event.target.files[0].text()) : { valid: false, errors: ["Choose a backup file."] };
  const error = document.querySelector("#workspace-backup-error");
  pendingWorkspaceBackup = result.valid ? result.backup : null;
  error.textContent = result.valid ? "" : result.errors.join(" ");
  error.hidden = result.valid;
  document.querySelector("#restore-workspace-backup").disabled = !result.valid;
});
document.querySelector("#workspace-backup-form").addEventListener("submit", event => {
  event.preventDefault();
  if (!pendingWorkspaceBackup) return;
  restoreWorkspaceBackup(localStorage, pendingWorkspaceBackup);
  window.location.reload();
});
document.querySelector("#reset-workspace").addEventListener("click", () => {
  if (!window.confirm("Reset this browser workspace? Imported campaigns, audit history, settings, saved views, and acknowledgments will be removed. Download a backup first if you may need them.")) return;
  resetWorkspaceStorage(localStorage);
  window.location.reload();
});
document.querySelectorAll("#upload-button, #upload-nav").forEach(button => button.addEventListener("click", () => {
  resetImportForm();
  renderImportHistory();
  dialog.showModal();
}));
const fileInput = document.querySelector("#file-input");
const filePreview = document.querySelector("#file-preview");
const validateButton = document.querySelector("#validate-button");
const confirmImportButton = document.querySelector("#confirm-import-button");
const validationResult = document.querySelector("#validation-result");
fileInput.addEventListener("change", () => {
  if (!fileInput.files.length) {
    resetImportForm();
    return;
  }
  pendingValidatedImport = null;
  confirmImportButton.disabled = true;
  document.querySelector("#import-preview").hidden = true;
  document.querySelector("#mapping-review").hidden = true;
  validationResult.hidden = true;
  const file = fileInput.files[0];
  selectedFile = file;
  document.querySelector("#file-name").textContent = file.name;
  filePreview.hidden = false;
  if (!/\.(csv|xlsx)$/i.test(file.name)) {
    showValidationResult(["Choose a .csv or .xlsx report."], "error");
    validateButton.disabled = true;
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    showValidationResult(["The selected file is larger than the 25 MB import limit."], "error");
    validateButton.disabled = true;
    return;
  }
  validateButton.disabled = false;
});
document.querySelector("#remove-file").addEventListener("click", () => {
  resetImportForm();
  document.querySelector(".dropzone").focus();
});
dialog.addEventListener("close", resetImportForm);
document.querySelectorAll('input[name="import-mode"]').forEach(input => input.addEventListener("change", () => {
  if (pendingValidatedImport?.result) renderImportPreview(effectiveImport().campaigns);
}));
let allowDuplicateOnce = false;
validationResult.addEventListener("click", event => {
  if (!event.target.closest("#import-anyway")) return;
  allowDuplicateOnce = true;
  validateButton.click();
});
validateButton.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  validateButton.disabled = true;
  validateButton.textContent = "Validating…";
  document.querySelector("#import-preview").hidden = true;
  document.querySelector("#mapping-review").hidden = true;
  const fileBytes = await file.arrayBuffer();
  const fingerprint = await fingerprintBytes(fileBytes);
  if (hasSuccessfulFingerprint(importHistory, fingerprint) && !allowDuplicateOnce) {
    recordImport(file.name, fingerprint, "Duplicate", 0, ["This exact report has already been imported."]);
    showValidationResult(["This exact report has already been imported. No dashboard data was changed."], "error");
    validationResult.insertAdjacentHTML("beforeend", '<p class="duplicate-hint">Imported only part of it (for example from New campaign)? Importing again is safe: rows already in the dashboard are updated, not duplicated. <button type="button" class="text-button" id="import-anyway">Import it again anyway</button></p>');
    validateButton.textContent = "Validate report";
    validateButton.disabled = false;
    return;
  }
  allowDuplicateOnce = false;
  let report;
  try {
    report = await readReportFile(file, fileBytes);
  } catch (error) {
    recordImport(file.name, fingerprint, "Rejected", 0, [error.message]);
    showValidationResult([error.message], "error");
    validateButton.textContent = "Validate report";
    validateButton.disabled = false;
    return;
  }
  if (report.kind === "daily-delivery") {
    validateButton.textContent = "Validate report";
    handleDailyReport(file, fingerprint, report);
    return;
  }
  if (report.kind === "line-items") {
    validateButton.textContent = "Validate report";
    handleLineItemReport(file, fingerprint, report);
    return;
  }
  const result = validateCampaignCsv(report.csvText);
  validateButton.textContent = "Validate report";
  if (!result.valid) {
    recordImport(file.name, fingerprint, "Rejected", 0, result.errors);
    showValidationResult(result.errors, "error");
    validateButton.disabled = false;
    return;
  }
  pendingValidatedImport = { fileName: file.name, fingerprint, report, result, choices: initialChoices(result.campaigns, readAssignments(localStorage), groupCampaigns(campaigns)), groupEdits: {}, groupIo: {}, unmatchedIos: [] };
  renderImportAssignments();
  const effectiveRows = effectiveImport().campaigns;
  confirmImportButton.disabled = effectiveRows.length === 0;
  renderImportPreview(effectiveRows);
  renderMappingReview(report.headers);
  const location = report.worksheet ? `${report.worksheet}, header row ${report.headerRow}` : `header row ${report.headerRow}`;
  const mappingSummary = report.headerMappings.length ? ` ${report.headerMappings.length} source column alias${report.headerMappings.length === 1 ? " was" : "es were"} mapped automatically.` : "";
  showValidationResult([`${result.campaigns.length} campaign row${result.campaigns.length === 1 ? "" : "s"} passed validation from ${location}.${mappingSummary} Review warnings and choose Import validated report to continue.`, ...result.warnings], "success", result.warnings);
});
confirmImportButton.addEventListener("click", () => {
  if (!pendingValidatedImport) return;
  if (pendingValidatedImport.kind === "daily") { confirmDailyImport(); return; }
  if (pendingValidatedImport.kind === "line-items") { confirmLineItemImport(); return; }
  const { fileName, fingerprint, result } = pendingValidatedImport;
  const importMode = document.querySelector('input[name="import-mode"]:checked').value;
  const effectiveRows = effectiveImport().campaigns;
  rememberAssignments(localStorage, result.campaigns, pendingValidatedImport.choices);
  if (setupErrors().length) return;
  const mergeResult = previewCampaignImport(campaigns, effectiveRows.map(row => ({ ...row, sourceFile: fileName })), importMode);
  writeImportRollback(localStorage, createImportRollback({ campaigns, importHistory, fileName, fingerprint, rowCount: effectiveRows.length, campaignKeys: effectiveRows.map(campaignImportKey), campaignTotals }));
  campaigns = mergeResult.campaigns;
  const appliedOrders = applyAttachedImportIos(fileName);
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  const importStatus = result.warnings.length ? "Imported with warnings" : "Imported";
  recordImport(fileName, fingerprint, importStatus, effectiveRows.length, [], effectiveRows.map(campaignImportKey), result.warnings);
  refreshClientFilter();
  renderCampaigns();
  document.querySelector("#toast-message").textContent = `${effectiveRows.length} campaign row${effectiveRows.length === 1 ? "" : "s"} imported successfully${appliedOrders.length ? `, with ${appliedOrders.length} insertion order${appliedOrders.length === 1 ? "" : "s"} applied` : ""}.`;
  document.querySelector("#toast-title").textContent = "Report imported";
  setTimeout(() => {
    dialog.close();
    const toast = document.querySelector("#toast");
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3200);
    resetImportForm();
  }, 550);
});

function handleLineItemReport(file, fingerprint, report) {
  const parsed = report.parsed;
  if (!parsed.valid) {
    recordImport(file.name, fingerprint, "Rejected", 0, parsed.errors);
    showValidationResult(parsed.errors, "error");
    validateButton.disabled = false;
    return;
  }
  pendingValidatedImport = { kind: "line-items", fileName: file.name, fingerprint, report, parsed, links: {} };
  document.querySelector(".import-mode").hidden = true;
  document.querySelector("#mapping-review").hidden = true;
  renderLineItemPreview();
}

function renderLineItemPreview() {
  const { parsed, links, report } = pendingValidatedImport;
  const result = applyLineItems(campaigns, parsed, links);
  pendingValidatedImport.lineResult = result;
  const attached = result.matched.reduce((sum, item) => sum + item.count, 0);
  const location = report.worksheet ? `${report.worksheet}, header row ${report.headerRow}` : `header row ${report.headerRow}`;
  document.querySelector("#import-preview").hidden = false;
  document.querySelector("#import-preview-title").textContent = "DSP line-item preview";
  document.querySelector("#import-preview-mode").textContent = "Line items attach to existing campaigns";
  document.querySelector("#import-preview-summary").innerHTML = `<div><strong>${result.matched.length}</strong><small>Campaigns</small></div><div><strong>${attached}</strong><small>Line items</small></div><div class="${result.unmatched.length ? "destructive" : ""}"><strong>${result.unmatched.length}</strong><small>Unmatched</small></div><div><strong>${parsed.lineItemCount}</strong><small>In file</small></div>`;
  const options = `<option value="">Skip this campaign</option>${campaigns.map((campaign, index) => `<option value="${index}">${escapeHtml(campaign.client)} · ${escapeHtml(campaign.name)}</option>`).join("")}`;
  document.querySelector("#import-preview-list").innerHTML = result.matched.map(item => `<div><span><strong>${escapeHtml(item.campaign)}</strong><small>${escapeHtml(item.client)} · ${item.count} line item${item.count === 1 ? "" : "s"}</small></span><em class="preview-action update">attach</em></div>`).join("")
    + result.unmatched.map(entry => `<div><span><strong>${escapeHtml(entry.sourceName)}</strong><small>${entry.lineItems.length} line item${entry.lineItems.length === 1 ? "" : "s"} · not matched</small></span><select class="daily-link-select" data-line-key="${escapeHtml(entry.key)}" aria-label="Link ${escapeHtml(entry.sourceName)} to a dashboard campaign">${options}</select></div>`).join("");
  document.querySelectorAll("[data-line-key]").forEach(select => select.addEventListener("change", () => {
    if (select.value === "") delete pendingValidatedImport.links[select.dataset.lineKey]; else pendingValidatedImport.links[select.dataset.lineKey] = Number(select.value);
    renderLineItemPreview();
  }));
  confirmImportButton.disabled = result.matched.length === 0;
  const messages = [`${parsed.lineItemCount} line item${parsed.lineItemCount === 1 ? "" : "s"} in ${parsed.campaigns.length} campaign${parsed.campaigns.length === 1 ? "" : "s"} read from ${location}.`, ...(result.unmatched.length ? [`${result.unmatched.length} campaign${result.unmatched.length === 1 ? "" : "s"} not matched; link each below or it will be skipped.`] : [])];
  if (!result.matched.length) messages.unshift("No campaign in the file matched a dashboard campaign. Import the campaign's weekly report first or link it below.");
  showValidationResult(messages, result.matched.length ? "success" : "error", result.unmatched.length ? messages.slice(1) : []);
  validateButton.disabled = false;
}

function confirmLineItemImport() {
  const { fileName, fingerprint, lineResult } = pendingValidatedImport;
  const keys = lineResult.matched.map(item => [item.client, item.campaignId || item.campaign, "dsp line items"].map(value => String(value ?? "").trim().toLowerCase()).join("::"));
  writeImportRollback(localStorage, createImportRollback({ campaigns, importHistory, fileName, fingerprint, rowCount: lineResult.matched.length, campaignKeys: keys }));
  campaigns = lineResult.campaigns;
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  const warnings = lineResult.unmatched.map(entry => `Skipped unmatched campaign: ${entry.sourceName}.`);
  recordImport(fileName, fingerprint, warnings.length ? "Imported with warnings" : "Imported", lineResult.matched.length, [], keys, warnings);
  refreshClientFilter();
  renderCampaigns();
  document.querySelector("#toast-title").textContent = "Line items imported";
  document.querySelector("#toast-message").textContent = `Line-item performance attached to ${lineResult.matched.length} campaign${lineResult.matched.length === 1 ? "" : "s"}.`;
  setTimeout(() => {
    dialog.close();
    const toast = document.querySelector("#toast");
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3200);
    resetImportForm();
  }, 550);
}

function handleDailyReport(file, fingerprint, report) {
  const parsed = report.parsed;
  if (!parsed.valid) {
    recordImport(file.name, fingerprint, "Rejected", 0, parsed.errors);
    showValidationResult(parsed.errors, "error");
    validateButton.disabled = false;
    return;
  }
  pendingValidatedImport = { kind: "daily", fileName: file.name, fingerprint, report, parsed, links: {} };
  document.querySelector(".import-mode").hidden = true;
  document.querySelector("#mapping-review").hidden = true;
  renderDailyPreview();
}

function renderDailyPreview() {
  const { parsed, links, report } = pendingValidatedImport;
  const result = applyDailyDelivery(campaigns, parsed, links);
  pendingValidatedImport.dailyResult = result;
  const days = result.matched.reduce((sum, item) => sum + item.days, 0);
  const location = report.worksheet ? `${report.worksheet}, header row ${report.headerRow}` : `header row ${report.headerRow}`;
  document.querySelector("#import-preview").hidden = false;
  document.querySelector("#import-preview-title").textContent = `${parsed.source} daily delivery preview`;
  document.querySelector("#import-preview-mode").textContent = "Daily rows never create campaigns";
  document.querySelector("#import-preview-summary").innerHTML = `<div><strong>${result.matched.length}</strong><small>Matched</small></div><div><strong>${days}</strong><small>Days applied</small></div><div class="${result.unmatched.length ? "destructive" : ""}"><strong>${result.unmatched.length}</strong><small>Unmatched</small></div><div><strong>${parsed.records.length}</strong><small>Daily rows</small></div>`;
  const options = `<option value="">Skip this campaign</option>${campaigns.map((campaign, index) => `<option value="${index}">${escapeHtml(campaign.client)} · ${escapeHtml(campaign.name)}</option>`).join("")}`;
  document.querySelector("#import-preview-list").innerHTML = result.matched.map(item => `<div><span><strong>${escapeHtml(item.campaign)}</strong><small>${escapeHtml(item.client)} · ${escapeHtml(parsed.source)} · ${item.days} day${item.days === 1 ? "" : "s"}</small></span><em class="preview-action update">update</em></div>`).join("")
    + result.unmatched.map(entry => `<div><span><strong>${escapeHtml(entry.sourceCampaignName || entry.sourceCampaignId)}</strong><small>${escapeHtml(parsed.source)}${entry.sourceCampaignId ? ` · ${escapeHtml(entry.sourceCampaignId)}` : ""} · ${entry.days} day${entry.days === 1 ? "" : "s"} · not matched</small></span><select class="daily-link-select" data-key="${escapeHtml(entry.key)}" aria-label="Link ${escapeHtml(entry.sourceCampaignName || entry.sourceCampaignId)} to a dashboard campaign">${options}</select></div>`).join("");
  document.querySelectorAll(".daily-link-select").forEach(select => select.addEventListener("change", () => {
    const entry = parsed.campaigns.find(item => item.key === select.dataset.key);
    const keys = [entry.sourceCampaignId, entry.sourceCampaignName].map(value => String(value ?? "").trim().toLowerCase()).filter(Boolean);
    keys.forEach(key => {
      if (select.value === "") delete pendingValidatedImport.links[`${parsed.source}::${key}`];
      else pendingValidatedImport.links[`${parsed.source}::${key}`] = Number(select.value);
    });
    renderDailyPreview();
  }));
  confirmImportButton.disabled = result.matched.length === 0;
  const messages = [`${parsed.records.length} daily row${parsed.records.length === 1 ? "" : "s"} for ${parsed.campaigns.length} source campaign${parsed.campaigns.length === 1 ? "" : "s"} read from ${location}.`, ...(result.unmatched.length ? [`${result.unmatched.length} campaign${result.unmatched.length === 1 ? "" : "s"} not matched; link each below or it will be skipped.`] : []), ...result.warnings];
  if (!result.matched.length) messages.unshift("No source campaign matched an existing dashboard campaign. Create the campaign first or link it below.");
  showValidationResult(messages, result.matched.length ? "success" : "error", result.unmatched.length || result.warnings.length ? messages.slice(1) : []);
  validateButton.disabled = false;
}

function confirmDailyImport() {
  const { fileName, fingerprint, parsed, dailyResult } = pendingValidatedImport;
  const keys = dailyResult.matched.map(item => [item.client, item.campaignId || item.campaign, parsed.source].map(value => String(value ?? "").trim().toLowerCase()).join("::"));
  writeImportRollback(localStorage, createImportRollback({ campaigns, importHistory, fileName, fingerprint, rowCount: dailyResult.matched.length, campaignKeys: keys }));
  campaigns = dailyResult.campaigns;
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  const warnings = [...dailyResult.warnings, ...dailyResult.unmatched.map(entry => `Skipped unmatched ${parsed.source} campaign: ${entry.sourceCampaignName || entry.sourceCampaignId}.`)];
  recordImport(fileName, fingerprint, warnings.length ? "Imported with warnings" : "Imported", dailyResult.matched.length, [], keys, warnings);
  refreshClientFilter();
  renderCampaigns();
  document.querySelector("#toast-message").textContent = `${parsed.source} daily delivery applied to ${dailyResult.matched.length} campaign${dailyResult.matched.length === 1 ? "" : "s"}.`;
  document.querySelector("#toast-title").textContent = "Daily report imported";
  setTimeout(() => {
    dialog.close();
    const toast = document.querySelector("#toast");
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3200);
    resetImportForm();
  }, 550);
}

// --- Import preview, one block per campaign: what it becomes, its setup, and its insertion order ---
// One report can hold several campaigns (e.g. Hyperlocal and OLA); each gets its own choice, setup, and IO.
const SETUP_FIELDS = [
  ["client", "Client", "text"], ["name", "Campaign name", "text"], ["owner", "Owner", "text"], ["channel", "Channel", "text"],
  ["kpi", "Primary KPI", "text"], ["target", "KPI target", "text"]
];
const SINGLE_LINE_FIELDS = [["campaignId", "Stable campaign ID", "text"], ["startDate", "Start date", "date"], ["endDate", "End date", "date"], ["budget", "Approved budget", "text"]];

function importGroups() {
  return groupReportRows(pendingValidatedImport.result.campaigns);
}

/** Applies a campaign-level setup edit to one of its rows: shared fields everywhere, and a rename keeps each line's label. */
function rowWithGroupEdits(row, edits, groupSize) {
  if (!edits || !Object.keys(edits).length) return row;
  const { name: groupName, ...shared } = edits;
  const fields = groupSize === 1 ? shared : Object.fromEntries(Object.entries(shared).filter(([field]) => !["campaignId", "startDate", "endDate", "budget"].includes(field)));
  let next = applySetupEdits(row, fields);
  const renamed = String(groupName ?? "").trim();
  if (renamed) {
    const hasLabel = String(row.name).includes(" — ");
    next = { ...next, campaignGroup: renamed, name: groupSize === 1 && !hasLabel ? renamed : `${renamed} — ${lineLabel(row)}` };
  }
  return next;
}

function effectiveImport() {
  const { result, choices, groupEdits } = pendingValidatedImport;
  const sizes = new Map();
  result.campaigns.forEach(row => sizes.set(groupKey(row), (sizes.get(groupKey(row)) || 0) + 1));
  // Setup edits only apply to rows that stay their own campaign; rows added elsewhere or skipped ignore them.
  const rows = result.campaigns.map(row => choices[assignmentKey(row)] ? row : rowWithGroupEdits(row, groupEdits[groupKey(row)], sizes.get(groupKey(row))));
  return applyAssignments(rows, choices, groupCampaigns(campaigns));
}

function setupErrors() {
  const { choices, groupEdits } = pendingValidatedImport;
  return importGroups().filter(group => groupEdits[group.key] && !choices[assignmentKey(group.rows[0])]).flatMap(group => {
    const base = setupFieldsFromRow(group.rows[0]);
    const edits = group.rows.length === 1 ? groupEdits[group.key] : Object.fromEntries(Object.entries(groupEdits[group.key]).filter(([field]) => !["campaignId", "startDate", "endDate", "budget"].includes(field)));
    return validateSetupEdits({ ...base, ...edits }).map(message => `${group.name}: ${message}`);
  });
}

function refreshImportAfterAssignment() {
  const effective = effectiveImport();
  const errors = setupErrors();
  const errorBox = document.querySelector("#import-setup-error");
  errorBox.hidden = errors.length === 0;
  errorBox.textContent = errors.join(" ");
  renderImportPreview(effective.campaigns);
  confirmImportButton.disabled = effective.campaigns.length === 0 || errors.length > 0;
}

const groupChoice = group => {
  const choices = group.rows.map(row => pendingValidatedImport.choices[assignmentKey(row)] || "");
  return choices.every(choice => choice === choices[0]) ? choices[0] : "";
};

function setGroupChoice(group, value) {
  group.rows.forEach(row => {
    if (value === KEEP) delete pendingValidatedImport.choices[assignmentKey(row)];
    else pendingValidatedImport.choices[assignmentKey(row)] = value;
  });
}

function renderImportAssignments() {
  const section = document.querySelector("#import-assignments");
  const pending = pendingValidatedImport;
  const groups = importGroups();
  const existing = groupCampaigns(campaigns);
  section.hidden = !groups.length;
  if (!groups.length) return;
  pending.openSetup ??= new Set(groups.length === 1 ? [groups[0].key] : []);
  pending.groupIo ??= {};
  const sizes = new Map(groups.map(group => [group.key, group.rows.length]));
  const targetOptions = selected => `<option value="${SKIP}"${selected === SKIP ? " selected" : ""}>Skip this campaign</option>${existing.map(group => `<option value="${escapeHtml(group.key)}"${selected === group.key ? " selected" : ""}>Add to ${escapeHtml(group.client)} · ${escapeHtml(group.name)}</option>`).join("")}`;
  document.querySelector("#import-assign-all").innerHTML = `<option value="__mixed" selected disabled>Choose…</option><option value="${KEEP}">New or matching campaigns</option>${targetOptions("")}`;
  document.querySelector("#import-assign-all").closest("label").hidden = groups.length < 2;
  document.querySelector("#import-assignment-list").innerHTML = groups.map(group => {
    const choice = groupChoice(group);
    const edits = pending.groupEdits[group.key] || {};
    const editedRows = group.rows.map(row => rowWithGroupEdits(row, edits, sizes.get(group.key)));
    const actions = choice ? [] : previewCampaignImport(campaigns, editedRows).actions.map(item => item.action);
    const updates = actions.includes("update");
    const keepLabel = updates ? "Update the matching campaign" : "New campaign from this report";
    const chip = choice === SKIP ? '<em class="preview-action replace">skipped</em>' : choice ? '<em class="preview-action update">added to campaign</em>' : updates ? '<em class="preview-action update">updates existing</em>' : '<em class="preview-action add">new campaign</em>';
    const budgetTotal = group.rows.reduce((sum, row) => sum + (Number.isFinite(row.budget) ? row.budget : 0), 0);
    const meta = [group.client, `${group.rows.length} line${group.rows.length === 1 ? "" : "s"}`, budgetTotal ? `${formatMoney(budgetTotal)} budget in report` : ""].filter(Boolean).map(escapeHtml).join(" · ");
    let setup = "";
    if (!choice) {
      const values = { ...setupFieldsFromRow(group.rows[0]), name: group.name, ...edits };
      const fields = [...SETUP_FIELDS, ...(group.rows.length === 1 ? SINGLE_LINE_FIELDS : [])];
      const open = pending.openSetup.has(group.key) ? " open" : "";
      setup = `<details class="import-setup" data-setup-details="${escapeHtml(group.key)}"${open}><summary>Review campaign setup</summary><div class="settings-grid import-setup-grid">${fields.map(([field, label, type]) => `<label>${label}<input type="${type}" data-setup-key="${escapeHtml(group.key)}" data-setup-field="${field}" value="${escapeHtml(values[field] ?? "")}" autocomplete="off" /></label>`).join("")}<label>Billing source<select data-setup-key="${escapeHtml(group.key)}" data-setup-field="billingSource">${[["first", "1st party"], ["third", "3rd party"], ["reported", "Reported spend"]].map(([value, label]) => `<option value="${value}"${values.billingSource === value ? " selected" : ""}>${label}</option>`).join("")}</select></label><label>Expected report<select data-setup-key="${escapeHtml(group.key)}" data-setup-field="reportCadence">${[["none", "Not monitored"], ["daily", "Daily"], ["weekly", "Weekly"]].map(([value, label]) => `<option value="${value}"${values.reportCadence === value ? " selected" : ""}>${label}</option>`).join("")}</select></label></div><small class="field-hint">Pulled from the report; correct anything that is wrong. ${group.rows.length > 1 ? "Budgets and dates stay per line, as reported." : ""}</small></details>`;
    }
    const attached = pending.groupIo[group.key];
    const ioRow = choice === SKIP ? "" : `<div class="import-group-io"><span>Insertion order</span>${attached
      ? `<span class="import-io-summary"><strong>${escapeHtml([attached.io.orderNumber, attached.io.revision].filter(Boolean).join(" ") || attached.fileName)}</strong> · ${escapeHtml(formatExactMoney(attached.io.budget))} · ${attached.io.lineItems.length} placements</span><select data-group-io-mode="${escapeHtml(group.key)}" aria-label="How to use the order for ${escapeHtml(group.name)}"><option value="totals"${attached.mode === "totals" ? " selected" : ""}>Use order totals</option><option value="flights"${attached.mode === "flights" ? " selected" : ""}>Save placements as flights</option></select><button type="button" class="text-button" data-group-io-remove="${escapeHtml(group.key)}">Remove</button>`
      : `<label class="text-button import-io-attach">Attach IO (PDF)<input type="file" accept=".pdf,application/pdf" data-group-io-file="${escapeHtml(group.key)}" hidden /></label>`}</div>`;
    const lines = `<details class="import-group-lines"><summary>${group.rows.length} line${group.rows.length === 1 ? "" : "s"} in this report</summary>${group.rows.map(row => `<div><span>${escapeHtml(lineLabel(row))}</span><span>${formatMoney(row.spend)} spend${Number.isFinite(row.budget) ? ` · ${formatMoney(row.budget)} budget` : ""}</span></div>`).join("")}</details>`;
    return `<div class="import-assignment-block"><div class="import-assignment-row"><span><strong>${escapeHtml(group.name)}</strong><small>${meta} ${chip}</small></span><select data-group-choice="${escapeHtml(group.key)}" aria-label="What to do with ${escapeHtml(group.name)}"><option value="${KEEP}"${!choice ? " selected" : ""}>${keepLabel}</option>${targetOptions(choice)}</select></div>${setup}${ioRow}${lines}</div>`;
  }).join("");
  const unmatched = pending.unmatchedIos || [];
  document.querySelector("#import-unmatched-ios").innerHTML = unmatched.map((entry, index) => `<div class="import-assignment-row"><span><strong>${escapeHtml(entry.fileName)}</strong><small>${escapeHtml(entry.io.campaign)} · no matching campaign — choose one</small></span><select data-unmatched-io="${index}"><option value="">Choose a campaign…</option>${groups.map(group => `<option value="${escapeHtml(group.key)}">${escapeHtml(group.name)}</option>`).join("")}</select></div>`).join("");
}

function attachImportIo(groupKeyValue, io, fileName) {
  pendingValidatedImport.groupIo[groupKeyValue] = { io, fileName, mode: "totals" };
}

async function readIoFiles(files) {
  const read = [];
  for (const file of files) {
    try {
      if (!/\.pdf$/i.test(file.name)) { read.push({ file, error: "Not a PDF." }); continue; }
      const io = await readIoPdf(file);
      read.push(io.valid ? { file, io } : { file, error: io.errors.join(" ") });
    } catch (error) {
      read.push({ file, error: `Could not read this PDF: ${error.message}` });
    }
  }
  return read;
}

document.querySelector("#import-assignment-list").addEventListener("change", async event => {
  const pending = pendingValidatedImport;
  if (!pending?.result) return;
  const choice = event.target.closest("[data-group-choice]");
  if (choice) {
    const group = importGroups().find(item => item.key === choice.dataset.groupChoice);
    if (group) setGroupChoice(group, choice.value);
    renderImportAssignments();
    refreshImportAfterAssignment();
    return;
  }
  const mode = event.target.closest("[data-group-io-mode]");
  if (mode) { pending.groupIo[mode.dataset.groupIoMode].mode = mode.value; return; }
  const file = event.target.closest("[data-group-io-file]");
  if (file) {
    const [entry] = await readIoFiles([...file.files]);
    if (!entry) return;
    if (entry.error) { showToast("Insertion order", `${entry.file.name}: ${entry.error}`); return; }
    attachImportIo(file.dataset.groupIoFile, entry.io, entry.file.name);
    renderImportAssignments();
    return;
  }
  const unmatched = event.target.closest("[data-unmatched-io]");
  if (unmatched && unmatched.value) {
    const [entry] = pending.unmatchedIos.splice(Number(unmatched.dataset.unmatchedIo), 1);
    attachImportIo(unmatched.value, entry.io, entry.fileName);
    renderImportAssignments();
  }
});

document.querySelector("#import-assignment-list").addEventListener("click", event => {
  const remove = event.target.closest("[data-group-io-remove]");
  if (!remove || !pendingValidatedImport?.result) return;
  delete pendingValidatedImport.groupIo[remove.dataset.groupIoRemove];
  renderImportAssignments();
});

// Several IOs at once: each is matched to the campaign it names; the rest can be assigned by hand.
document.querySelector("#import-io-multi").addEventListener("change", async event => {
  const pending = pendingValidatedImport;
  const files = [...event.target.files];
  event.target.value = "";
  if (!pending?.result || !files.length) return;
  const groups = groupCampaigns(pending.result.campaigns);
  pending.unmatchedIos = pending.unmatchedIos || [];
  let matched = 0;
  for (const entry of await readIoFiles(files)) {
    if (entry.error) { showToast("Insertion order", `${entry.file.name}: ${entry.error}`); continue; }
    const match = findCampaignForIo(groups, {}, entry.io);
    if (match) { attachImportIo(match.key, entry.io, entry.file.name); matched += 1; }
    else pending.unmatchedIos.push({ io: entry.io, fileName: entry.file.name });
  }
  renderImportAssignments();
  showToast("Insertion orders read", `${matched} of ${files.length} matched to a campaign${pending.unmatchedIos.length ? "; choose a campaign for the rest below" : ""}.`);
});

document.querySelector("#import-assignment-list").addEventListener("input", event => {
  const field = event.target.closest("[data-setup-field]");
  if (!field || !pendingValidatedImport?.result) return;
  const key = field.dataset.setupKey;
  pendingValidatedImport.groupEdits[key] = { ...(pendingValidatedImport.groupEdits[key] || {}), [field.dataset.setupField]: field.value };
  refreshImportAfterAssignment();
});

document.querySelector("#import-assignment-list").addEventListener("toggle", event => {
  const details = event.target.closest?.("[data-setup-details]");
  if (!details || !pendingValidatedImport?.openSetup) return;
  if (details.open) pendingValidatedImport.openSetup.add(details.dataset.setupDetails); else pendingValidatedImport.openSetup.delete(details.dataset.setupDetails);
}, true);

document.querySelector("#import-assign-all").addEventListener("change", event => {
  if (!pendingValidatedImport?.result) return;
  importGroups().forEach(group => setGroupChoice(group, event.target.value));
  renderImportAssignments();
  refreshImportAfterAssignment();
});

/** After the report's rows are merged, apply each attached order to the campaign its lines ended up in. */
function applyAttachedImportIos(fileName) {
  const pending = pendingValidatedImport;
  const sizes = new Map();
  pending.result.campaigns.forEach(row => sizes.set(groupKey(row), (sizes.get(groupKey(row)) || 0) + 1));
  const applied = [];
  for (const group of importGroups()) {
    const attached = pending.groupIo?.[group.key];
    if (!attached) continue;
    const choice = groupChoice(group);
    if (choice === SKIP) continue;
    const target = choice || groupKey(rowWithGroupEdits(group.rows[0], pending.groupEdits[group.key], sizes.get(group.key)));
    const placementIds = attached.io.lineItems.filter(item => !item.addedValue).map(item => item.id);
    const result = applyIoToGroup(attached.io, attached.fileName, target, attached.mode, { selectedIds: placementIds });
    if (result) applied.push(`${result.name} (${[attached.io.orderNumber, attached.io.revision].filter(Boolean).join(" ") || attached.fileName})`);
  }
  return applied;
}

/** Applies a parsed order to a campaign, with no dialog and no restore point of its own (callers take one). */
function applyIoToGroup(io, fileName, key, mode, { selectedIds = null, setBudget = true } = {}) {
  const group = groupCampaigns(campaigns).find(item => item.key === key);
  if (!group) return null;
  const record = group.records.find(item => (item.lineItemFlights || []).length) || group.records[0];
  const index = campaigns.indexOf(record);
  if (mode === "flights") {
    const applied = applyIoToCampaign(record, io, { fileName, selectedIds, setBudget });
    campaigns[index] = applied.campaign;
    return { mode, name: group.name, applied: applied.applied };
  }
  campaignTotals = writeCampaignTotals(localStorage, setCampaignTotals(campaignTotals, key, io, fileName));
  campaigns[index] = { ...record, ioFileName: fileName || record.ioFileName || null, ioOrder: [io.orderNumber, io.revision].filter(Boolean).join("-") || record.ioOrder || null };
  return { mode, name: group.name };
}

// --- Several insertion orders at once: each is matched to a campaign, then all are applied together ---
const multiIoDialog = document.querySelector("#multi-io-dialog");
let pendingMultiIo = [];

const multiIoGroups = () => groupCampaigns(campaigns.filter(campaign => !isCampaignArchived(campaign) && (!clientScope || campaign.client === clientScope)));

async function startMultiIo(files) {
  const entries = await readIoFiles(files);
  const groups = multiIoGroups();
  pendingMultiIo = entries.map(entry => ({ ...entry, target: entry.io ? findCampaignForIo(groups, campaignTotals, entry.io)?.key || "" : "" }));
  renderMultiIo();
  multiIoDialog.showModal();
}

function renderMultiIo() {
  const groups = multiIoGroups();
  const groupLabel = group => clientScope ? group.name : `${group.client} · ${group.name}`;
  document.querySelector("#multi-io-error").hidden = true;
  document.querySelector("#multi-io-list").innerHTML = pendingMultiIo.map((entry, index) => {
    if (entry.error) return `<div class="multi-io-row error"><span><strong>${escapeHtml(entry.file.name)}</strong><small>${escapeHtml(entry.error)}</small></span><em class="preview-action replace">not read</em></div>`;
    const { io } = entry;
    const facts = [[io.orderNumber, io.revision].filter(Boolean).join(" "), io.budget ? formatExactMoney(io.budget) : "", io.startDate && io.endDate ? `${io.startDate} → ${io.endDate}` : "", `${io.lineItems.length} placement${io.lineItems.length === 1 ? "" : "s"}`].filter(Boolean).map(escapeHtml).join(" · ");
    return `<div class="multi-io-row"><span><strong>${escapeHtml(io.campaign || entry.file.name)}</strong><small>${escapeHtml(entry.file.name)} · ${facts}</small></span><select data-multi-io-target="${index}" aria-label="Campaign for ${escapeHtml(entry.file.name)}"><option value="">Choose a campaign…</option>${groups.map(group => `<option value="${escapeHtml(group.key)}"${entry.target === group.key ? " selected" : ""}>${escapeHtml(groupLabel(group))}</option>`).join("")}<option value="__skip"${entry.target === "__skip" ? " selected" : ""}>Skip this order</option></select></div>`;
  }).join("");
}

document.querySelector("#multi-io-list").addEventListener("change", event => {
  const select = event.target.closest("[data-multi-io-target]");
  if (select) pendingMultiIo[Number(select.dataset.multiIoTarget)].target = select.value;
});
document.querySelectorAll(".close-multi-io").forEach(button => button.addEventListener("click", () => multiIoDialog.close()));

document.querySelector("#multi-io-form").addEventListener("submit", event => {
  event.preventDefault();
  const error = document.querySelector("#multi-io-error");
  const chosen = pendingMultiIo.filter(entry => entry.io && entry.target && entry.target !== "__skip");
  const duplicates = chosen.filter((entry, index) => chosen.findIndex(other => other.target === entry.target) !== index);
  const problems = [];
  if (!chosen.length) problems.push("Choose a campaign for at least one order.");
  if (duplicates.length) problems.push(`Two orders are assigned to the same campaign (${duplicates.map(entry => entry.file.name).join(", ")}). Each campaign takes one order.`);
  if (problems.length) { error.textContent = problems.join(" "); error.hidden = false; return; }
  const mode = document.querySelector('input[name="multi-io-mode"]:checked')?.value || "totals";
  writeImportRollback(localStorage, createRemovalUndo({ campaigns, importHistory, campaignTotals, label: `applying ${chosen.length} insertion order${chosen.length === 1 ? "" : "s"}` }));
  const applied = chosen.map(entry => applyIoToGroup(entry.io, entry.file.name, entry.target, mode, { selectedIds: entry.io.lineItems.filter(item => !item.addedValue).map(item => item.id) })).filter(Boolean);
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  multiIoDialog.close();
  refreshAfterDataChange();
  showToast("Insertion orders applied", `${applied.length} order${applied.length === 1 ? "" : "s"} applied (${applied.map(item => item.name).join(", ")}). Use Undo to revert them together.`);
});

document.querySelector("#new-campaign-report-multi-note").addEventListener("click", event => {
  if (!event.target.closest("#new-campaign-report-multi") || !pendingReportForCreate) return;
  const { file } = pendingReportForCreate;
  createCampaignDialog.close();
  document.querySelector("#upload-button").click();
  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));
  validateButton.click();
});

// --- Create a campaign from a performance report (fills the setup form, then imports the campaign's lines) ---
let pendingReportForCreate = null;

/** Rows grouped by the campaign they belong to ("Drive To Store — Flight 1" and "— Flight 2" are one campaign). */
function groupReportRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = groupKey(row);
    if (!groups.has(key)) groups.set(key, { key, name: campaignGroupName(row), client: row.client, rows: [] });
    groups.get(key).rows.push(row);
  }
  return [...groups.values()];
}

function fillCreateFormFromGroup(group) {
  // A campaign with several lines is created under its campaign name; each line keeps the budget and numbers the report gives it.
  const row = { ...group.rows[0], name: group.rows.length > 1 ? group.name : group.rows[0].name };
  const fields = setupFieldsFromRow(row);
  const set = (selector, value) => { document.querySelector(selector).value = value ?? ""; };
  set("#new-campaign-client", fields.client);
  set("#new-campaign-name", fields.name);
  set("#new-campaign-id", fields.campaignId);
  set("#new-campaign-owner", fields.owner);
  set("#new-campaign-channel", fields.channel);
  set("#new-campaign-start", fields.startDate);
  set("#new-campaign-end", fields.endDate);
  set("#new-campaign-budget", fields.budget);
  set("#new-campaign-budget-source", "report");
  set("#new-campaign-billing-source", fields.billingSource);
  set("#new-campaign-kpi", fields.kpi);
  set("#new-campaign-target", fields.target);
  set("#new-campaign-report-cadence", fields.reportCadence);
  // A report with no flight dates should not block creating the campaign; the dates can come from an insertion order.
  const undated = !fields.startDate && !fields.endDate;
  document.querySelector("#new-campaign-start").required = !undated;
  document.querySelector("#new-campaign-end").required = !undated;
  syncBudgetSourceFields();
  renderCreateReportNote(group, undated);
}

function renderCreateReportNote(group, undated) {
  const pending = pendingReportForCreate;
  const note = document.querySelector("#new-campaign-report-multi-note");
  const others = pending.groups.length - 1;
  const parts = [];
  if (pending.groups.length > 1) parts.push(`This report holds ${pending.groups.length} campaigns. <button type="button" class="text-button" id="new-campaign-report-multi">Set up all ${pending.groups.length} campaigns from this report</button> (each with its own setup and insertion order), or create just the one selected below.`);
  parts.push(`${group.rows.length === 1 ? "The 1 line" : `All ${group.rows.length} lines`} of “${escapeHtml(group.name)}” will be imported with it${others ? `; the other ${others} campaign${others === 1 ? "" : "s"} in this report stay available to import afterwards` : ""}.`);
  if (undated) parts.push("This report has no flight dates, so they are optional here; apply an insertion order later to add them.");
  note.innerHTML = parts.join(" ");
  note.hidden = false;
}

document.querySelector("#new-campaign-report").addEventListener("change", async event => {
  const error = document.querySelector("#create-campaign-error");
  const rowLabel = document.querySelector("#new-campaign-report-row-label");
  const file = event.target.files[0];
  pendingReportForCreate = null;
  rowLabel.hidden = true;
  document.querySelector("#new-campaign-report-multi-note").hidden = true;
  document.querySelector("#new-campaign-start").required = true;
  document.querySelector("#new-campaign-end").required = true;
  error.hidden = true;
  if (!file) return;
  const fail = message => { error.textContent = message; error.hidden = false; event.target.value = ""; };
  try {
    if (file.size > 25 * 1024 * 1024) return fail("The selected file is larger than the 25 MB import limit.");
    const bytes = await file.arrayBuffer();
    const fingerprint = await fingerprintBytes(bytes);
    if (hasSuccessfulFingerprint(importHistory, fingerprint)) return fail("This exact report has already been imported. Its campaigns are already in the dashboard.");
    const report = await readReportFile(file, bytes);
    if (report.kind) return fail("That file is a daily-delivery or line-item report, which adds data to a campaign that already exists. Create the campaign first, or use a campaign summary report here.");
    const result = validateCampaignCsv(report.csvText);
    if (!result.valid) return fail(result.errors.join(" "));
    pendingReportForCreate = { file, fileName: file.name, fingerprint, rows: result.campaigns, groups: groupReportRows(result.campaigns), warnings: result.warnings };
    document.querySelector("#new-campaign-report-row").innerHTML = pendingReportForCreate.groups.map((group, index) => `<option value="${index}">${escapeHtml(group.client)} · ${escapeHtml(group.name)}${group.rows.length > 1 ? ` (${group.rows.length} lines)` : ""}</option>`).join("");
    rowLabel.hidden = pendingReportForCreate.groups.length < 2;
    fillCreateFormFromGroup(pendingReportForCreate.groups[0]);
  } catch (caught) {
    fail(`Could not read this report: ${caught.message}`);
  }
});

document.querySelector("#new-campaign-report-row").addEventListener("change", event => {
  if (pendingReportForCreate) fillCreateFormFromGroup(pendingReportForCreate.groups[Number(event.target.value)]);
});

function renderImportPreview(importedCampaigns) {
  document.querySelector("#import-preview-title").textContent = "Import impact preview";
  const mode = document.querySelector('input[name="import-mode"]:checked').value;
  const preview = previewCampaignImport(campaigns, importedCampaigns, mode);
  const container = document.querySelector("#import-preview");
  container.hidden = false;
  document.querySelector("#import-preview-mode").textContent = mode === "merge" ? "No unrelated campaigns removed" : `${preview.removed} existing campaign${preview.removed === 1 ? "" : "s"} removed`;
  document.querySelector("#import-preview-summary").innerHTML = `<div><strong>${preview.added}</strong><small>${mode === "merge" ? "Added" : "Imported"}</small></div><div><strong>${preview.updated}</strong><small>Updated</small></div><div><strong>${preview.unchanged}</strong><small>Unchanged</small></div><div class="${preview.removed ? "destructive" : ""}"><strong>${preview.removed}</strong><small>Removed</small></div>`;
  document.querySelector("#import-preview-list").innerHTML = preview.actions.slice(0, 8).map(item => `<div><span><strong>${escapeHtml(item.campaign)}</strong><small>${escapeHtml(item.client)} · ${escapeHtml(item.source || "Unknown source")}${item.campaignId ? ` · ${escapeHtml(item.campaignId)}` : ""}</small></span><em class="preview-action ${item.action}">${item.action}</em></div>`).join("") + (preview.actions.length > 8 ? `<p>${preview.actions.length - 8} more campaign changes</p>` : "");
}

function renderMappingReview(headers) {
  const review = buildMappingReview(headers);
  const container = document.querySelector("#mapping-review");
  container.hidden = false;
  container.dataset.review = JSON.stringify(review);
  document.querySelector("#mapping-review-summary").innerHTML = `<span><strong>${review.supported}</strong> supported</span><span><strong>${review.aliased}</strong> aliased</span><span class="${review.unmapped ? "warning-text" : ""}"><strong>${review.unmapped}</strong> unmapped</span>`;
  document.querySelector("#mapping-review-list").innerHTML = review.columns.map(column => `<div><span>${escapeHtml(column.source)}</span><span>→ ${escapeHtml(column.canonical)}</span><em class="mapping-status ${column.status.toLowerCase()}">${column.status}</em></div>`).join("");
}

document.querySelector("#export-mapping-review").addEventListener("click", () => {
  if (!pendingValidatedImport) return;
  const review = buildMappingReview(pendingValidatedImport.report.headers);
  const url = URL.createObjectURL(new Blob([exportMappingReviewCsv(review, pendingValidatedImport.fileName)], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `${pendingValidatedImport.fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-column-mapping.csv` });
  link.click();
  URL.revokeObjectURL(url);
});
document.querySelector("#mobile-menu").addEventListener("click", event => {
  const open = document.querySelector(".sidebar").classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(open));
});
document.querySelector("#customize-columns-button").addEventListener("click", () => {
  document.querySelectorAll('input[name="campaign-column"]').forEach(input => { input.checked = visibleColumns.includes(input.value); });
  document.querySelector("#column-settings-error").hidden = true;
  columnDialog.showModal();
});
document.querySelectorAll(".close-column-dialog").forEach(button => button.addEventListener("click", () => columnDialog.close()));
document.querySelector("#column-settings-form").addEventListener("submit", event => {
  event.preventDefault();
  const selected = [...document.querySelectorAll('input[name="campaign-column"]:checked')].map(input => input.value);
  if (!selected.length) { const error = document.querySelector("#column-settings-error"); error.textContent = "Select at least one optional column."; error.hidden = false; return; }
  visibleColumns = writeColumnPreferences(localStorage, selected);
  applyColumnVisibility();
  columnDialog.close();
});
document.querySelector("#create-campaign-button").addEventListener("click", () => {
  document.querySelector("#create-campaign-form").reset();
  document.querySelector("#create-campaign-error").hidden = true;
  pendingReportForCreate = null;
  document.querySelector("#new-campaign-start").required = true;
  document.querySelector("#new-campaign-end").required = true;
  document.querySelector("#new-campaign-report-row-label").hidden = true;
  document.querySelector("#new-campaign-report-multi-note").hidden = true;
  if (clientScope) document.querySelector("#new-campaign-client").value = clientScope;
  createCampaignDialog.showModal();
});
document.querySelectorAll(".close-create-campaign-dialog").forEach(button => button.addEventListener("click", () => createCampaignDialog.close()));
document.querySelector("#create-campaign-form").addEventListener("submit", event => {
  event.preventDefault();
  const ioFile = document.querySelector("#new-campaign-io").files[0];
  const result = createCampaign({
    client: document.querySelector("#new-campaign-client").value, name: document.querySelector("#new-campaign-name").value,
    campaignId: document.querySelector("#new-campaign-id").value, owner: document.querySelector("#new-campaign-owner").value, channel: document.querySelector("#new-campaign-channel").value,
    startDate: document.querySelector("#new-campaign-start").value, endDate: document.querySelector("#new-campaign-end").value,
    budget: document.querySelector("#new-campaign-budget").value, budgetSource: document.querySelector("#new-campaign-budget-source").value, billingSource: document.querySelector("#new-campaign-billing-source").value,
    kpi: document.querySelector("#new-campaign-kpi").value, target: document.querySelector("#new-campaign-target").value,
    reportCadence: document.querySelector("#new-campaign-report-cadence").value, ioFileName: ioFile?.name, allowUndated: Boolean(pendingReportForCreate)
  });
  const error = document.querySelector("#create-campaign-error");
  if (!result.valid) { error.textContent = result.errors.join(" "); error.hidden = false; return; }
  let withIo = result.campaign;
  let importedFromReport = null;
  if (pendingIoForCreate?.mode === "totals") {
    campaignTotals = writeCampaignTotals(localStorage, setCampaignTotals(campaignTotals, groupKey(result.campaign), pendingIoForCreate.io, pendingIoForCreate.fileName));
  } else if (pendingIoForCreate) {
    withIo = applyIoToCampaign(result.campaign, pendingIoForCreate.io, { fileName: pendingIoForCreate.fileName, selectedIds: pendingIoForCreate.selectedIds, setBudget: false }).campaign;
  }
  pendingIoForCreate = null;
  if (pendingReportForCreate) {
    // The report's numbers join the campaign as if it had been imported, with the same restore point and history entry.
    const { fileName, fingerprint, groups, warnings } = pendingReportForCreate;
    const group = groups[Number(document.querySelector("#new-campaign-report-row").value) || 0];
    const built = rowsForCreatedGroup(group.rows, { ...withIo, source: group.rows[0].source, sources: [group.rows[0].source] }, document.querySelector("#new-campaign-name").value);
    const keys = built.rows.map(campaignImportKey);
    writeImportRollback(localStorage, createImportRollback({ campaigns, importHistory, fileName, fingerprint, rowCount: built.rows.length, campaignKeys: keys }));
    campaigns.push(built.created);
    campaigns = mergeCampaignImports(campaigns, built.rows).campaigns;
    // Only the chosen campaign was imported. If the report holds others, the file must stay importable.
    const remaining = groups.length - 1;
    if (remaining > 0) recordImport(fileName, fingerprint, "Partially imported", built.rows.length, [], keys, [`${built.rows.length} line${built.rows.length === 1 ? "" : "s"} of “${group.name}” imported; ${remaining} other campaign${remaining === 1 ? "" : "s"} in this report not imported yet.`, ...warnings]);
    else recordImport(fileName, fingerprint, warnings.length ? "Imported with warnings" : "Imported", built.rows.length, [], keys, warnings);
    importedFromReport = { lines: built.rows.length, remaining, fileName };
    pendingReportForCreate = null;
  } else {
    campaigns.push(withIo);
  }
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  refreshClientFilter();
  renderCampaigns();
  createCampaignDialog.close();
  document.querySelector("#toast-title").textContent = "Campaign created";
  document.querySelector("#toast-message").textContent = importedFromReport ? `${result.campaign.name} was created with ${importedFromReport.lines} line${importedFromReport.lines === 1 ? "" : "s"} from ${importedFromReport.fileName}${importedFromReport.remaining ? `. The other ${importedFromReport.remaining} campaign${importedFromReport.remaining === 1 ? "" : "s"} in that report can still be imported.` : "."}` : `${result.campaign.name} is ready for report imports.`;
  const toast = document.querySelector("#toast"); toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 3200);
});
document.querySelector("#alert-settings-button").addEventListener("click", () => {
  document.querySelector("#under-pacing-input").value = alertRules.underPacing;
  document.querySelector("#over-pacing-input").value = alertRules.overPacing;
  document.querySelector("#discrepancy-input").value = alertRules.discrepancy;
  document.querySelector("#kpi-tolerance-input").value = alertRules.kpiTolerance;
  document.querySelector("#kpi-deterioration-input").value = alertRules.kpiDeterioration;
  document.querySelector("#stale-hours-input").value = alertRules.staleHours;
  document.querySelector("#minimum-impressions-input").value = alertRules.minimumImpressions;
  document.querySelector("#alert-settings-error").hidden = true;
  const resetAcknowledged = document.querySelector("#reset-acknowledged-alerts");
  resetAcknowledged.textContent = `Reset acknowledged alerts (${acknowledgedAlertIds.length})`;
  resetAcknowledged.disabled = acknowledgedAlertIds.length === 0;
  renderAcknowledgmentList();
  alertDialog.showModal();
});

function renderAcknowledgmentList() {
  const container = document.querySelector("#acknowledgment-list");
  container.innerHTML = acknowledgedAlertIds.length ? [...acknowledgedAlertIds].reverse().map(record => `<div><span><strong>${escapeHtml(record.id)}</strong><small>${record.acknowledgedAt ? `Acknowledged ${new Date(record.acknowledgedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : "Legacy acknowledgment"}</small></span><button class="text-button" type="button" data-restore-alert="${escapeHtml(record.id)}">Restore</button></div>`).join("") : '<p class="history-empty">No acknowledged alert conditions.</p>';
}

document.querySelector("#acknowledgment-list").addEventListener("click", event => {
  const button = event.target.closest("[data-restore-alert]");
  if (!button) return;
  acknowledgedAlertIds = removeAcknowledgment(acknowledgedAlertIds, button.dataset.restoreAlert);
  writeAcknowledgedAlerts(localStorage, acknowledgedAlertIds);
  renderAcknowledgmentList();
  document.querySelector("#reset-acknowledged-alerts").textContent = `Reset acknowledged alerts (${acknowledgedAlertIds.length})`;
  document.querySelector("#reset-acknowledged-alerts").disabled = acknowledgedAlertIds.length === 0;
  renderCampaigns(document.querySelector("#client-filter").value);
});
document.querySelectorAll(".close-alert-dialog").forEach(button => button.addEventListener("click", () => alertDialog.close()));
document.querySelector("#alert-settings-form").addEventListener("submit", event => {
  event.preventDefault();
  const result = validateAlertRules({ underPacing: document.querySelector("#under-pacing-input").value, overPacing: document.querySelector("#over-pacing-input").value, discrepancy: document.querySelector("#discrepancy-input").value, kpiTolerance: document.querySelector("#kpi-tolerance-input").value, kpiDeterioration: document.querySelector("#kpi-deterioration-input").value, staleHours: document.querySelector("#stale-hours-input").value, minimumImpressions: document.querySelector("#minimum-impressions-input").value });
  const error = document.querySelector("#alert-settings-error");
  if (!result.valid) { error.textContent = result.errors.join(" "); error.hidden = false; return; }
  alertRules = result.rules;
  localStorage.setItem("northstar-alert-rules", JSON.stringify(alertRules));
  renderCampaigns(document.querySelector("#client-filter").value);
  alertDialog.close();
});
document.querySelector("#reset-acknowledged-alerts").addEventListener("click", () => {
  acknowledgedAlertIds = [];
  writeAcknowledgedAlerts(localStorage, acknowledgedAlertIds);
  renderCampaigns(document.querySelector("#client-filter").value);
  document.querySelector("#reset-acknowledged-alerts").textContent = "Reset acknowledged alerts (0)";
  document.querySelector("#reset-acknowledged-alerts").disabled = true;
  renderAcknowledgmentList();
  document.querySelector("#toast-title").textContent = "Acknowledgments reset";
  document.querySelector("#toast-message").textContent = "Active conditions are visible in the alert queue again.";
  const toast = document.querySelector("#toast"); toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 3200);
});
document.querySelector("#campaign-rows").addEventListener("click", event => {
  const button = event.target.closest(".campaign-detail-button");
  if (!button) return;
  openCampaignDialog(Number(button.dataset.campaignIndex));
});
document.querySelectorAll(".close-campaign-dialog").forEach(button => button.addEventListener("click", () => campaignDialog.close()));
document.querySelector("#save-line-item-flight").addEventListener("click", () => {
  const result = saveLineItemFlight(campaigns[activeCampaignIndex], {
    id: document.querySelector("#line-item-id-input").value,
    name: document.querySelector("#line-item-name-input").value,
    startDate: document.querySelector("#line-item-start-input").value,
    endDate: document.querySelector("#line-item-end-input").value,
    budget: document.querySelector("#line-item-budget-input").value
  });
  const error = document.querySelector("#campaign-settings-error");
  if (!result.valid) { error.textContent = result.errors.join(" "); error.hidden = false; return; }
  campaigns[activeCampaignIndex] = result.campaign;
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  renderLineItemFlights(result.campaign);
  ["#line-item-id-input", "#line-item-name-input", "#line-item-budget-input"].forEach(selector => { document.querySelector(selector).value = ""; });
  error.hidden = true;
});
document.querySelector("#export-line-items").addEventListener("click", () => {
  const campaign = campaigns[activeCampaignIndex];
  const csv = exportLineItemFlightsCsv(campaign);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const safeName = campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "campaign";
  const link = Object.assign(document.createElement("a"), { href: url, download: `${safeName}-line-item-flights.csv` });
  link.click();
  URL.revokeObjectURL(url);
});
document.querySelector("#line-item-flight-list").addEventListener("click", event => {
  const button = event.target.closest("[data-remove-line-item]");
  if (!button) return;
  const result = removeLineItemFlight(campaigns[activeCampaignIndex], button.dataset.removeLineItem);
  if (!result.removed) return;
  campaigns[activeCampaignIndex] = result.campaign;
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  renderLineItemFlights(result.campaign);
});
document.querySelector("#line-item-import-input").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  const result = importLineItemFlightsCsv(campaigns[activeCampaignIndex], await file.text());
  const error = document.querySelector("#campaign-settings-error");
  if (!result.valid) { error.textContent = result.errors.join(" "); error.hidden = false; event.target.value = ""; return; }
  campaigns[activeCampaignIndex] = result.campaign;
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  renderLineItemFlights(result.campaign);
  error.hidden = true;
  event.target.value = "";
});
document.querySelector("#snapshot-period-select").addEventListener("change", () => renderSnapshotComparison(campaigns[activeCampaignIndex]));
document.querySelector("#export-snapshot-history").addEventListener("click", () => {
  const campaign = campaigns[activeCampaignIndex];
  if (!campaign) return;
  const url = URL.createObjectURL(new Blob([exportPerformanceSnapshotsCsv(campaign)], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `${campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-snapshot-history.csv` });
  link.click();
  URL.revokeObjectURL(url);
});
document.querySelector("#toggle-budget-revision").addEventListener("click", () => {
  const fields = document.querySelector("#budget-revision-fields");
  fields.hidden = !fields.hidden;
  document.querySelector("#toggle-budget-revision").textContent = fields.hidden ? "+ Add budget revision" : "Cancel revision";
});
document.querySelector("#export-budget-revisions").addEventListener("click", () => {
  const campaign = campaigns[activeCampaignIndex];
  if (!campaign?.budgetRevisions?.length) return;
  const url = URL.createObjectURL(new Blob([exportBudgetRevisionsCsv(campaign)], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `${campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-budget-revisions.csv` });
  link.click();
  URL.revokeObjectURL(url);
});
document.querySelector("#campaign-settings-form").addEventListener("submit", event => {
  event.preventDefault();
  if (activeCampaignIndex === null) return;
  const result = applyCampaignSettings(campaigns[activeCampaignIndex], {
    name: document.querySelector("#campaign-name-input").value,
    campaignId: document.querySelector("#campaign-id-input").value,
    owner: document.querySelector("#campaign-owner-input").value,
    channel: document.querySelector("#campaign-channel-input").value,
    billingSource: document.querySelector("#billing-source-input").value,
    reportCadence: document.querySelector("#report-cadence-input").value,
    billingCpm: document.querySelector("#billing-cpm-input").value,
    kpi: document.querySelector("#campaign-kpi-input").value,
    value: document.querySelector("#campaign-kpi-value-input").value,
    target: document.querySelector("#campaign-kpi-target-input").value
  });
  const error = document.querySelector("#campaign-settings-error");
  if (!result.valid) {
    error.textContent = result.errors.join(" ");
    error.hidden = false;
    return;
  }
  let updatedCampaign = result.campaign;
  const revisionFields = document.querySelector("#budget-revision-fields");
  if (!revisionFields.hidden) {
    const ioFile = document.querySelector("#revision-io-input").files[0];
    const revision = createBudgetRevision(updatedCampaign, {
      amount: document.querySelector("#revision-budget-input").value,
      effectiveDate: document.querySelector("#revision-date-input").value,
      fileName: ioFile?.name,
      note: document.querySelector("#revision-note-input").value
    });
    if (!revision.valid) {
      error.textContent = revision.errors.join(" ");
      error.hidden = false;
      return;
    }
    updatedCampaign = revision.campaign;
  }
  campaigns[activeCampaignIndex] = updatedCampaign;
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  renderCampaigns(document.querySelector("#client-filter").value);
  campaignDialog.close();
  document.querySelector("#toast-title").textContent = "Campaign updated";
  document.querySelector("#toast-message").textContent = "Dashboard settings saved in this browser.";
  const toast = document.querySelector("#toast");
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3200);
});

document.querySelector("#archive-campaign-button").addEventListener("click", () => {
  if (activeCampaignIndex === null) return;
  const campaign = campaigns[activeCampaignIndex];
  const archived = !isCampaignArchived(campaign);
  campaigns[activeCampaignIndex] = setCampaignArchived(campaign, archived);
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  campaignDialog.close();
  renderCampaigns(document.querySelector("#client-filter").value);
  document.querySelector("#toast-title").textContent = archived ? "Campaign archived" : "Campaign restored";
  document.querySelector("#toast-message").textContent = archived ? "The campaign was removed from operational totals and alerts." : "The campaign is active in dashboard monitoring again.";
  const toast = document.querySelector("#toast"); toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 3200);
});

function openCampaignDialog(index, alertId = null) {
  const campaign = campaigns[index];
  if (!campaign) return;
  activeCampaignIndex = index;
  activeAlertId = alertId;
  document.querySelector("#acknowledge-alert-button").hidden = !activeAlertId;
  const discrepancy = discrepancyStatus(campaign);
  document.querySelector("#campaign-dialog-client").textContent = campaign.client;
  document.querySelector("#campaign-name-input").value = campaign.name;
  document.querySelector("#campaign-id-input").value = campaign.campaignId || "";
  document.querySelector("#campaign-owner-input").value = campaign.owner || "";
  document.querySelector("#campaign-channel-input").value = campaign.channel || "";
  document.querySelector("#billing-source-input").value = ["first", "third", "reported"].includes(campaign.billingSource) ? campaign.billingSource : campaign.source.toLowerCase().includes("party") && campaign.source.startsWith("1") ? "first" : campaign.source.toLowerCase().includes("cm") ? "third" : "reported";
  document.querySelector("#report-cadence-input").value = campaign.reportCadence || "none";
  document.querySelector("#billing-cpm-input").value = Number.isFinite(campaign.billingCpm) ? campaign.billingCpm : "";
  document.querySelector("#campaign-kpi-input").value = campaign.kpi;
  document.querySelector("#campaign-kpi-value-input").value = campaign.value;
  document.querySelector("#campaign-kpi-target-input").value = campaign.target.replace(/^Target\s*/i, "");
  document.querySelector("#archive-campaign-button").textContent = isCampaignArchived(campaign) ? "Restore campaign" : "Archive campaign";
  document.querySelector("#detail-first-spend").textContent = formatMoney(resolveSpend(campaign, "first"));
  document.querySelector("#detail-third-spend").textContent = formatMoney(resolveSpend(campaign, "third"));
  const variance = document.querySelector("#detail-variance");
  variance.textContent = discrepancy.absoluteDifference === null ? discrepancy.label : `${discrepancy.label} · ${formatMoney(discrepancy.absoluteDifference)}`;
  variance.className = discrepancy.flagged ? "detail-variance flagged" : "detail-variance";
  const pacing = calculateSpendPacing({ ...campaign, spend: resolveSpend(campaign, "billing") });
  document.querySelector("#detail-expected-spend").textContent = pacing ? formatMoney(pacing.expectedSpend) : "Add flight dates";
  document.querySelector("#detail-projected-spend").textContent = pacing?.projectedSpend === null || !pacing ? "—" : formatMoney(pacing.projectedSpend);
  document.querySelector("#detail-flight-progress").textContent = pacing ? `${Math.round(pacing.timeElapsed * 100)}% · ${pacing.elapsedDays}/${pacing.totalDays} days` : "—";
  const componentMetrics = [
    ["Impressions", campaign.impressions, formatCount], ["Clicks", campaign.clicks, formatCount],
    ["Conversions", campaign.conversions, formatCount], ["Revenue", campaign.revenue, formatMoney],
    ["Video starts", campaign.videoStarts, formatCount], ["Video completions", campaign.videoCompletions, formatCount]
  ].filter(([, value]) => Number.isFinite(value));
  const componentSection = document.querySelector("#component-metrics-section");
  componentSection.hidden = componentMetrics.length === 0;
  document.querySelector("#component-metrics").innerHTML = componentMetrics.map(([label, value, formatter]) => `<div><span>${label}</span><strong>${formatter(value)}</strong></div>`).join("");
  document.querySelector("#kpi-calculation-note").textContent = campaign.reportedValue && campaign.reportedValue !== campaign.value ? `${campaign.kpi}: ${campaign.value} calculated · ${campaign.reportedValue} reported` : "Source components retained for audit";
  const calculatedKpis = calculateAvailableKpis({ ...campaign, spend: resolveSpend(campaign, "billing") });
  document.querySelector("#calculated-kpis").innerHTML = calculatedKpis.map(metric => `<div><span>${metric.metric}</span><strong>${escapeHtml(metric.formatted)}</strong></div>`).join("");
  document.querySelector("#calculated-kpis-group").hidden = calculatedKpis.length === 0;
  document.querySelector("#snapshot-period-select").value = "previous";
  renderSnapshotComparison(campaign);
  renderSnapshotHistory(campaign);
  renderDailyDelivery(campaign);
  const latestRevision = latestBudgetRevision(campaign);
  const revisions = campaign.budgetRevisions?.length || 0;
  document.querySelector("#current-budget-value").textContent = hasBudget(campaign) ? formatMoney(campaign.budget) : "Not set";
  document.querySelector("#budget-revision-meta").textContent = latestRevision ? `${revisions} revision${revisions === 1 ? "" : "s"} · Latest effective ${latestRevision.effectiveDate}` : "No budget revisions recorded";
  renderBudgetRevisionHistory(campaign);
  document.querySelector("#budget-revision-fields").hidden = true;
  document.querySelector("#toggle-budget-revision").textContent = "+ Add budget revision";
  document.querySelector("#revision-budget-input").value = hasBudget(campaign) ? campaign.budget : "";
  document.querySelector("#revision-date-input").value = "";
  document.querySelector("#revision-note-input").value = "";
  document.querySelector("#revision-io-input").value = "";
  document.querySelector("#campaign-settings-error").hidden = true;
  document.querySelector("#line-item-import-input").value = "";
  document.querySelector("#line-item-start-input").value = campaign.startDate || "";
  document.querySelector("#line-item-end-input").value = campaign.endDate || "";
  renderLineItemFlights(campaign);
  renderIoTotalsNote(campaign);
  campaignDialog.showModal();
}

// --- Insertion order (PDF) review: parse in the browser, confirm, then apply ---
const ioReviewDialog = document.querySelector("#io-review-dialog");
let pendingIo = null;
let pendingIoForCreate = null;

async function startIoReview(file, mode) {
  const status = document.querySelector(mode === "create" ? "#create-campaign-error" : "#campaign-settings-error");
  status.hidden = true;
  // Client pages have no inline error area, so problems there are shown as a notice.
  const fail = message => {
    if (mode === "client") { showToast("Insertion order", message); return; }
    status.textContent = message;
    status.hidden = false;
  };
  if (!/\.pdf$/i.test(file.name)) {
    if (mode === "create") pendingIoForCreate = null;
    if (mode === "client") fail("Choose the insertion order as a PDF.");
    return;
  }
  if (file.size > 25 * 1024 * 1024) { fail("The insertion order is larger than the 25 MB limit."); return; }
  try {
    const io = await readIoPdf(file);
    if (!io.valid) { fail(io.errors.join(" ")); if (mode === "create") pendingIoForCreate = null; return; }
    pendingIo = { io, fileName: file.name, mode };
    renderIoReview();
    ioReviewDialog.showModal();
  } catch (error) {
    fail(`Could not read this PDF: ${error.message}`);
  }
}

const ioTargetGroups = () => groupCampaigns(campaigns.filter(campaign => !isCampaignArchived(campaign) && (!clientScope || campaign.client === clientScope)));

/** The campaign group the order will be applied to, or null when it will start a new campaign. */
function ioTargetGroupKey() {
  if (pendingIo.mode === "details") return campaigns[activeCampaignIndex] ? groupKey(campaigns[activeCampaignIndex]) : null;
  if (pendingIo.mode === "client") {
    const value = document.querySelector("#io-review-target").value;
    return value === "__new" ? null : value;
  }
  return null;
}

function syncIoDefaultMode() {
  // Campaigns that already have report data are paced on the order's totals by default, so IO placements never fight report lines.
  const key = ioTargetGroupKey();
  const group = key ? groupCampaigns(campaigns).find(item => item.key === key) : null;
  const hasReports = Boolean(group?.records.some(record => Number(record.spend) > 0));
  const defaultMode = pendingIo.mode === "create" || !group || hasReports ? "totals" : "flights";
  document.querySelectorAll('input[name="io-mode"]').forEach(radio => { radio.checked = radio.value === defaultMode; });
}

function renderIoReview() {
  const { io, mode } = pendingIo;
  const money = value => formatExactMoney(value);
  document.querySelector("#io-review-subtitle").textContent = [io.advertiser, io.campaign].filter(Boolean).join(" · ");
  const facts = [["Agency", io.agency], ["Order", [io.orderNumber, io.revision].filter(Boolean).join(" ") || "—"], ["Flight", io.startDate && io.endDate ? `${io.startDate} → ${io.endDate}` : "—"], ["Budget", io.budget ? money(io.budget) : "—"], ["Placements", String(io.lineItems.length)]];
  document.querySelector("#io-review-facts").innerHTML = facts.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "—")}</strong></div>`).join("");
  const warnings = document.querySelector("#io-review-warnings");
  warnings.hidden = io.warnings.length === 0;
  warnings.innerHTML = io.warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join("");
  document.querySelector("#io-review-lines").innerHTML = io.lineItems.map(item => `<label class="io-review-line"><input type="checkbox" name="io-line" value="${escapeHtml(item.id)}"${item.addedValue ? "" : " checked"} /><span class="io-line-name"><strong>${escapeHtml(item.name)}</strong><small>${item.startDate ? escapeHtml(item.startDate) : "—"} → ${item.endDate ? escapeHtml(item.endDate) : "—"}${item.rate ? ` · ${escapeHtml(item.rateType || "")} $${Number(item.rate).toFixed(2)}` : ""}${item.units ? ` · ${formatCount(item.units)} ${escapeHtml(item.unit || "units").toLowerCase()}` : ""}${item.kpi ? ` · ${escapeHtml(item.kpi)}` : ""}</small></span><b>${money(item.budget)}</b></label>`).join("");
  document.querySelector("#io-review-budget-label").textContent = io.budget ? `Set the campaign budget to ${money(io.budget)} (recorded as a budget revision)` : "";
  document.querySelector("#io-review-error").hidden = true;
  // Client pages let you pick which campaign the order belongs to (or start a new one) and spot revisions of an applied order.
  const targetLabel = document.querySelector("#io-review-target-label");
  const note = document.querySelector("#io-review-match-note");
  targetLabel.hidden = mode !== "client";
  note.hidden = true;
  if (mode === "client") {
    const groups = ioTargetGroups();
    const match = findCampaignForIo(groups, campaignTotals, io);
    document.querySelector("#io-review-target").innerHTML = `${groups.map(group => `<option value="${escapeHtml(group.key)}"${match?.key === group.key ? " selected" : ""}>${escapeHtml(clientScope ? group.name : `${group.client} · ${group.name}`)}</option>`).join("")}<option value="__new"${match ? "" : " selected"}>＋ Create a new campaign from this order</option>`;
    note.hidden = false;
    note.textContent = !match ? `No ${clientScope ? `${clientScope} ` : ""}campaign matches this order, so a new campaign is selected. Choose an existing campaign if it belongs to one.`
      : match.reason === "order" ? (match.isRevision ? `This looks like a revision of order ${match.appliedOrder}, already applied to this campaign. Applying it updates the campaign.` : `Order ${match.appliedOrder} was already applied to this campaign; applying it again refreshes the same values.`)
        : "Matched to this campaign by name. Change it below if that is wrong.";
  }
  syncIoDefaultMode();
  syncIoMode();
  updateIoSelection();
}

const currentIoMode = () => document.querySelector('input[name="io-mode"]:checked')?.value || "flights";

function syncIoMode() {
  const totalsMode = currentIoMode() === "totals";
  const startsNew = pendingIo?.mode === "create" || (pendingIo?.mode === "client" && !ioTargetGroupKey());
  document.querySelector(".io-review-card").classList.toggle("totals-mode", totalsMode);
  const budgetToggle = document.querySelector("#io-review-set-budget");
  budgetToggle.closest("label").hidden = startsNew || !(pendingIo?.io.budget > 0);
  budgetToggle.checked = true;
  document.querySelector("#io-review-apply").textContent = startsNew ? (pendingIo?.mode === "client" ? "Create campaign" : "Use these details") : totalsMode ? "Use order totals" : "Apply to campaign";
}
document.querySelectorAll('input[name="io-mode"]').forEach(radio => radio.addEventListener("change", syncIoMode));
document.querySelector("#io-review-target").addEventListener("change", () => { syncIoDefaultMode(); syncIoMode(); });

function updateIoSelection() {
  const boxes = [...document.querySelectorAll('input[name="io-line"]')];
  const checked = boxes.filter(box => box.checked);
  const total = pendingIo.io.lineItems.filter(item => checked.some(box => box.value === item.id)).reduce((sum, item) => sum + item.budget, 0);
  document.querySelector("#io-review-selection").textContent = `${checked.length} of ${boxes.length} placements selected · ${formatExactMoney(total)}`;
  document.querySelector("#io-review-select-all").checked = checked.length === boxes.length;
}

document.querySelector("#io-review-lines").addEventListener("change", updateIoSelection);
document.querySelector("#io-review-select-all").addEventListener("change", event => {
  document.querySelectorAll('input[name="io-line"]').forEach(box => { box.checked = event.target.checked; });
  updateIoSelection();
});
document.querySelectorAll(".close-io-review").forEach(button => button.addEventListener("click", () => { ioReviewDialog.close(); if (pendingIo?.mode === "create") pendingIoForCreate = null; }));

function prefillCreateFromIo(io, fileName, selectedIds, ioMode, client = null) {
  const fields = campaignFieldsFromIo(io, fileName);
  const set = (selector, value) => { document.querySelector(selector).value = value ?? ""; };
  set("#new-campaign-client", client || fields.client);
  set("#new-campaign-name", fields.name);
  set("#new-campaign-start", fields.startDate);
  set("#new-campaign-end", fields.endDate);
  set("#new-campaign-budget", fields.budget);
  set("#new-campaign-budget-source", "io");
  syncBudgetSourceFields();
  pendingIoForCreate = { io, fileName, selectedIds, mode: ioMode };
}

document.querySelector("#io-review-form").addEventListener("submit", event => {
  event.preventDefault();
  const selectedIds = [...document.querySelectorAll('input[name="io-line"]:checked')].map(box => box.value);
  const ioMode = currentIoMode();
  if (ioMode === "flights" && !selectedIds.length) {
    const error = document.querySelector("#io-review-error");
    error.textContent = "Select at least one placement.";
    error.hidden = false;
    return;
  }
  const { io, fileName, mode } = pendingIo;
  const targetKey = mode === "client" ? ioTargetGroupKey() : null;
  if (mode === "create") {
    prefillCreateFromIo(io, fileName, selectedIds, ioMode);
    ioReviewDialog.close();
    return;
  }
  if (mode === "client" && !targetKey) {
    // A new campaign: open the setup form pre-filled from the order, still for this client.
    ioReviewDialog.close();
    document.querySelector("#create-campaign-button").click();
    prefillCreateFromIo(io, fileName, selectedIds, ioMode, clientScope);
    return;
  }
  if (mode === "client") {
    const group = groupCampaigns(campaigns).find(item => item.key === targetKey);
    const record = group?.records.find(item => (item.lineItemFlights || []).length) || group?.records[0];
    activeCampaignIndex = record ? campaigns.indexOf(record) : null;
  }
  if (activeCampaignIndex === null || !campaigns[activeCampaignIndex]) return;
  const orderLabel = [io.orderNumber, io.revision].filter(Boolean).join(" ") || fileName;
  const targetName = campaignGroupName(campaigns[activeCampaignIndex]);
  // Applying an order can change budgets and flights, so it gets a restore point like any other change.
  writeImportRollback(localStorage, createRemovalUndo({ campaigns, importHistory, campaignTotals, label: `applying order ${orderLabel} to ${targetName}` }));
  if (ioMode === "totals") {
    const record = campaigns[activeCampaignIndex];
    campaignTotals = writeCampaignTotals(localStorage, setCampaignTotals(campaignTotals, groupKey(record), io, fileName));
    campaigns[activeCampaignIndex] = { ...record, ioFileName: fileName || record.ioFileName || null, ioOrder: [io.orderNumber, io.revision].filter(Boolean).join("-") || record.ioOrder || null };
    localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
    ioReviewDialog.close();
    renderIoTotalsNote(campaigns[activeCampaignIndex]);
    renderCampaigns(document.querySelector("#client-filter").value);
    renderUndoButton();
    const appliedEntry = campaignTotals[groupKey(campaigns[activeCampaignIndex])];
    showToast("Order totals applied", `Pacing now uses ${appliedEntry.orders.length > 1 ? `${appliedEntry.orders.length} orders totalling ` : "the "}${formatExactMoney(appliedEntry.budget)} across ${targetName}'s lines.`);
    return;
  }
  const applied = applyIoToCampaign(campaigns[activeCampaignIndex], io, { fileName, selectedIds, setBudget: document.querySelector("#io-review-set-budget").checked });
  campaigns[activeCampaignIndex] = applied.campaign;
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  ioReviewDialog.close();
  refreshBudgetAndFlights(applied.campaign);
  renderCampaigns(document.querySelector("#client-filter").value);
  renderUndoButton();
  showToast("Insertion order applied", `${applied.applied} placement${applied.applied === 1 ? "" : "s"} saved as line-item flights${applied.revised ? " and the budget was updated" : ""}.`);
});

document.querySelector("#client-io-button").addEventListener("click", () => document.querySelector("#client-io-input").click());
document.querySelector("#client-io-input").addEventListener("change", async event => {
  const files = [...event.target.files];
  event.target.value = "";
  if (files.length === 1) await startIoReview(files[0], "client");
  else if (files.length > 1) await startMultiIo(files);
});

function renderIoTotalsNote(campaign) {
  const note = document.querySelector("#io-totals-note");
  const entry = campaignTotals[groupKey(campaign)];
  note.hidden = !entry;
  if (!entry) return;
  const many = entry.orders.length > 1;
  note.innerHTML = `Pacing for this campaign uses ${many ? `${entry.orders.length} orders totalling` : "the order total"} ${escapeHtml(formatExactMoney(entry.budget))}${entry.startDate && entry.endDate ? ` · ${escapeHtml(entry.startDate)} → ${escapeHtml(entry.endDate)}` : ""}<span class="io-order-chips">${entry.orders.map(order => `<span class="io-order-chip">${escapeHtml(order.order || order.fileName || "Order")} · ${escapeHtml(formatExactMoney(order.budget))}<button type="button" data-remove-order="${escapeHtml(order.order || "")}" aria-label="Remove order ${escapeHtml(order.order || order.fileName || "")}" title="Remove this order">×</button></span>`).join("")}</span><button type="button" id="remove-io-totals">${many ? "Remove all" : "Remove"}</button>`;
}

document.querySelector("#io-totals-note").addEventListener("click", event => {
  const oneOrder = event.target.closest("[data-remove-order]");
  if (!(oneOrder || event.target.closest("#remove-io-totals")) || activeCampaignIndex === null) return;
  const record = campaigns[activeCampaignIndex];
  const key = groupKey(record);
  writeImportRollback(localStorage, createRemovalUndo({ campaigns, importHistory, campaignTotals, label: oneOrder ? `removing order ${oneOrder.dataset.removeOrder} from ${campaignGroupName(record)}` : `removing the insertion orders from ${campaignGroupName(record)}` }));
  campaignTotals = writeCampaignTotals(localStorage, oneOrder ? removeOrderFromTotals(campaignTotals, key, oneOrder.dataset.removeOrder) : removeCampaignTotals(campaignTotals, key));
  renderIoTotalsNote(record);
  renderCampaigns(document.querySelector("#client-filter").value);
  renderUndoButton();
});

function refreshBudgetAndFlights(campaign) {
  renderIoTotalsNote(campaign);
  const latestRevision = latestBudgetRevision(campaign);
  const revisions = campaign.budgetRevisions?.length || 0;
  document.querySelector("#current-budget-value").textContent = hasBudget(campaign) ? formatMoney(campaign.budget) : "Not set";
  document.querySelector("#budget-revision-meta").textContent = latestRevision ? `${revisions} revision${revisions === 1 ? "" : "s"} · Latest effective ${latestRevision.effectiveDate}` : "No budget revisions recorded";
  renderBudgetRevisionHistory(campaign);
  renderLineItemFlights(campaign);
}

document.querySelector("#io-pdf-input").addEventListener("change", async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (file) await startIoReview(file, "details");
});
document.querySelector("#new-campaign-io").addEventListener("change", async event => {
  pendingIoForCreate = null;
  const file = event.target.files[0];
  if (file) await startIoReview(file, "create");
});

function renderBudgetRevisionHistory(campaign) {
  const revisions = budgetRevisionHistory(campaign);
  document.querySelector("#export-budget-revisions").disabled = revisions.length === 0;
  document.querySelector("#budget-revision-list").innerHTML = revisions.length ? revisions.map(revision => `<div><span><strong>Revision ${revision.revisionNumber} · ${escapeHtml(revision.effectiveDate)}</strong><small>${escapeHtml(revision.fileName)}${revision.note ? ` · ${escapeHtml(revision.note)}` : ""}</small></span><span><strong>${formatExactMoney(revision.amount)}</strong><small>from ${formatExactMoney(revision.previousBudget)}</small></span></div>`).join("") : '<p class="history-empty">No budget revisions recorded.</p>';
}

function renderLineItemFlights(campaign) {
  const flights = campaign.lineItemFlights || [];
  const summary = summarizeLineItemBudgets(campaign);
  document.querySelector("#line-item-flight-count").textContent = flights.length ? `${flights.length} flight${flights.length === 1 ? "" : "s"}` : "No flights";
  document.querySelector("#export-line-items").disabled = flights.length === 0;
  const summaryElement = document.querySelector("#line-item-budget-summary");
  summaryElement.textContent = summary.campaignBudget === null ? `${formatExactMoney(summary.allocated)} allocated` : summary.fullyAllocated ? `${formatExactMoney(summary.allocated)} fully allocated` : `${formatExactMoney(summary.allocated)} allocated · ${formatExactMoney(summary.remaining)} remaining`;
  summaryElement.className = summary.fullyAllocated ? "allocation-complete" : "";
  document.querySelector("#line-item-flight-list").innerHTML = flights.map(flight => `<div><span><strong>${escapeHtml(flight.name)}</strong><small>${escapeHtml(flight.id)} · ${escapeHtml(flight.startDate)} – ${escapeHtml(flight.endDate)}</small></span><span class="line-item-actions"><b>${formatExactMoney(flight.budget)}</b><button type="button" data-remove-line-item="${escapeHtml(flight.id)}" aria-label="Remove ${escapeHtml(flight.name)}">×</button></span></div>`).join("");
}

function renderSnapshotComparison(campaign) {
  const selected = document.querySelector("#snapshot-period-select").value;
  const snapshotComparison = compareLatestSnapshots(campaign, selected === "previous" ? null : Number(selected));
  const snapshotSection = document.querySelector("#snapshot-comparison-section");
  snapshotSection.hidden = !snapshotComparison;
  if (!snapshotComparison) return;
  document.querySelector("#snapshot-comparison-period").textContent = `${snapshotComparison.previous.date} to ${snapshotComparison.latest.date} · ${snapshotComparison.latest.source}`;
  const comparisonMetrics = [["Spend", snapshotComparison.changes.spend, formatExactMoney], ["Impressions", snapshotComparison.changes.impressions, formatCount], ["Clicks", snapshotComparison.changes.clicks, formatCount], ["Conversions", snapshotComparison.changes.conversions, formatCount]].filter(([, value]) => value !== null);
  document.querySelector("#snapshot-comparison-metrics").innerHTML = comparisonMetrics.map(([label, value, formatter]) => `<div><span>${label}</span><strong>${value >= 0 ? "+" : ""}${formatter(value)}</strong></div>`).join("");
}

function renderDailyDelivery(campaign) {
  const rows = Object.entries(campaign.dailyDelivery || {}).flatMap(([source, days]) => Object.entries(days).map(([date, metrics]) => ({ source, date, ...metrics }))).sort((a, b) => b.date.localeCompare(a.date) || a.source.localeCompare(b.source));
  document.querySelector("#daily-delivery-section").hidden = rows.length === 0;
  document.querySelector("#daily-delivery-remove").innerHTML = Object.keys(campaign.dailyDelivery || {}).map(source => `<button class="text-button" type="button" data-remove-daily="${escapeHtml(source)}">Remove ${escapeHtml(source)} data</button>`).join("");
  document.querySelector("#daily-delivery-list").innerHTML = rows.slice(0, 14).map(row => `<div><span><strong>${escapeHtml(row.date)}</strong><small>${escapeHtml(row.source)}</small></span><span><strong>${Number.isFinite(row.spend) ? formatExactMoney(row.spend) : "—"}</strong><small>${Number.isFinite(row.impressions) ? `${formatCount(row.impressions)} impressions` : "No impressions"}${Number.isFinite(row.clicks) ? ` · ${formatCount(row.clicks)} clicks` : ""}</small></span></div>`).join("");
}

document.querySelector("#export-daily-delivery").addEventListener("click", () => {
  const campaign = campaigns[activeCampaignIndex];
  if (!campaign) return;
  const url = URL.createObjectURL(new Blob([exportDailyDeliveryCsv(campaign)], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `${campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-daily-delivery.csv` });
  link.click();
  URL.revokeObjectURL(url);
});

function renderSnapshotHistory(campaign) {
  const snapshots = campaignSnapshotHistory(campaign);
  document.querySelector("#export-snapshot-history").disabled = snapshots.length === 0;
  document.querySelector("#snapshot-history-list").innerHTML = snapshots.length ? snapshots.slice(0, 10).map(snapshot => `<div><span><strong>${escapeHtml(snapshot.date)}</strong><small>${escapeHtml(snapshot.source)}</small></span><span><strong>${Number.isFinite(snapshot.spend) ? formatExactMoney(snapshot.spend) : "—"}</strong><small>${Number.isFinite(snapshot.impressions) ? `${formatCount(snapshot.impressions)} impressions` : "Spend snapshot"}</small></span><button class="campaign-line-remove" type="button" data-remove-snapshot="${escapeHtml(snapshot.date)}|${escapeHtml(snapshot.source)}" aria-label="Remove ${escapeHtml(snapshot.date)} ${escapeHtml(snapshot.source)} report" title="Remove this report">✕</button></div>`).join("") : '<p class="history-empty">No dated report snapshots are available yet.</p>';
}

function showValidationResult(messages, type, exportIssues = messages) {
  validationResult.className = `validation-result ${type}`;
  validationResult.innerHTML = `<strong>${type === "error" ? "We found an issue" : "Validation complete"}</strong><ul>${messages.map(message => `<li>${escapeHtml(message)}</li>`).join("")}</ul>`;
  validationResult.hidden = false;
  currentValidationIssues = [...exportIssues];
  const exportButton = document.querySelector("#export-validation-issues");
  exportButton.hidden = currentValidationIssues.length === 0;
  exportButton.textContent = type === "error" ? "Download validation errors" : "Download validation warnings";
}

document.querySelector("#export-validation-issues").addEventListener("click", () => {
  if (!currentValidationIssues.length) return;
  const severity = validationResult.classList.contains("error") ? "error" : "warning";
  const name = selectedFile?.name || "report";
  const url = URL.createObjectURL(new Blob([exportValidationIssuesCsv(name, currentValidationIssues, severity)], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `${name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-validation-${severity}s.csv` });
  link.click();
  URL.revokeObjectURL(url);
});

function resetImportForm() {
  fileInput.form?.reset();
  fileInput.value = "";
  selectedFile = null;
  document.querySelector("#file-name").textContent = "";
  filePreview.hidden = true;
  validationResult.hidden = true;
  document.querySelector("#import-preview").hidden = true;
  document.querySelector("#mapping-review").hidden = true;
  document.querySelector("#import-assignments").hidden = true;
  document.querySelector(".import-mode").hidden = false;
  currentValidationIssues = [];
  document.querySelector("#export-validation-issues").hidden = true;
  validateButton.disabled = true;
  validateButton.textContent = "Validate report";
  confirmImportButton.disabled = true;
  pendingValidatedImport = null;
  document.querySelector('input[name="import-mode"][value="merge"]').checked = true;
}

function campaignImportKey(campaign) {
  const identity = campaign.campaignId || campaign.name;
  return [campaign.client, identity, campaign.source].map(value => String(value ?? "").trim().toLowerCase()).join("::");
}

function recordImport(fileName, fingerprint, status, rowCount = 0, errors = [], campaignKeys = [], warnings = []) {
  importHistory = addImportRecord(importHistory, createImportRecord({ fileName, fingerprint, status, rowCount, errors, campaignKeys, warnings }));
  writeImportHistory(localStorage, importHistory);
  renderImportHistory();
  renderDataHealth();
}

function renderImportHistory() {
  const container = document.querySelector("#import-history");
  document.querySelector("#export-import-history").disabled = importHistory.length === 0;
  document.querySelector("#undo-last-import").disabled = !readImportRollback(localStorage);
  renderUndoButton();
  if (!importHistory.length) {
    container.innerHTML = '<p class="history-empty">No reports have been processed in this browser.</p>';
    return;
  }
  container.innerHTML = importHistory.slice(0, 3).map(record => {
    const date = new Date(record.importedAt);
    const statusClass = record.status.toLowerCase().replace(/\s+/g, "-");
    const imported = ["Imported", "Imported with warnings", "Partially imported"].includes(record.status);
    const detail = imported ? `${record.rowCount} row${record.rowCount === 1 ? "" : "s"}${record.warnings?.[0] ? ` · ${record.warnings[0]}` : ""}` : record.status === "Superseded" ? "Replaced by a corrected report" : record.status === "Reverted" ? record.warnings?.[0] || "Import was undone" : record.errors[0] || "No data changed";
    return `<div class="history-item"><span class="history-file">▤</span><span><strong>${escapeHtml(record.fileName)}</strong><small>${escapeHtml(detail)} · ${date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</small></span><em class="history-status ${statusClass}">${record.status}</em></div>`;
  }).join("");
}

// --- Undo (multi-step) and removals ---
function showToast(title, message) {
  document.querySelector("#toast-title").textContent = title;
  document.querySelector("#toast-message").textContent = message;
  const toast = document.querySelector("#toast");
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3600);
}

function renderUndoButton() {
  const stack = readUndoStack(localStorage);
  const button = document.querySelector("#undo-action");
  button.hidden = stack.length === 0;
  if (stack.length) {
    const label = undoLabel(stack[0]);
    button.textContent = `↶ Undo${stack.length > 1 ? ` (${stack.length})` : ""}`;
    button.title = `Undo ${label}`;
    button.setAttribute("aria-label", `Undo ${label}`);
  }
}

function refreshAfterDataChange() {
  selectedLines.clear();
  refreshClientFilter();
  renderCampaigns(document.querySelector("#client-filter").value);
  renderImportHistory();
  renderDataHealth();
  renderUndoButton();
}

function performUndo() {
  const rollback = readImportRollback(localStorage);
  if (!rollback || !window.confirm(`Undo ${undoLabel(rollback)} and restore the previous campaign data?`)) return;
  const restored = applyImportRollback(rollback);
  campaigns = restored.campaigns;
  importHistory = restored.importHistory;
  if (restored.campaignTotals) campaignTotals = writeCampaignTotals(localStorage, restored.campaignTotals);
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  writeImportHistory(localStorage, importHistory);
  clearImportRollback(localStorage);
  refreshAfterDataChange();
  if (activeCampaignIndex !== null && campaignDialog.open && !campaigns[activeCampaignIndex]) campaignDialog.close();
  showToast(rollback.kind === "removal" ? "Removal undone" : "Import undone", rollback.kind === "removal" ? "The removed data was restored." : "Campaign data was restored to its pre-import state.");
}

document.querySelector("#undo-last-import").addEventListener("click", performUndo);
document.querySelector("#undo-action").addEventListener("click", performUndo);

/** Takes a restore point, applies the removal, saves, and refreshes. Everything removed here can be undone. */
function applyRemoval(label, confirmText, mutate) {
  if (!window.confirm(`${confirmText}\n\nYou can undo this from the Undo button.`)) return false;
  writeImportRollback(localStorage, createRemovalUndo({ campaigns, importHistory, campaignTotals, label }));
  mutate();
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  refreshAfterDataChange();
  showToast("Removed", `${label.charAt(0).toUpperCase()}${label.slice(1)}. Use Undo to bring it back.`);
  return true;
}

function dropOrphanTotals(key) {
  if (campaignTotals[key] && !campaigns.some(campaign => groupKey(campaign) === key)) campaignTotals = writeCampaignTotals(localStorage, removeCampaignTotals(campaignTotals, key));
}

document.querySelector("#campaign-list-rows").addEventListener("click", event => {
  const removeCampaign = event.target.closest("[data-remove-campaign]");
  if (removeCampaign) {
    const key = removeCampaign.dataset.removeCampaign;
    const group = lastCampaignGroups.find(item => item.key === key);
    if (!group) return;
    applyRemoval(`removing the ${group.name} campaign`, `Remove the campaign “${group.name}” (${group.records.length} line${group.records.length === 1 ? "" : "s"}) and all of its imported data and report history?`, () => {
      campaigns = removeGroupRecords(campaigns, key);
      dropOrphanTotals(key);
    });
    return;
  }
  const removeLine = event.target.closest("[data-remove-line]");
  if (!removeLine) return;
  const index = Number(removeLine.dataset.removeLine);
  const record = campaigns[index];
  if (!record) return;
  const { lineKind, lineId, lineName } = removeLine.dataset;
  if (lineKind === "record") {
    applyRemoval(`removing ${lineName}`, `Remove the line “${lineName}” and its imported data and report history from this campaign?`, () => {
      const key = groupKey(record);
      campaigns = removeRecordAt(campaigns, index);
      dropOrphanTotals(key);
    });
  } else {
    applyRemoval(`removing ${lineName}`, `Remove “${lineName}” from this campaign?`, () => { campaigns[index] = removeLineItem(record, lineId); });
  }
});

// Removing individual reports (dated snapshots) and daily-delivery sources from a campaign's details.
document.querySelector("#snapshot-history-list").addEventListener("click", event => {
  const button = event.target.closest("[data-remove-snapshot]");
  if (!button || activeCampaignIndex === null) return;
  const [date, source] = button.dataset.removeSnapshot.split("|");
  const record = campaigns[activeCampaignIndex];
  const done = applyRemoval(`removing the ${date} ${source} report from ${record.name}`, `Remove the ${date} ${source} report from “${record.name}”?${record.dataAsOf === date ? " This is the newest report, so the campaign goes back to the previous report's numbers." : ""}`, () => { campaigns[activeCampaignIndex] = removeSnapshot(record, date, source); });
  if (done) { renderSnapshotHistory(campaigns[activeCampaignIndex]); renderDailyDelivery(campaigns[activeCampaignIndex]); }
});

document.querySelector("#daily-delivery-remove").addEventListener("click", event => {
  const button = event.target.closest("[data-remove-daily]");
  if (!button || activeCampaignIndex === null) return;
  const source = button.dataset.removeDaily;
  const record = campaigns[activeCampaignIndex];
  const done = applyRemoval(`removing ${source} daily data from ${record.name}`, `Remove all ${source} daily delivery data (and its report history) from “${record.name}”?`, () => { campaigns[activeCampaignIndex] = removeDailySource(record, source); });
  if (done) { renderSnapshotHistory(campaigns[activeCampaignIndex]); renderDailyDelivery(campaigns[activeCampaignIndex]); }
});



function renderImportAudit() {
  const summary = summarizeImportAudit(importHistory);
  const records = filterImportAudit(importHistory, { status: document.querySelector("#import-audit-status").value, query: document.querySelector("#import-audit-search").value });
  document.querySelector("#import-audit-summary").innerHTML = `<div><strong>${summary.total}</strong><small>Retained</small></div><div><strong>${summary.successful}</strong><small>Successful</small></div><div class="${summary.attention ? "destructive" : ""}"><strong>${summary.attention}</strong><small>Needs attention</small></div><div><strong>${summary.historical}</strong><small>Historical</small></div>`;
  document.querySelector("#import-audit-list").innerHTML = records.length ? records.map(record => {
    const detail = [...(record.errors || []), ...(record.warnings || [])].join(" · ") || `${record.rowCount || 0} campaign row${record.rowCount === 1 ? "" : "s"}`;
    const fingerprint = String(record.fingerprint || "Unavailable");
    return `<article><div><strong>${escapeHtml(record.fileName)}</strong><span class="history-status ${record.status.toLowerCase().replace(/\s+/g, "-")}">${escapeHtml(record.status)}</span></div><p>${escapeHtml(detail)}</p><small>${new Date(record.importedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · ${escapeHtml(fingerprint.slice(0, 12))}${fingerprint.length > 12 ? "…" : ""}</small>${record.supersededBy ? `<small>Superseded by ${escapeHtml(record.supersededBy)}</small>` : ""}</article>`;
  }).join("") : '<p class="history-empty">No import records match these filters.</p>';
}

document.querySelector("#view-import-audit").addEventListener("click", () => {
  document.querySelector("#import-audit-search").value = "";
  document.querySelector("#import-audit-status").value = "all";
  renderImportAudit();
  importAuditDialog.showModal();
});
document.querySelector("#import-audit-search").addEventListener("input", renderImportAudit);
document.querySelector("#import-audit-status").addEventListener("change", renderImportAudit);

document.querySelector("#export-import-history").addEventListener("click", () => {
  if (!importHistory.length) return;
  const url = URL.createObjectURL(new Blob([exportImportHistoryCsv(importHistory)], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `northstar-import-audit-${new Date().toISOString().slice(0, 10)}.csv` });
  link.click();
  URL.revokeObjectURL(url);
});

function renderAlerts(visibleCampaigns) {
  const alerts = unacknowledgedAlerts(evaluateAlerts(visibleCampaigns), acknowledgedAlertIds);
  currentVisibleAlerts = alerts;
  document.querySelector("#export-alerts-button").disabled = alerts.length === 0;
  const critical = alerts.filter(alert => alert.severity === "critical").length;
  document.querySelector("#alert-count").textContent = alerts.length;
  document.querySelector("#alert-summary").innerHTML = `<span class="warning-text">${critical} critical</span><span>across ${new Set(alerts.map(alert => alert.campaign.name)).size} campaigns</span>`;
  document.querySelector("#nav-alert-count").textContent = alerts.length;
  document.querySelector("#alert-list").innerHTML = alerts.length ? alerts.slice(0, 3).map(alert => `<button class="alert-item" data-alert-id="${escapeHtml(alert.id)}" data-campaign-index="${campaigns.indexOf(alert.campaign)}" aria-label="Open ${escapeHtml(alert.campaign.name)}: ${escapeHtml(alert.title)}"><span class="alert-symbol ${alert.severity}">${alert.symbol}</span><span><strong>${escapeHtml(alert.title)}</strong><small>${escapeHtml(alert.campaign.client)} · ${escapeHtml(alert.campaign.name)}</small><em>${escapeHtml(alert.detail)}</em></span><span class="chevron">›</span></button>`).join("") : '<p class="no-alerts">No active alerts for these campaigns.</p>';
}

document.querySelector("#export-alerts-button").addEventListener("click", () => {
  if (!currentVisibleAlerts.length) return;
  const url = URL.createObjectURL(new Blob([exportAlertsCsv(currentVisibleAlerts)], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `northstar-active-alerts-${new Date().toISOString().slice(0, 10)}.csv` });
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#alert-list").addEventListener("click", event => {
  const alert = event.target.closest(".alert-item[data-campaign-index]");
  if (alert) openCampaignDialog(Number(alert.dataset.campaignIndex), alert.dataset.alertId);
});

document.querySelector("#acknowledge-alert-button").addEventListener("click", () => {
  if (!activeAlertId) return;
  const alert = currentVisibleAlerts.find(item => item.id === activeAlertId);
  acknowledgedAlertIds = acknowledgeAlert(acknowledgedAlertIds, alert || activeAlertId);
  writeAcknowledgedAlerts(localStorage, acknowledgedAlertIds);
  campaignDialog.close();
  renderCampaigns(document.querySelector("#client-filter").value);
  document.querySelector("#toast-title").textContent = "Alert acknowledged";
  document.querySelector("#toast-message").textContent = "The alert was removed from the active exception list.";
  const toast = document.querySelector("#toast"); toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 3200);
});

function renderDataHealth() {
  const health = evaluateDataHealth(importHistory);
  const card = document.querySelector("#data-health-card");
  card.dataset.state = health.state;
  document.querySelector("#data-health-title").textContent = health.title;
  document.querySelector("#data-health-detail").textContent = health.detail;
  document.querySelector("#data-health-sync").textContent = health.lastSync;
}

refreshClientFilter();
applyDashboardView(dashboardView);
renderDataHealth();
renderCampaigns();

// --- Report folder auto-pull (File System Access API; Chrome and Edge) ---
let folderRoot = null;
let folderTimer = null;
let folderSyncRunning = false;
const folderStatus = document.querySelector("#folder-sync-status");

function setFolderStatus(message) {
  folderStatus.textContent = message;
}

function renderFolderReview() {
  const items = reviewItems(readLedger(localStorage));
  document.querySelector("#folder-review-list").innerHTML = items.map(item => `<div class="folder-review-item"><span><strong>${escapeHtml(item.path)}</strong><small>${escapeHtml(item.reason || "Needs review")}</small></span><button class="text-button" type="button" data-review-path="${escapeHtml(item.path)}">Review</button></div>`).join("");
}

document.querySelector("#folder-review-list").addEventListener("click", async event => {
  const button = event.target.closest("[data-review-path]");
  if (!button || !folderRoot) return;
  try {
    const handle = await resolveFileHandle(folderRoot, button.dataset.reviewPath);
    const transfer = new DataTransfer();
    transfer.items.add(await handle.getFile());
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    validateButton.click();
  } catch (error) {
    setFolderStatus(`Could not open ${button.dataset.reviewPath}: ${error.message}`);
  }
});

async function folderPermission(request = false) {
  if (!folderRoot) return false;
  if (await folderRoot.queryPermission({ mode: "read" }) === "granted") return true;
  return request && await folderRoot.requestPermission({ mode: "read" }) === "granted";
}

function showFolderControls() {
  const connected = Boolean(folderRoot);
  document.querySelector("#folder-connect").hidden = connected;
  document.querySelector("#folder-sync-now").hidden = !connected;
  document.querySelector("#folder-disconnect").hidden = !connected;
}

async function runFolderSync({ interactive = false } = {}) {
  if (folderSyncRunning || !folderRoot) return;
  if (!await folderPermission(interactive)) {
    setFolderStatus(`Allow access to “${folderRoot.name}” to resume syncing.`);
    document.querySelector("#folder-sync-now").textContent = "Allow access & sync";
    return;
  }
  document.querySelector("#folder-sync-now").textContent = "Sync now";
  folderSyncRunning = true;
  setFolderStatus(`Scanning “${folderRoot.name}”…`);
  const originalCampaigns = campaigns;
  const originalHistory = importHistory;
  let working = campaigns;
  let ledger = readLedger(localStorage);
  const counts = { imported: 0, review: 0, skipped: 0 };
  const appliedKeys = [];
  let appliedRows = 0;
  try {
    const listed = await listReportFiles(folderRoot);
    const files = await Promise.all(listed.map(async item => ({ ...item, file: await item.handle.getFile() })));
    files.sort((a, b) => a.file.lastModified - b.file.lastModified);
    for (const { path, file } of files) {
      const key = ledgerKey(path, file);
      if (isProcessed(ledger, key)) continue;
      const entry = { key, path, status: "skipped", reason: "", fingerprint: "", at: new Date().toISOString() };
      if (file.size > 25 * 1024 * 1024) {
        entry.reason = "Larger than the 25 MB import limit.";
      } else {
        const bytes = await file.arrayBuffer();
        entry.fingerprint = await fingerprintBytes(bytes);
        if (ledger.some(item => item.fingerprint === entry.fingerprint && item.status === "imported") || hasSuccessfulFingerprint(importHistory, entry.fingerprint)) {
          entry.status = "duplicate";
          entry.reason = "Identical to a report that was already imported.";
        } else {
          try {
            const plan = planAutoImport(await readReportFile(file, bytes), working);
            if (plan.status === "apply") {
              working = plan.campaigns;
              appliedKeys.push(...plan.campaignKeys);
              appliedRows += plan.rowCount;
              entry.status = "imported";
              recordImport(path, entry.fingerprint, plan.warnings.length ? "Imported with warnings" : "Imported", plan.rowCount, [], plan.campaignKeys, plan.warnings);
            } else {
              entry.status = plan.status;
              entry.reason = plan.reason;
            }
          } catch (error) {
            entry.status = "skipped";
            entry.reason = error.message;
          }
        }
      }
      if (entry.status === "imported") counts.imported += 1;
      else if (entry.status === "review") counts.review += 1;
      else counts.skipped += 1;
      ledger = addLedgerEntries(ledger, [entry]);
    }
    if (counts.imported) {
      writeImportRollback(localStorage, createImportRollback({ campaigns: originalCampaigns, importHistory: originalHistory, fileName: `${counts.imported} report${counts.imported === 1 ? "" : "s"} from ${folderRoot.name}`, fingerprint: `folder-sync-${Date.now().toString(16)}`, rowCount: appliedRows, campaignKeys: appliedKeys }));
      campaigns = working;
      localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
      refreshClientFilter();
      renderCampaigns(document.querySelector("#client-filter").value);
      renderImportHistory();
      document.querySelector("#toast-title").textContent = "Folder sync complete";
      document.querySelector("#toast-message").textContent = `${counts.imported} report${counts.imported === 1 ? "" : "s"} imported${counts.review ? `, ${counts.review} need review` : ""}.`;
      const toast = document.querySelector("#toast");
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 3200);
    }
    writeLedger(localStorage, ledger);
    renderFolderReview();
    setFolderStatus(`Last sync ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${counts.imported} imported · ${counts.review} need review · ${counts.skipped} skipped or already imported.`);
  } catch (error) {
    setFolderStatus(`Sync failed: ${error.message}`);
  } finally {
    folderSyncRunning = false;
  }
}

document.querySelector("#folder-connect").addEventListener("click", async () => {
  try {
    folderRoot = await window.showDirectoryPicker({ id: "northstar-reports", mode: "read" });
    await saveFolderHandle(folderRoot);
    showFolderControls();
    startFolderTimer();
    await runFolderSync({ interactive: true });
  } catch (error) {
    if (error.name !== "AbortError") setFolderStatus(`Could not connect the folder: ${error.message}`);
  }
});
document.querySelector("#folder-sync-now").addEventListener("click", () => runFolderSync({ interactive: true }));
document.querySelector("#folder-disconnect").addEventListener("click", async () => {
  clearInterval(folderTimer);
  folderRoot = null;
  await clearFolderHandle();
  showFolderControls();
  setFolderStatus("Folder disconnected. Reports already imported stay in the dashboard.");
});

function startFolderTimer() {
  clearInterval(folderTimer);
  folderTimer = setInterval(() => runFolderSync(), SYNC_INTERVAL_MS);
}

async function initFolderSync() {
  if (!folderSyncSupported()) {
    document.querySelector("#folder-connect").hidden = true;
    setFolderStatus("Folder auto-pull needs Chrome or Edge. Manual import still works in every browser.");
    return;
  }
  renderFolderReview();
  try {
    folderRoot = await loadFolderHandle() || null;
  } catch {
    folderRoot = null;
  }
  showFolderControls();
  if (!folderRoot) return;
  startFolderTimer();
  await runFolderSync();
}

initFolderSync();
