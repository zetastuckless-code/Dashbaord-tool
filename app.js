import { escapeHtml, validateCampaignCsv } from "./lib/importer.js";
import { addImportRecord, createImportRecord, exportImportHistoryCsv, fingerprintBytes, hasSuccessfulFingerprint, readImportHistory, writeImportHistory } from "./lib/import-history.js";
import { discrepancyStatus, resolveSpend } from "./lib/source-comparison.js";
import { applyCampaignSettings } from "./lib/campaign-settings.js";
import { budgetRevisionHistory, createBudgetRevision, exportBudgetRevisionsCsv, latestBudgetRevision } from "./lib/budget-revisions.js";
import { DEFAULT_ALERT_RULES, evaluateCampaignAlerts, validateAlertRules } from "./lib/alert-engine.js";
import { createCampaign } from "./lib/campaign-creation.js";
import { readColumnPreferences, writeColumnPreferences } from "./lib/column-preferences.js";
import { readReportFile } from "./lib/workbook-import.js";
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
import { applyImportRollback, clearImportRollback, createImportRollback, readImportRollback, writeImportRollback } from "./lib/import-rollback.js";
import { buildMappingReview, exportMappingReviewCsv } from "./lib/mapping-review.js";
import { filterImportAudit, summarizeImportAudit } from "./lib/import-audit.js";
import { readSavedViews, removeNamedView, saveNamedView, writeSavedViews } from "./lib/saved-views.js";
import { resetWorkspaceStorage } from "./lib/workspace-reset.js";

const sampleCampaigns = [
  { client: "Apex Athletics", owner: "Jordan Davis", channel: "Display", short: "AA", className: "apex", name: "Always On · Retargeting", spend: 184200, firstPartySpend: 184200, thirdPartySpend: 179600, billingSource: "1st party", budget: 240000, pacing: 112, kpi: "CPA", value: "$48.20", target: "Target $36.50", source: "1st party", updated: "8 min ago" },
  { client: "Apex Athletics", owner: "Jordan Davis", channel: "Video", short: "AA", className: "apex", name: "Fall Video · Prospecting", spend: 221400, firstPartySpend: 216800, thirdPartySpend: 221400, billingSource: "CM360", budget: 380000, pacing: 101, kpi: "VCR", value: "74.8%", target: "Target 70%", source: "CM360", updated: "8 min ago" },
  { client: "Lumon Home", owner: "Morgan Lee", channel: "Display", short: "LH", className: "lumon", name: "Fall Product Launch", spend: 146800, firstPartySpend: 128500, thirdPartySpend: 146800, billingSource: "CM360", budget: 280000, pacing: 79, kpi: "ROAS", value: "4.2×", target: "Target 3.5×", source: "CM360", updated: "1 hr ago" },
  { client: "Nova Finance", owner: "Taylor Kim", channel: "Display", short: "NF", className: "nova", name: "Q3 Brand Awareness", spend: 131800, firstPartySpend: 131800, thirdPartySpend: 113100, billingSource: "1st party", budget: 340000, pacing: 96, kpi: "CTR", value: "0.82%", target: "Target 0.75%", source: "1st party", updated: "24 min ago" }
];

let campaigns = loadCampaigns();
let importHistory = readImportHistory(localStorage);
let selectedSource = "billing";
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
const formatCount = value => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

function renderCampaigns(filter = "all", statusFilter = document.querySelector("#status-filter")?.value || "all", ownerFilter = document.querySelector("#owner-filter")?.value || "all", channelFilter = document.querySelector("#channel-filter")?.value || "all", query = document.querySelector("#campaign-search")?.value || "") {
  const matchingRows = filterCampaigns(campaigns, { client: filter, status: statusFilter, owner: ownerFilter, channel: channelFilter, query });
  const activeAlerts = unacknowledgedAlerts(evaluateCampaignAlerts(matchingRows, alertRules), acknowledgedAlertIds);
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
      <td data-column="budget">${formatMoney(campaign.budget)}</td>
      <td data-column="pacing" class="pacing-cell"><div class="pacing-value"><strong>${pacingLabel}${pacing === null ? "" : "%"}</strong><span>${pacingStatus}</span></div><div class="mini-track ${pacingWarning ? "warn" : ""}"><span style="width:${Math.min(pacing || 0, 100)}%"></span></div></td>
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
  const budget = activeRows.reduce((sum, item) => sum + item.budget, 0);
  const comparablePeriodRows = period === "current" ? activeRows : activeRows.filter(item => periodSpend(item, period) !== null);
  const spend = period === "current" ? activeRows.reduce((sum, item) => sum + resolveSpend(item, selectedSource), 0) : comparablePeriodRows.reduce((sum, item) => sum + periodSpend(item, period), 0);
  document.querySelector("#budget-value").textContent = formatMoney(budget);
  document.querySelector("#spend-value").textContent = formatMoney(spend);
  document.querySelector("#spend-metric-label").textContent = period === "current" ? "Spend to date" : `Spend · last ${period} days`;
  const utilization = spend / budget * 100 || 0;
  document.querySelector("#spend-progress").style.width = period === "current" ? `${Math.min(utilization, 100)}%` : "0%";
  document.querySelector("#utilization-value").textContent = period === "current" ? `${utilization.toFixed(1)}% utilized` : `${comparablePeriodRows.length} campaign${comparablePeriodRows.length === 1 ? "" : "s"} with history`;
  document.querySelector("#remaining-value").textContent = period === "current" ? `${formatMoney(Math.max(budget - spend, 0))} remaining` : "Reported-source change";
  const portfolio = calculatePortfolioPacing(activeRows.map(campaign => ({ ...campaign, spend: resolveSpend(campaign, "billing") })));
  const portfolioValue = document.querySelector("#portfolio-pacing-value");
  const portfolioStatus = document.querySelector("#portfolio-pacing-status");
  portfolioValue.textContent = portfolio.pacing === null ? "—" : `${portfolio.pacing.toFixed(1)}%`;
  portfolioStatus.textContent = portfolio.pacing === null ? "No pacing data" : portfolio.pacing > alertRules.overPacing ? "Above plan" : portfolio.pacing < alertRules.underPacing ? "Below plan" : "On track";
  portfolioStatus.className = `status-pill ${portfolio.pacing !== null && (portfolio.pacing > alertRules.overPacing || portfolio.pacing < alertRules.underPacing) ? "warning" : "good"}`;
  document.querySelector("#portfolio-pacing-target").textContent = `Target: ${alertRules.underPacing}–${alertRules.overPacing}%`;
  applyColumnVisibility();
  renderAlerts(rows);
}

function renderSpendChart(visibleCampaigns) {
  const points = buildPortfolioSpendTrend(visibleCampaigns, { spendView: selectedSource }).filter(point => point.actual !== null);
  currentSpendTrend = points;
  document.querySelector("#export-spend-trend").disabled = points.length === 0;
  const chart = document.querySelector("#spend-chart");
  const empty = document.querySelector("#spend-chart-empty");
  const hasTrend = points.length >= 2;
  const sourceLabel = { billing: "Billing", first: "1st-party", third: "3rd-party" }[selectedSource];
  const coverage = points.at(-1);
  document.querySelector("#spend-chart-context").textContent = coverage ? `${sourceLabel} spend vs. plan · ${coverage.historyCampaigns}/${coverage.totalCampaigns} campaigns with history` : `${sourceLabel} spend vs. plan across active campaigns`;
  chart.hidden = !hasTrend;
  empty.hidden = hasTrend;
  document.querySelector("#spend-chart-x-axis").hidden = !hasTrend;
  document.querySelector("#spend-chart-y-axis").hidden = !hasTrend;
  if (!hasTrend) return;
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
  if (!currentSpendTrend.length) return;
  const url = URL.createObjectURL(new Blob([exportPortfolioSpendTrendCsv(currentSpendTrend, selectedSource)], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `northstar-spend-trend-${selectedSource}-${new Date().toISOString().slice(0, 10)}.csv` });
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
  const activeAlerts = unacknowledgedAlerts(evaluateCampaignAlerts(matching, alertRules), acknowledgedAlertIds);
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
  const backup = createWorkspaceBackup({ campaigns, importHistory, alertRules, visibleColumns, acknowledgedAlerts: acknowledgedAlertIds, dashboardView, savedViews });
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
  renderImportHistory();
  dialog.showModal();
}));
const fileInput = document.querySelector("#file-input");
const filePreview = document.querySelector("#file-preview");
const validateButton = document.querySelector("#validate-button");
const confirmImportButton = document.querySelector("#confirm-import-button");
const validationResult = document.querySelector("#validation-result");
fileInput.addEventListener("change", () => {
  if (!fileInput.files.length) return;
  pendingValidatedImport = null;
  confirmImportButton.disabled = true;
  document.querySelector("#import-preview").hidden = true;
  document.querySelector("#mapping-review").hidden = true;
  validationResult.hidden = true;
  const file = fileInput.files[0];
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
  fileInput.value = "";
  filePreview.hidden = true;
  validationResult.hidden = true;
  validateButton.disabled = true;
  confirmImportButton.disabled = true;
  pendingValidatedImport = null;
  document.querySelector("#import-preview").hidden = true;
  document.querySelector("#mapping-review").hidden = true;
});
document.querySelectorAll('input[name="import-mode"]').forEach(input => input.addEventListener("change", () => {
  if (pendingValidatedImport) renderImportPreview(pendingValidatedImport.result.campaigns);
}));
validateButton.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  validateButton.disabled = true;
  validateButton.textContent = "Validating…";
  document.querySelector("#import-preview").hidden = true;
  document.querySelector("#mapping-review").hidden = true;
  const fileBytes = await file.arrayBuffer();
  const fingerprint = await fingerprintBytes(fileBytes);
  if (hasSuccessfulFingerprint(importHistory, fingerprint)) {
    recordImport(file.name, fingerprint, "Duplicate", 0, ["This exact report has already been imported."]);
    showValidationResult(["This exact report has already been imported. No dashboard data was changed."], "error");
    validateButton.textContent = "Validate report";
    validateButton.disabled = false;
    return;
  }
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
  const result = validateCampaignCsv(report.csvText);
  validateButton.textContent = "Validate report";
  if (!result.valid) {
    recordImport(file.name, fingerprint, "Rejected", 0, result.errors);
    showValidationResult(result.errors, "error");
    validateButton.disabled = false;
    return;
  }
  pendingValidatedImport = { fileName: file.name, fingerprint, report, result };
  confirmImportButton.disabled = false;
  renderImportPreview(result.campaigns);
  renderMappingReview(report.headers);
  const location = report.worksheet ? `${report.worksheet}, header row ${report.headerRow}` : `header row ${report.headerRow}`;
  const mappingSummary = report.headerMappings.length ? ` ${report.headerMappings.length} source column alias${report.headerMappings.length === 1 ? " was" : "es were"} mapped automatically.` : "";
  showValidationResult([`${result.campaigns.length} campaign row${result.campaigns.length === 1 ? "" : "s"} passed validation from ${location}.${mappingSummary} Review warnings and choose Import validated report to continue.`, ...result.warnings], "success", result.warnings);
});
confirmImportButton.addEventListener("click", () => {
  if (!pendingValidatedImport) return;
  const { fileName, fingerprint, result } = pendingValidatedImport;
  const importMode = document.querySelector('input[name="import-mode"]:checked').value;
  const mergeResult = previewCampaignImport(campaigns, result.campaigns, importMode);
  writeImportRollback(localStorage, createImportRollback({ campaigns, importHistory, fileName, fingerprint, rowCount: result.campaigns.length, campaignKeys: result.campaigns.map(campaignImportKey) }));
  campaigns = mergeResult.campaigns;
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  const importStatus = result.warnings.length ? "Imported with warnings" : "Imported";
  recordImport(fileName, fingerprint, importStatus, result.campaigns.length, [], result.campaigns.map(campaignImportKey), result.warnings);
  refreshClientFilter();
  renderCampaigns();
  document.querySelector("#toast-message").textContent = `${result.campaigns.length} campaign row${result.campaigns.length === 1 ? "" : "s"} imported successfully.`;
  document.querySelector("#toast-title").textContent = "Report imported";
  setTimeout(() => {
    dialog.close();
    const toast = document.querySelector("#toast");
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3200);
    resetImportForm();
  }, 550);
});

function renderImportPreview(importedCampaigns) {
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
    budget: document.querySelector("#new-campaign-budget").value, billingSource: document.querySelector("#new-campaign-billing-source").value,
    kpi: document.querySelector("#new-campaign-kpi").value, target: document.querySelector("#new-campaign-target").value,
    reportCadence: document.querySelector("#new-campaign-report-cadence").value, ioFileName: ioFile?.name
  });
  const error = document.querySelector("#create-campaign-error");
  if (!result.valid) { error.textContent = result.errors.join(" "); error.hidden = false; return; }
  campaigns.push(result.campaign);
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  refreshClientFilter();
  renderCampaigns();
  createCampaignDialog.close();
  document.querySelector("#toast-title").textContent = "Campaign created";
  document.querySelector("#toast-message").textContent = `${result.campaign.name} is ready for report imports.`;
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
  const latestRevision = latestBudgetRevision(campaign);
  const revisions = campaign.budgetRevisions?.length || 0;
  document.querySelector("#current-budget-value").textContent = formatMoney(campaign.budget);
  document.querySelector("#budget-revision-meta").textContent = latestRevision ? `${revisions} revision${revisions === 1 ? "" : "s"} · Latest effective ${latestRevision.effectiveDate}` : "No budget revisions recorded";
  renderBudgetRevisionHistory(campaign);
  document.querySelector("#budget-revision-fields").hidden = true;
  document.querySelector("#toggle-budget-revision").textContent = "+ Add budget revision";
  document.querySelector("#revision-budget-input").value = campaign.budget;
  document.querySelector("#revision-date-input").value = "";
  document.querySelector("#revision-note-input").value = "";
  document.querySelector("#revision-io-input").value = "";
  document.querySelector("#campaign-settings-error").hidden = true;
  document.querySelector("#line-item-import-input").value = "";
  document.querySelector("#line-item-start-input").value = campaign.startDate || "";
  document.querySelector("#line-item-end-input").value = campaign.endDate || "";
  renderLineItemFlights(campaign);
  campaignDialog.showModal();
}

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

function renderSnapshotHistory(campaign) {
  const snapshots = campaignSnapshotHistory(campaign);
  document.querySelector("#export-snapshot-history").disabled = snapshots.length === 0;
  document.querySelector("#snapshot-history-list").innerHTML = snapshots.length ? snapshots.slice(0, 10).map(snapshot => `<div><span><strong>${escapeHtml(snapshot.date)}</strong><small>${escapeHtml(snapshot.source)}</small></span><span><strong>${Number.isFinite(snapshot.spend) ? formatExactMoney(snapshot.spend) : "—"}</strong><small>${Number.isFinite(snapshot.impressions) ? `${formatCount(snapshot.impressions)} impressions` : "Spend snapshot"}</small></span></div>`).join("") : '<p class="history-empty">No dated report snapshots are available yet.</p>';
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
  fileInput.value = "";
  filePreview.hidden = true;
  validationResult.hidden = true;
  document.querySelector("#import-preview").hidden = true;
  document.querySelector("#mapping-review").hidden = true;
  currentValidationIssues = [];
  document.querySelector("#export-validation-issues").hidden = true;
  validateButton.disabled = true;
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
  if (!importHistory.length) {
    container.innerHTML = '<p class="history-empty">No reports have been processed in this browser.</p>';
    return;
  }
  container.innerHTML = importHistory.slice(0, 3).map(record => {
    const date = new Date(record.importedAt);
    const statusClass = record.status.toLowerCase().replace(/\s+/g, "-");
    const imported = ["Imported", "Imported with warnings"].includes(record.status);
    const detail = imported ? `${record.rowCount} row${record.rowCount === 1 ? "" : "s"}${record.warnings?.[0] ? ` · ${record.warnings[0]}` : ""}` : record.status === "Superseded" ? "Replaced by a corrected report" : record.status === "Reverted" ? record.warnings?.[0] || "Import was undone" : record.errors[0] || "No data changed";
    return `<div class="history-item"><span class="history-file">▤</span><span><strong>${escapeHtml(record.fileName)}</strong><small>${escapeHtml(detail)} · ${date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</small></span><em class="history-status ${statusClass}">${record.status}</em></div>`;
  }).join("");
}

document.querySelector("#undo-last-import").addEventListener("click", () => {
  const rollback = readImportRollback(localStorage);
  if (!rollback || !window.confirm(`Undo the import of ${rollback.fileName} and restore the previous campaign data?`)) return;
  const restored = applyImportRollback(rollback);
  campaigns = restored.campaigns;
  importHistory = restored.importHistory;
  localStorage.setItem("northstar-campaigns", JSON.stringify(campaigns));
  writeImportHistory(localStorage, importHistory);
  clearImportRollback(localStorage);
  refreshClientFilter();
  renderCampaigns();
  renderImportHistory();
  renderDataHealth();
  document.querySelector("#toast-title").textContent = "Import undone";
  document.querySelector("#toast-message").textContent = "Campaign data was restored to its pre-import state.";
  const toast = document.querySelector("#toast"); toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 3200);
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
  const alerts = unacknowledgedAlerts(evaluateCampaignAlerts(visibleCampaigns, alertRules), acknowledgedAlertIds);
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
