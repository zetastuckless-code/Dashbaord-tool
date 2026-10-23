import { escapeHtml, validateCampaignCsv } from "./lib/importer.js";
import { addImportRecord, createImportRecord, exportImportHistoryCsv, fingerprintBytes, hasSuccessfulFingerprint, readImportHistory, writeImportHistory } from "./lib/import-history.js";
import { discrepancyStatus, resolveSpend } from "./lib/source-comparison.js";
import { applyCampaignSettings } from "./lib/campaign-settings.js";
import { budgetRevisionHistory, createBudgetRevision, exportBudgetRevisionsCsv, latestBudgetRevision } from "./lib/budget-revisions.js";
import { DEFAULT_ALERT_RULES, evaluateCampaignAlerts, validateAlertRules } from "./lib/alert-engine.js";
import { createCampaign } from "./lib/campaign-creation.js";
import { readColumnPreferences } from "./lib/column-preferences.js";
import { DOCUMENT_KINDS, listClientDocuments, removeClientDocument } from "./lib/client-documents.js";
import { makeUpload } from "./lib/uploads.js";
import { readReportFile, rowsToCsv } from "./lib/workbook-import.js";
import { evaluateDataHealth } from "./lib/data-health.js";
import { calculatePortfolioPacing, calculateSpendPacing, campaignFlightStatus, effectivePacing } from "./lib/spend-pacing.js";
import { calculateAvailableKpis } from "./lib/metric-calculations.js";
import { dashboardFlightStatus, filterCampaigns } from "./lib/campaign-filters.js";
import { acknowledgeAlert, readAcknowledgedAlerts, removeAcknowledgment, unacknowledgedAlerts, writeAcknowledgedAlerts } from "./lib/alert-acknowledgments.js";
import { exportCampaignsCsv } from "./lib/dashboard-export.js";
import { campaignSnapshotHistory, compareLatestSnapshots, exportPerformanceSnapshotsCsv, periodMetrics, periodSpend } from "./lib/performance-snapshots.js";
import { sortCampaigns } from "./lib/campaign-sort.js";
import { filterCampaignsByAttention } from "./lib/campaign-attention.js";
import { DEFAULT_DASHBOARD_VIEW, readDashboardView, writeDashboardView } from "./lib/dashboard-view.js";
import { aggregateKpiView } from "./lib/kpi-view.js";
import { buildPortfolioSpendTrend, exportPortfolioSpendTrendCsv } from "./lib/portfolio-trend.js";
import { exportAlertsCsv } from "./lib/alert-export.js";
import { exportValidationIssuesCsv } from "./lib/validation-export.js";
import { isCampaignArchived, setCampaignArchived } from "./lib/campaign-archive.js";
import { createWorkspaceBackup, restoreWorkspaceBackup, validateWorkspaceBackup } from "./lib/workspace-backup.js";
import { loadFolderHandle, readProcessedFiles, readTodoFolder, saveFolderHandle, TODO_FILES_KEY } from "./lib/todo-folder.js";
import { findNewReports, noteReport, openReportAt, readReportInbox, readReportLedger, readReportSettings, REPORT_INBOX_KEY, REPORT_LEDGER_KEY, REPORT_SETTINGS_KEY } from "./lib/report-folder.js";
import { applyBrief, AUTOMATION_KEY, BRIEF_KEY, INTERNAL, isOpen, mergeTodos, morningScanPrompt, readAutomationSettings, parseTodoFile, pruneTodos, readBrief, readTodos, setTodoDone, sortTodos, todoTemplate, writeTodos } from "./lib/client-todos.js";
import { previewCampaignImport } from "./lib/import-preview.js";
import { applyImportRollback, clearImportRollback, createImportRollback, createRemovalUndo, readImportRollback, readUndoStack, undoLabel, writeImportRollback } from "./lib/import-rollback.js";
import { removeDailySource, removeGroupRecords, removeLineItem, removeRecordAt, removeSnapshot } from "./lib/campaign-removal.js";
import { buildMappingReview, exportMappingReviewCsv } from "./lib/mapping-review.js";
import { filterImportAudit, summarizeImportAudit } from "./lib/import-audit.js";
import { readSavedViews, removeNamedView, saveNamedView, writeSavedViews } from "./lib/saved-views.js";
import { resetWorkspaceStorage } from "./lib/workspace-reset.js";
import { purgeDemoCampaigns } from "./lib/demo-purge.js";
import { applyDailyDelivery, exportDailyDeliveryCsv } from "./lib/daily-delivery-import.js";
import { buildClientRollup } from "./lib/client-rollup.js";
import { readIoPdf } from "./lib/io-reader.js";
import { activeRowsWithPooled, budgetUnits, readCampaignTotals, removeCampaignTotals, removeOrderFromTotals, setCampaignTotals, setTotalsFlight, unitsBudget, unitsPacing, writeCampaignTotals } from "./lib/campaign-totals.js";
import { campaignPlacements, matchLinesToPlacements } from "./lib/line-flights.js";
import { buildClientIoSummary } from "./lib/client-io.js";
import { applyIoPlan, ioLines, recordLineLabel } from "./lib/io-plan.js";
import { applyCampaignStatus, CAMPAIGN_ORDER_KEY, CAMPAIGN_STATUS_KEY, moveCampaign, orderGroups, readCampaignOrder, readCampaignStatus, setCampaignStatus } from "./lib/campaign-order.js";
import { filterUploads, groupUploads, listAllUploads, summarizeUploads, UPLOAD_KIND_OPTIONS } from "./lib/data-sources.js";
import { buildPacingDetail, DEFAULT_PACING_RANGE, PACING_RANGES } from "./lib/pacing-detail.js";
import { auditLine } from "./lib/line-audit.js";
import { campaignGroupName, groupKey, isPlaceholder } from "./lib/campaign-groups.js";
import { dailyPacingView } from "./lib/daily-pacing.js";
import { applyBulkEdits, lineKey, validateBulkEdits } from "./lib/bulk-edit.js";
import { findCampaignForIo } from "./lib/io-match.js";
import { pacingBand } from "./lib/client-rollup.js";
import { applyAssignments, assignmentKey, initialChoices, KEEP, lineLabel, readAssignments, rememberAssignments, removeFilledShells, SKIP, suggestCampaigns } from "./lib/import-assignment.js";
import { applySetupEdits, setupFieldsFromRow, validateSetupEdits } from "./lib/new-campaign-setup.js";
import { computeMetrics, formatMetric, MAX_ROW_METRICS, METRIC_CATALOG, metricLabel } from "./lib/metric-catalog.js";
import { groupCampaigns } from "./lib/campaign-groups.js";
import { metricsForCampaign, readMetricPrefs, reorderMetrics, resetCampaignMetrics, setCampaignMetrics, writeMetricPrefs } from "./lib/campaign-metric-prefs.js";
import { importClients, markImportsReviewed, pendingImportReviews, readReviewedImports } from "./lib/report-review.js";
import { readOnboarding, setupProgress, writeOnboarding } from "./lib/onboarding.js";
import { deleteRawRows, readRawRows, saveRawRows } from "./lib/raw-delivery-store.js";
import { clearDeliveryStores, LOCAL_STORAGE_LIMIT, lineKey as deliveryKey, localStorageUsed, readLineDeliveries, storageLevel, writeLineDeliveries } from "./lib/line-delivery-store.js";
import { applyDcmTopUps, applyDelivery, DELIVERY_SOURCES, deliveryComparison, rawRowsForPlan, planDelivery, readThirdPartyLinks, rememberThirdPartyLinks } from "./lib/third-party-delivery.js";
import writeExcelFile from "write-excel-file/universal";
import readXlsxFile, { readSheetNames } from "read-excel-file";
import { attachLineDays, billingFileName, billingSheets, computeClientBilling, monthLabel, parseBillingSheet, previousMonth, RATE_TYPES, readBilling, SOURCES as BILLING_SOURCES, writeBilling } from "./lib/billing.js";
import { kpiWatch } from "./lib/kpi-watch.js";
import { readSkySettings, SKY_KEY, SKY_LABEL, skyTime, skyWeather, weatherUrl } from "./lib/sky.js";

// Each line's DCM and DSP days load from IndexedDB just after the page opens; until then the saved top-ups stand as they are.
let campaigns = loadCampaigns();
let deliveryLoaded = false;
const writtenDeliveries = new Map();
let storageFullShown = false;
let storageWarned = false;
let importHistory = readImportHistory(localStorage);
let selectedSource = "billing";
let clientScope = new URLSearchParams(location.search).get("client");
let sourcesView = new URLSearchParams(location.search).get("view") === "sources";
if (sourcesView) clientScope = null;
let alertsView = new URLSearchParams(location.search).get("view") === "alerts";
if (alertsView) clientScope = null;
// Full pages reached from the sidebar: the daily brief and the automation setup guide.
const PAGE_VIEWS = ["brief", "automation", "review", "billing", "settings"];
// The "new campaign" choice shared by the IO and report dialogs.
const NEW_CAMPAIGN = "__new";
let pageView = PAGE_VIEWS.includes(new URLSearchParams(location.search).get("view")) ? new URLSearchParams(location.search).get("view") : null;
if (pageView) clientScope = null;
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

/** Saves campaigns, first bringing each line's DCM top-up in line with its latest report. */
function saveCampaigns() {
  if (!deliveryLoaded) {
    // Before the days have loaded, save as-is so nothing stored inline is dropped.
    trySaveLocal(JSON.stringify(campaigns));
    return;
  }
  campaigns = applyDcmTopUps(campaigns);
  writeLineDeliveries(indexedDB, campaigns, writtenDeliveries).catch(error => storageProblem(error));
  trySaveLocal(JSON.stringify(campaigns, (key, value) => key === "thirdPartyDelivery" ? undefined : value));
}

/** Saves the campaigns, and says so plainly when the browser is out of room instead of failing silently. */
function trySaveLocal(text) {
  try {
    localStorage.setItem("northstar-campaigns", text);
    return true;
  } catch (error) {
    storageProblem(error);
    return false;
  }
}
function storageProblem(error) {
  if (storageFullShown) return;
  storageFullShown = true;
  // Say it again on a later save if it still fails, but not on every save in a burst.
  setTimeout(() => { storageFullShown = false; }, 60_000);
  const full = /quota/i.test(`${error?.name} ${error?.message}`);
  // Shown just after any "saved" message the same action raises, and held longer, so it isn't covered.
  setTimeout(() => {
    document.querySelector("#toast-title").textContent = full ? "Storage is full" : "Couldn’t save";
    document.querySelector("#toast-message").textContent = full ? "This change shows now but wasn’t saved. Download a backup in Settings, then remove old campaigns." : "This change shows now but may not be saved. Download a backup in Settings.";
    const toast = document.querySelector("#toast");
    toast.classList.add("show", "toast-error");
    setTimeout(() => toast.classList.remove("show", "toast-error"), 9000);
  }, 900);
  updateStorageWarning();
}

function loadCampaigns() {
  try {
    purgeDemoCampaigns(localStorage);
    const stored = JSON.parse(localStorage.getItem("northstar-campaigns"));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
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

// Under $1,000 shows whole dollars ($300), so small amounts never read as "$0.3K".
const formatMoney = value => Math.abs(value) >= 1_000_000 ? `$${(value / 1_000_000).toFixed(2)}M` : Math.abs(value) >= 1000 ? `$${(value / 1000).toFixed(1)}K` : `$${Math.round(value).toLocaleString("en-US")}`;
const formatExactMoney = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
const hasBudget = campaign => Number.isFinite(campaign.budget) && campaign.budget > 0;
// Pacing numbers take their colour from the same thresholds the alerts use: red over, amber under, green on track.
const paceClass = pacing => Number.isFinite(pacing) ? `pace-${pacingBand(pacing, alertRules)}` : "";
const formatCount = value => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

function renderCampaigns(filter = "all", statusFilter = document.querySelector("#status-filter")?.value || "all", ownerFilter = document.querySelector("#owner-filter")?.value || "all", channelFilter = document.querySelector("#channel-filter")?.value || "all", query = document.querySelector("#campaign-search")?.value || "") {
  // The insertion order decides each line's dates and IO line; keep the stored lines in step with it.
  const planned = applyCampaignStatus(applyIoPlan(campaigns, campaignTotals), campaignStatus);
  if (planned !== campaigns) { campaigns = planned; saveCampaigns(); }
  // The client account view ignores the saved client filter and always shows that client only.
  if (clientScope && !campaigns.some(campaign => campaign.client === clientScope)) { clientScope = null; history.replaceState({}, "", location.pathname); }
  filter = clientScope ?? filter;
  const matchingRows = filterCampaigns(campaigns, { client: filter, status: statusFilter, owner: ownerFilter, channel: channelFilter, query });
  const activeAlerts = unacknowledgedAlerts(evaluateAlerts(matchingRows), acknowledgedAlertIds);
  const filteredRows = filterCampaignsByAttention(matchingRows, activeAlerts, document.querySelector("#attention-filter")?.value);
  const rows = sortCampaigns(filteredRows, { mode: document.querySelector("#campaign-sort")?.value, spendView: selectedSource });
  const period = currentPeriod();
  const activeRows = activeRowsWithPooled(rows, campaignTotals, campaign => dashboardFlightStatus(campaign) === "live");
  // The KPI watcher card: live lines whose primary KPI misses its goal by more than the KPI tolerance.
  const watch = kpiWatch(activeRows.filter(record => !isPlaceholder(record)), { tolerance: alertRules.kpiTolerance });
  lastKpiWatch = watch;
  const kpiValue = document.querySelector("#portfolio-kpi-value");
  kpiValue.classList.toggle("pace-over", watch.off.length > 0);
  kpiValue.classList.toggle("pace-on-track", watch.watched > 0 && watch.off.length === 0);
  kpiValue.textContent = watch.watched ? String(watch.off.length) : "—";
  const worst = watch.off[0];
  document.querySelector("#kpi-watch-detail").innerHTML = !watch.watched
    ? `<span>No live lines have a KPI goal yet</span>`
    : `<span><b class="${watch.off.length ? "warning-text" : "positive"}">${watch.off.length ? "off goal" : "all on goal"}</b> of ${watch.watched} line${watch.watched === 1 ? "" : "s"} with a goal${watch.near.length ? ` · ${watch.near.length} close` : ""}</span>${worst ? `<small class="kpi-watch-worst">Furthest: ${escapeHtml(recordLineLabel(worst.record) || worst.record.name)} · ${escapeHtml(worst.metric)} ${escapeHtml(worst.formatted)} vs ${escapeHtml(worst.goalText)}</small>` : ""}`;
  renderSpendChart(activeRows);
  lastPacingRows = activeRows;
  const activeUnits = budgetUnits(activeRows, campaignTotals);
  const budget = unitsBudget(activeUnits);
  const comparablePeriodRows = period === "current" ? activeRows : activeRows.filter(item => periodSpend(item, period) !== null);
  const spend = period === "current" ? activeRows.reduce((sum, item) => sum + resolveSpend(item, selectedSource), 0) : comparablePeriodRows.reduce((sum, item) => sum + periodSpend(item, period), 0);
  document.querySelector("#budget-value").textContent = formatMoney(budget);
  const liveCampaignCount = new Set(activeRows.map(row => `${row.client}::${campaignGroupName(row)}`)).size;
  document.querySelector("#budget-detail").textContent = liveCampaignCount ? `across ${liveCampaignCount} live campaign${liveCampaignCount === 1 ? "" : "s"}` : "No live campaigns yet";
  // A period no report reaches (data through Oct 12, "last 7 days" ending Oct 22) has no spend to show, not $0.
  document.querySelector("#spend-value").textContent = period !== "current" && !comparablePeriodRows.length ? "—" : formatMoney(spend);
  document.querySelector("#spend-metric-label").textContent = period === "current" ? "Spend to date" : `Spend · ${periodText(period)}`;
  const utilization = spend / budget * 100 || 0;
  document.querySelector("#spend-progress").style.width = period === "current" ? `${Math.min(utilization, 100)}%` : "0%";
  document.querySelector("#utilization-value").textContent = period === "current" ? `${utilization.toFixed(1)}% utilized` : comparablePeriodRows.length ? `${comparablePeriodRows.length} campaign${comparablePeriodRows.length === 1 ? "" : "s"} with data` : "No reports cover this period";
  document.querySelector("#remaining-value").textContent = period === "current" ? `${formatMoney(Math.max(budget - spend, 0))} remaining` : "";
  const portfolio = { pacing: unitsPacing(activeUnits) };
  const portfolioValue = document.querySelector("#portfolio-pacing-value");
  const portfolioStatus = document.querySelector("#portfolio-pacing-status");
  portfolioValue.textContent = portfolio.pacing === null ? "—" : `${portfolio.pacing.toFixed(0)}%`;
  portfolioValue.classList.remove("pace-over", "pace-under", "pace-on-track");
  if (paceClass(portfolio.pacing)) portfolioValue.classList.add(paceClass(portfolio.pacing));
  portfolioStatus.textContent = portfolio.pacing === null ? "No pacing data" : portfolio.pacing > alertRules.overPacing ? "Above plan" : portfolio.pacing < alertRules.underPacing ? "Below plan" : "On track";
  portfolioStatus.className = `status-pill ${portfolio.pacing !== null && (portfolio.pacing > alertRules.overPacing || portfolio.pacing < alertRules.underPacing) ? "warning" : "good"}`;
  document.querySelector("#portfolio-pacing-target").textContent = `Target: ${alertRules.underPacing}–${alertRules.overPacing}%`;
  renderAlerts(rows);
  updateMoreFiltersCount();
  const portfolioRows = filterCampaigns(campaigns, { client: "all", status: statusFilter, owner: ownerFilter, channel: channelFilter, query });
  renderClientRollup(portfolioRows, unacknowledgedAlerts(evaluateAlerts(portfolioRows), acknowledgedAlertIds), filter);
  renderCampaignList(matchingRows, activeAlerts);
  applyClientScopeChrome();
  renderClientNav();
  renderClientIo();
  renderClientDocuments();
  renderClientTodos();
  renderClientBilling();
  updateBillingReminder();
  renderMorningBrief();
  applySourcesView();
  applyAlertsView();
  applyPageView();
  renderWelcome();
}

function renderClientRollup(rows, activeAlerts, selectedClient) {
  const period = currentPeriod();
  const kpiView = document.querySelector("#kpi-view")?.value || "primary";
  const rollup = buildClientRollup(rows, { spendView: selectedSource, period, kpiView, alerts: activeAlerts, rules: alertRules, totals: campaignTotals });
  const grid = document.querySelector("#client-grid");
  document.querySelector("#client-rollup-context").textContent = rollup.length ? `${rollup.length} client${rollup.length === 1 ? "" : "s"} with live campaigns · select one to open its account` : "No clients have live campaigns for the current filters";
  const bandLabel = { over: "Above plan", under: "Below plan", "on-track": "On track", unknown: "No pacing" };
  const kpiText = kpis => kpis.map(kpi => `${escapeHtml(kpi.metric)} <strong>${escapeHtml(kpi.formatted)}</strong>`).join(" · ");
  grid.innerHTML = rollup.map(client => {
    const kpis = client.kpiMix.length ? client.kpiMix : client.kpi.formatted !== "—" ? [client.kpi] : [];
    const open = sortTodos(todos.filter(item => item.client === client.client && isOpen(item)));
    const urgent = open.filter(item => item.tag === "urgent").length;
    const meta = [`${client.liveCount} campaign${client.liveCount === 1 ? "" : "s"}`, `${client.lineCount} line${client.lineCount === 1 ? "" : "s"}`, client.latestDataAsOf ? `data through ${shortDate(client.latestDataAsOf)}` : ""].filter(Boolean).join(" · ");
    // The card answers "is this client okay?" at a glance. Campaigns, every alert, and every to-do live one click away.
    const top = client.alerts.find(alert => alert.severity === "critical") || client.alerts[0];
    const topLine = top ? `<p class="client-top-issue ${top.severity}"><span class="client-alert-dot"></span><span><b>${escapeHtml(ALERT_TYPES[top.type]?.label || top.title)}</b> · ${escapeHtml(recordLineLabel(top.campaign) || campaignGroupName(top.campaign))}</span></p>` : "";
    const signals = [
      client.alerts.length ? `<span class="client-signal ${client.alerts.some(alert => alert.severity === "critical") ? "critical" : "warning"}">${client.alerts.length} alert${client.alerts.length === 1 ? "" : "s"}</span>` : '<span class="client-signal clear">No alerts</span>',
      open.length ? `<span class="client-signal">${open.length} to-do${open.length === 1 ? "" : "s"}${urgent ? ` · <b>${urgent} urgent</b>` : ""}</span>` : ""
    ].join("");
    return `<button type="button" class="client-card" data-client="${escapeHtml(client.client)}" aria-pressed="${client.client === selectedClient}">
    <span class="client-card-top"><span class="client-card-head"><span class="client-name">${escapeHtml(client.client)}</span><span class="status-pill ${client.pacingBand === "on-track" ? "good" : client.pacingBand === "unknown" ? "" : "warning"}">${bandLabel[client.pacingBand]}${client.pacing === null ? "" : ` · ${client.pacing.toFixed(0)}%`}</span></span>
    <span class="client-meta">${escapeHtml(meta)}</span></span>
    <span class="client-spend"><strong>${period !== "current" && client.spendCoverage === 0 ? "—" : formatMoney(client.spend)}</strong><span>${period === "current" ? (client.budget > 0 ? `of ${formatMoney(client.budget)}` : "budget needed") : escapeHtml(periodText(period))}</span></span>
    <span class="progress-track"${client.utilization === null ? " hidden" : ""}><span style="width:${Math.min(client.utilization ?? 0, 100)}%"></span></span>
    <span class="client-kpi-row">${kpis.length ? kpiText(kpis) : "No KPI data yet"}</span>
    <span class="client-card-foot">${topLine}<span class="client-signals">${signals}</span></span>
  </button>`;
  }).join("");
}

// Opening a client: the card grows into the page header and its name becomes the page title.
document.querySelector("#client-grid").addEventListener("click", event => {
  const card = event.target.closest(".client-card");
  if (!card) return;
  const open = () => setClientScope(card.dataset.client);
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) { open(); return; }
  const header = document.querySelector(".topbar");
  const heading = document.querySelector("#greeting");
  card.style.viewTransitionName = "client-open";
  card.querySelector(".client-name").style.viewTransitionName = "client-title";
  const transition = document.startViewTransition(() => {
    card.style.viewTransitionName = "";
    open();
    header.style.viewTransitionName = "client-open";
    heading.style.viewTransitionName = "client-title";
  });
  transition.finished.finally(() => { header.style.viewTransitionName = ""; heading.style.viewTransitionName = ""; });
});

// --- Client account view: ?client=Name shows only that client's campaigns, independent of the saved filters ---
// Every page starts with its cards in their default state: collapsed on the overview, current campaigns open on a client tab.
function resetExpandedCampaigns() {
  expandedCampaigns.clear();
  autoExpandedClient = null;
}

function setClientScope(name, { replace = false } = {}) {
  if (name && !onboarding.openedClient) onboarding = writeOnboarding(localStorage, { ...onboarding, openedClient: name });
  if ((name || null) !== clientScope) resetExpandedCampaigns();
  clientScope = name || null;
  sourcesView = false;
  alertsView = false;
  pageView = null;
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
  const eyebrow = { set textContent(_value) {} };
  const heading = document.querySelector("#greeting");
  const subtitle = document.querySelector("#page-subtitle");
  if (!scoped) {
    document.querySelector("#client-data-through").hidden = true;
    eyebrow.textContent = "PERFORMANCE CENTER";
    subtitle.textContent = "Here’s how your campaigns are tracking today.";
    renderProfile();
    document.title = "Zeta | Campaign overview";
    return;
  }
  const rows = campaigns.filter(campaign => campaign.client === clientScope && !isCampaignArchived(campaign));
  const groups = groupCampaigns(rows);
  // How current this client's numbers are: the newest report date, and the oldest when campaigns differ.
  const throughDates = groups.filter(group => group.status !== "completed").map(group => group.records.map(record => record.dataAsOf).filter(Boolean).sort().at(-1)).filter(Boolean).sort();
  const through = document.querySelector("#client-data-through");
  through.hidden = !throughDates.length;
  // When DCM carries a line past its last report, say so and name the report date it builds on.
  const toppedUp = rows.filter(record => record.dcmTopUp);
  const reportThrough = toppedUp.map(record => record.dcmTopUp.reportAsOf).sort().at(-1);
  const topUpSources = [...new Set(toppedUp.map(record => SHORT_SOURCE[record.dcmTopUp.source] || "DCM"))].join(" and ");
  const dcmNote = toppedUp.length ? ` · <span class="dcm-through">${escapeHtml(topUpSources)} after the ${escapeHtml(shortDate(reportThrough))} report</span>` : "";
  through.innerHTML = throughDates.length ? `<span class="data-through-dot"></span>Data through <strong>${escapeHtml(longDate(throughDates.at(-1)))}</strong>${dcmNote}${throughDates[0] !== throughDates.at(-1) ? ` · oldest campaign through ${escapeHtml(longDate(throughDates[0]))}` : ""}` : "";
  const live = groups.filter(group => group.status === "live").length;
  eyebrow.textContent = "CLIENT ACCOUNT";
  heading.textContent = clientScope;
  subtitle.textContent = `${groups.length} campaign${groups.length === 1 ? "" : "s"} · ${live} live · only ${clientScope} data is shown below.`;
  document.title = `Zeta | ${clientScope}`;
}

function renderClientNav() {
  const clients = [...new Map(campaigns.filter(campaign => !isCampaignArchived(campaign)).map(campaign => [campaign.client, campaign])).values()].sort((a, b) => a.client.localeCompare(b.client));
  document.querySelector("#client-nav-label").hidden = clients.length === 0;
  document.querySelector("#client-nav").innerHTML = clients.map(campaign => `<a class="nav-item client-nav-item${campaign.client === clientScope ? " active" : ""}" href="?client=${encodeURIComponent(campaign.client)}" data-client-link="${escapeHtml(campaign.client)}"${campaign.client === clientScope ? ' aria-current="page"' : ""}><span class="client-nav-mark ${escapeHtml(campaign.className || "")}">${escapeHtml(campaign.short || "")}</span><span class="client-nav-name">${escapeHtml(campaign.client)}</span></a>`).join("");
  const overview = document.querySelector("#nav-overview");
  overview.classList.toggle("active", !clientScope && !sourcesView && !alertsView && !pageView);
  if (clientScope || sourcesView || alertsView || pageView) overview.removeAttribute("aria-current"); else overview.setAttribute("aria-current", "page");
  for (const page of PAGE_VIEWS) {
    const link = document.querySelector(`#nav-${page}`);
    link.classList.toggle("active", pageView === page);
    if (pageView === page) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  }
  const sourcesLink = document.querySelector("#nav-sources");
  sourcesLink.classList.toggle("active", sourcesView);
  if (sourcesView) sourcesLink.setAttribute("aria-current", "page"); else sourcesLink.removeAttribute("aria-current");
}

document.querySelector(".sidebar").addEventListener("click", event => {
  const link = event.target.closest("[data-client-link]");
  if (link) { event.preventDefault(); setClientScope(link.dataset.clientLink); document.querySelector(".sidebar").classList.remove("open"); return; }
  if (event.target.closest("#nav-sources")) { event.preventDefault(); setSourcesView(true); document.querySelector(".sidebar").classList.remove("open"); return; }
  if (event.target.closest("#nav-alerts")) { event.preventDefault(); setAlertsView(true); document.querySelector(".sidebar").classList.remove("open"); return; }
  const page = event.target.closest("[data-page-view]");
  if (page) { event.preventDefault(); setPageView(page.dataset.pageView); document.querySelector(".sidebar").classList.remove("open"); return; }
  if (event.target.closest("#nav-overview") && (clientScope || sourcesView || alertsView || pageView)) { event.preventDefault(); alertsView = false; setClientScope(null); }
});
document.querySelector("#client-back").addEventListener("click", event => { event.preventDefault(); setClientScope(null); });
window.addEventListener("popstate", () => {
  sourcesView = new URLSearchParams(location.search).get("view") === "sources";
  alertsView = new URLSearchParams(location.search).get("view") === "alerts";
  pageView = PAGE_VIEWS.includes(new URLSearchParams(location.search).get("view")) ? new URLSearchParams(location.search).get("view") : null;
  resetExpandedCampaigns();
  clientScope = sourcesView || alertsView || pageView ? null : new URLSearchParams(location.search).get("client");
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

document.querySelector("#edit-profile").addEventListener("click", () => setPageView("settings"));
renderProfile();

// --- Campaign list: one expandable row per campaign with per-campaign metrics ---
let metricPrefs = readMetricPrefs(localStorage);
let auditMode = false;
try { auditMode = localStorage.getItem("northstar-audit-mode") === "on"; } catch { auditMode = false; }
let campaignTotals = readCampaignTotals(localStorage);
let onboarding = readOnboarding(localStorage);
let reviewedImports = readReviewedImports(localStorage);
let lastKpiWatch = null;
let billing = readBilling(localStorage);
let thirdPartyLinks = readThirdPartyLinks(localStorage);
const SKIP_DELIVERY = "__skip";
const SHORT_SOURCE = { CM360: "DCM", DSP: "DSP" };
const deliveryLabel = () => SHORT_SOURCE[pendingValidatedImport?.parsed?.source] || "DCM";
const CHECK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
// Campaigns marked paused or completed by hand, and the order you put campaigns in (both views share it).
let campaignStatus = readCampaignStatus(localStorage);
let campaignOrder = readCampaignOrder(localStorage);
let todos = pruneTodos(readTodos(localStorage));
let brief = readBrief(localStorage);
const evaluateAlerts = rows => evaluateCampaignAlerts(rows, alertRules, new Date(), { totals: campaignTotals });
const expandedCampaigns = new Set();
let autoExpandedClient = null;
let lastCampaignGroups = [];
let metricPickerTarget = null;

function lineStatusLabel(status) {
  return { live: "Live", scheduled: "Scheduled", paused: "Paused", completed: "Completed", archived: "Archived" }[status] || "";
}

function renderCampaignList(rows, activeAlerts) {
  const period = currentPeriod();
  // Your order applies in portfolio order; completed campaigns always sit at the bottom.
  const manualOrder = (document.querySelector("#campaign-sort")?.value || "portfolio") === "portfolio";
  const groups = orderGroups(groupCampaigns(rows), campaignOrder, { manual: manualOrder });
  lastCampaignGroups = groups;
  // Opening a client tab shows its current campaigns' line items right away. Once opened, your own collapsing sticks.
  if (clientScope && autoExpandedClient !== clientScope) {
    groups.filter(group => group.status !== "completed").forEach(group => expandedCampaigns.add(group.key));
    autoExpandedClient = clientScope;
  }
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
    // A campaign with an IO shows its IO lines, each with the report lines matched to it; report lines the IO does not
    // plan are listed after them so nothing is hidden.
    const entry = campaignTotals[group.key] || null;
    const planLines = entry ? ioLines(entry).map(line => ({ ...line, records: group.records.filter(record => record.ioLineStatus === "matched" && record.ioLine === line.key) })) : [];
    const shownLines = entry ? group.lines.filter(line => line.kind !== "record" || line.record.ioLineStatus !== "matched") .filter(line => line.kind === "record" ? !isPlaceholder(line.record) : true) : group.lines;
    const ioLineRows = planLines.map(line => {
      const lineMetrics = line.records.length ? computeMetrics(line.records, { ...options, totals: { budget: line.budget, startDate: line.startDate, endDate: line.endDate } }) : { budget: line.budget };
      const lineStatus = ["paused", "completed"].includes(campaignStatus[group.key]) ? campaignStatus[group.key] : dashboardFlightStatus({ startDate: line.startDate, endDate: line.endDate });
      const reportNames = line.records.map(record => recordLineLabel(record));
      const meta = [`${line.startDate} → ${line.endDate}`, line.placements.length > 1 ? `${line.placements.length} IO flights combined` : "", reportNames.length ? `report: ${reportNames.join(", ")}` : "no report data yet"].filter(Boolean).join(" · ");
      const index = line.records.length ? campaigns.indexOf(line.records[0]) : -1;
      return { done: lineStatus === "completed", html: `<div class="campaign-line io-line${lineStatus === "completed" ? " line-done" : ""}" title="${lineStatus === "completed" ? escapeHtml(meta) : ""}"><span class="line-check"></span><span class="campaign-line-status"><span class="status-dot-label ${lineStatus}">${lineStatusLabel(lineStatus)}</span></span><span class="campaign-title"><strong>${escapeHtml(line.name)}</strong><small>${escapeHtml(meta)}</small></span>${keys.map(key => `<span class="metric-cell"><strong class="${key === "pacing" ? paceClass(lineMetrics.pacing) : ""}">${escapeHtml(formatMetric(key, lineMetrics[key]))}</strong></span>`).join("")}<span class="campaign-line-actions">${index >= 0 ? `<button class="campaign-line-open" type="button" data-open-campaign="${index}">Details</button>` : ""}</span></div>` };
    });
    const reportLineRows = shownLines.map(line => {
      // A planned flight with no imported delivery has a budget only; showing zero spend or pacing would mislead.
      const lineMetrics = line.kind === "flight" ? { budget: line.budget } : computeMetrics(line.kind === "record" ? line.record : line, { ...options, period: line.kind === "record" ? period : "current" });
      const index = campaigns.indexOf(line.record);
      const placement = placementMatches.get(line) || null;
      const shownStart = line.startDate || placement?.startDate || null;
      const shownEnd = line.endDate || placement?.endDate || null;
      const fromIo = !line.startDate && Boolean(placement);
      const dates = shownStart && shownEnd ? `${escapeHtml(shownStart)} → ${escapeHtml(shownEnd)}${fromIo ? " · from IO" : ""}` : "";
      const lineStatus = line.kind === "record" ? dashboardFlightStatus({ ...line.record, startDate: shownStart || line.record.startDate, endDate: shownEnd || line.record.endDate }) : null;
      const planNote = entry && line.kind === "record" ? (line.record.ioLineStatus === "outside" ? "outside the IO flight" : "not on the IO") : "";
      const meta = [planNote ? `<em class="plan-note">${planNote}</em>` : "", dates, line.rate ? `${escapeHtml(line.rateType || "CPM")} $${Number(line.rate).toFixed(2)}` : ""].filter(Boolean).join(" · ");
      const lineSelectKey = stableLineKey(line);
      const lineChecked = selectionFor(group.key).has(lineSelectKey);
      const done = lineStatus === "completed";
      return { done, html: `<div class="campaign-line${lineChecked ? " selected" : ""}${done ? " line-done" : ""}"><label class="line-check"><input type="checkbox" data-select-line="${escapeHtml(lineSelectKey)}" data-group="${escapeHtml(group.key)}" aria-label="Select ${escapeHtml(line.name || "line")}"${lineChecked ? " checked" : ""} /></label><span class="campaign-line-status">${line.kind === "record" ? `<span class="status-dot-label ${lineStatus}">${lineStatusLabel(lineStatus)}</span>` : ""}</span><span class="campaign-title"><strong>${escapeHtml(line.name || "Line item")}</strong><small>${meta || "&nbsp;"}</small></span>${keys.map(key => `<span class="metric-cell"><strong class="${key === "pacing" ? paceClass(lineMetrics.pacing) : ""}">${escapeHtml(formatMetric(key, lineMetrics[key]))}</strong></span>`).join("")}<span class="campaign-line-actions"><button class="campaign-line-open" type="button" data-open-campaign="${index}">Details</button><button class="campaign-line-remove" type="button" data-remove-line="${index}" data-line-kind="${line.kind === "record" ? "record" : "item"}" data-line-id="${escapeHtml(String(line.id ?? ""))}" data-line-name="${escapeHtml(line.name || "this line")}" aria-label="Remove ${escapeHtml(line.name || "line")}" title="Remove">✕</button></span></div>${auditMode ? renderLineAudit(auditLine(line, auditOptions(line))) : ""}` };
    });
    // Completed lines sit at the bottom of the campaign as compact rows, so live lines stay up front.
    const allRows = [...ioLineRows, ...reportLineRows];
    const lineRows = [...allRows.filter(row => !row.done), ...allRows.filter(row => row.done)].map(row => row.html).join("");
    const auditSummary = !auditMode ? "" : (() => {
      const gaps = group.lines.filter(line => auditLine(line, auditOptions(line)).missing.some(label => ["Spend", "Budget", "Impressions", "Clicks", "CTR"].includes(label))).length;
      return gaps ? ` · ${gaps} line${gaps === 1 ? "" : "s"} missing data` : " · all lines complete";
    })();
    return `<article class="campaign-card${open ? " open" : ""}" data-group-key="${escapeHtml(group.key)}" style="--metric-count:${keys.length}">
      <div class="campaign-card-head" data-toggle-campaign="${escapeHtml(group.key)}">
        <button class="campaign-toggle" type="button" aria-expanded="${open}" aria-label="${open ? "Collapse" : "Expand"} ${escapeHtml(group.name)}">›</button>
        <span class="status-dot-label ${group.status}">${lineStatusLabel(group.status)}</span>
        <span class="campaign-title"><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(group.client)}${group.startDate && group.endDate ? ` · ${escapeHtml(group.startDate)} → ${escapeHtml(group.endDate)}` : ""} · ${entry ? planLines.length + shownLines.length : group.lines.length} line${(entry ? planLines.length + shownLines.length : group.lines.length) === 1 ? "" : "s"}${campaignTotals[group.key] ? ` · budget from ${campaignTotals[group.key].orders.length > 1 ? `${campaignTotals[group.key].orders.length} IOs` : "IO"}` : ""}${auditSummary}</small></span>
        ${cells}
        <span class="campaign-card-actions">${manualOrder && group.status !== "completed" ? `<span class="campaign-move"><button class="campaign-icon-button" type="button" data-move-campaign="${escapeHtml(group.key)}" data-move="up" aria-label="Move ${escapeHtml(group.name)} up" title="Move up">↑</button><button class="campaign-icon-button" type="button" data-move-campaign="${escapeHtml(group.key)}" data-move="down" aria-label="Move ${escapeHtml(group.name)} down" title="Move down">↓</button></span>` : ""}${groupAlerts.length ? `<span class="campaign-alert-badge${critical ? " critical" : ""}" title="${groupAlerts.length} open alert${groupAlerts.length === 1 ? "" : "s"}">${groupAlerts.length}</span>` : ""}<button class="campaign-icon-button" type="button" data-edit-metrics="${escapeHtml(group.key)}" aria-label="Choose metrics for ${escapeHtml(group.name)}" title="Choose metrics">⚙</button></span>
      </div>
      ${open ? `<div class="campaign-lines">${selectionFor(group.key).size ? `<div class="campaign-lines-bulk"><strong>${resolveSelection(group.key).length} selected</strong><button type="button" data-bulk-edit="${escapeHtml(group.key)}">Edit selected…</button><button type="button" class="danger" data-bulk-remove="${escapeHtml(group.key)}">Remove selected</button><button type="button" data-bulk-clear="${escapeHtml(group.key)}">Clear</button></div>` : ""}<div class="campaign-lines-labels"><label class="line-check"><input type="checkbox" data-select-all-lines="${escapeHtml(group.key)}" aria-label="Select all lines"${shownLines.length && shownLines.every(line => selectionFor(group.key).has(stableLineKey(line))) ? " checked" : ""} /></label><span></span><span>Line item</span>${labels}<span></span></div>${lineRows}<div class="campaign-lines-footer"><label class="campaign-status-control">Status <select data-campaign-status="${escapeHtml(group.key)}" aria-label="Status of ${escapeHtml(group.name)}"><option value="auto"${campaignStatus[group.key] ? "" : " selected"}>By flight dates</option><option value="paused"${campaignStatus[group.key] === "paused" ? " selected" : ""}>Paused</option><option value="completed"${campaignStatus[group.key] === "completed" ? " selected" : ""}>Completed</option></select></label>${manualOrder && group.status !== "completed" ? `<button class="text-button" type="button" data-move-campaign="${escapeHtml(group.key)}" data-move="top">Move to top</button><button class="text-button" type="button" data-move-campaign="${escapeHtml(group.key)}" data-move="bottom">Move to bottom</button>` : ""}<button class="text-button" type="button" data-edit-campaign="${escapeHtml(group.key)}">Edit campaign…</button><button class="campaign-remove" type="button" data-remove-campaign="${escapeHtml(group.key)}">Remove campaign…</button></div></div>` : ""}
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

let bulkEditCampaign = null;

function setBulkEditMode(campaignMode) {
  document.querySelector("#bulk-edit-eyebrow").textContent = campaignMode ? "Campaign details" : "Bulk edit";
  document.querySelector("#bulk-channel-label").hidden = campaignMode;
}

/** Edits the details every line of a campaign shares: owner, primary KPI and target, billing source, report cadence. */
function openCampaignEdit(key) {
  const records = campaigns.filter(record => groupKey(record) === key && !isCampaignArchived(record));
  if (!records.length) return;
  bulkEditCampaign = key;
  bulkEditGroup = null;
  document.querySelector("#bulk-edit-form").reset();
  setBulkEditMode(true);
  // Show what the lines already share; a field the lines disagree on starts blank and is left alone unless filled in.
  const shared = read => { const values = [...new Set(records.filter(record => !isPlaceholder(record) || records.length === 1).map(read).map(value => String(value ?? "").trim()))]; return values.length === 1 ? values[0] : ""; };
  document.querySelector("#bulk-owner").value = shared(record => record.owner);
  document.querySelector("#bulk-kpi").value = shared(record => record.kpi);
  document.querySelector("#bulk-target").value = shared(record => String(record.target ?? "").replace(/^target\s*/i, "").replace(/^not provided$/i, ""));
  document.querySelector("#bulk-billing").value = shared(record => record.billingSource) || "";
  if (!document.querySelector("#bulk-billing").value) document.querySelector("#bulk-billing").value = "";
  document.querySelector("#bulk-cadence").value = shared(record => record.reportCadence || "none") || "";
  const name = campaignGroupName(records[0]);
  document.querySelector("#bulk-edit-title").textContent = `Edit ${name}`;
  document.querySelector("#bulk-edit-summary").textContent = `Changes apply to all ${records.length} line${records.length === 1 ? "" : "s"} of this campaign. Blank fields keep their current values.`;
  document.querySelector("#bulk-edit-lines").hidden = false;
  document.querySelector("#bulk-edit-items").hidden = true;
  document.querySelector("#bulk-edit-error").hidden = true;
  bulkEditDialog.showModal();
}

function openBulkEdit(groupKeyValue) {
  const entries = resolveSelection(groupKeyValue);
  if (!entries.length) return;
  bulkEditGroup = groupKeyValue;
  bulkEditCampaign = null;
  setBulkEditMode(false);
  document.querySelector("#bulk-edit-title").textContent = "Edit selected lines";
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
  if (bulkEditCampaign) {
    const keys = campaigns.map((record, index) => groupKey(record) === bulkEditCampaign && !isCampaignArchived(record) ? lineKey(index, "record") : null).filter(Boolean);
    const name = lastCampaignGroups.find(group => group.key === bulkEditCampaign)?.name || "the campaign";
    writeImportRollback(localStorage, createRemovalUndo({ campaigns, importHistory, campaignTotals, label: `editing ${name}` }));
    campaigns = applyBulkEdits(campaigns, keys, edits).campaigns;
    saveCampaigns();
    bulkEditDialog.close();
    refreshAfterDataChange();
    showToast("Campaign updated", `${name} updated across ${keys.length} line${keys.length === 1 ? "" : "s"}. Use Undo to revert.`);
    return;
  }
  const entries = resolveSelection(bulkEditGroup);
  if (!entries.length) { bulkEditDialog.close(); return; }
  writeImportRollback(localStorage, createRemovalUndo({ campaigns, importHistory, campaignTotals, label: `editing ${describeSelection(entries)}` }));
  campaigns = applyBulkEdits(campaigns, entries.map(entry => entry.key), edits).campaigns;
  saveCampaigns();
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
  const editCampaign = event.target.closest("[data-edit-campaign]");
  if (editCampaign) { openCampaignEdit(editCampaign.dataset.editCampaign); return; }
  const move = event.target.closest("[data-move-campaign]");
  if (move) {
    // Only the campaigns on screen trade places; completed ones stay at the bottom.
    const shown = lastCampaignGroups.filter(group => group.status !== "completed").map(group => group.key);
    campaignOrder = moveCampaign(campaignOrder, shown, move.dataset.moveCampaign, move.dataset.move);
    try { localStorage.setItem(CAMPAIGN_ORDER_KEY, JSON.stringify(campaignOrder)); } catch { /* the order lasts for this session */ }
    renderCampaigns(document.querySelector("#client-filter").value);
    return;
  }
  if (event.target.closest("[data-campaign-status], .campaign-status-control")) return;
  const head = event.target.closest("[data-toggle-campaign]");
  if (!head) return;
  const key = head.dataset.toggleCampaign;
  if (expandedCampaigns.has(key)) expandedCampaigns.delete(key); else expandedCampaigns.add(key);
  renderCampaigns(document.querySelector("#client-filter").value);
});

document.querySelector("#campaign-list-rows").addEventListener("change", event => {
  const select = event.target.closest("[data-campaign-status]");
  if (!select) return;
  campaignStatus = setCampaignStatus(campaignStatus, select.dataset.campaignStatus, select.value);
  try { localStorage.setItem(CAMPAIGN_STATUS_KEY, JSON.stringify(campaignStatus)); } catch { /* the status lasts for this session */ }
  const name = lastCampaignGroups.find(group => group.key === select.dataset.campaignStatus)?.name || "Campaign";
  renderCampaigns(document.querySelector("#client-filter").value);
  showToast("Campaign status", select.value === "auto" ? `${name} follows its flight dates again.` : `${name} is marked ${select.value}.${select.value === "completed" ? " It moves to the bottom and leaves the live totals." : " It leaves the live totals and alerts until you set it back."}`);
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
let lastPacingRows = [];
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

// --- Pacing details: click the Overall pacing card for daily spend against a 100% pace ---
const pacingDialog = document.querySelector("#pacing-dialog");
const shortDate = value => new Date(`${value}T00:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
const percentText = value => Number.isFinite(value) ? `${Math.round(value)}%` : "—";
const perDay = value => Number.isFinite(value) ? `${formatMoney(value)}/day` : "—";

let pacingRange = { preset: DEFAULT_PACING_RANGE, start: "", end: "" };
try {
  const saved = JSON.parse(localStorage.getItem("northstar-pacing-range"));
  if (saved && PACING_RANGES.some(item => item.id === saved.preset)) pacingRange = { preset: saved.preset, start: String(saved.start ?? ""), end: String(saved.end ?? "") };
} catch { /* the default period is used */ }
const savePacingRange = () => { try { localStorage.setItem("northstar-pacing-range", JSON.stringify(pacingRange)); } catch { /* the choice lasts for this session */ } };
const longDate = value => new Date(`${value}T00:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function pacingChartSvg(days) {
  const width = 760, height = 250, left = 54, right = 8, top = 10, bottom = 26;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const maximum = Math.max(...days.flatMap(day => [day.actual ?? 0, day.baseline]), 1) * 1.05;
  const y = value => top + plotHeight - value / maximum * plotHeight;
  const step = plotWidth / days.length;
  const barWidth = Math.max(1, step * 0.72);
  const centre = index => left + index * step + step / 2;
  const grid = [0, 1 / 3, 2 / 3, 1].map(fraction => { const value = maximum * fraction; return `<line class="grid" x1="${left}" x2="${width - right}" y1="${y(value).toFixed(1)}" y2="${y(value).toFixed(1)}"/><text class="axis" x="${left - 6}" y="${(y(value) + 3).toFixed(1)}" text-anchor="end">${escapeHtml(formatMoney(value))}</text>`; }).join("");
  const bars = days.map((day, index) => {
    if (day.actual === null) return "";
    const percent = day.baseline > 0 ? day.actual / day.baseline * 100 : null;
    const band = percent === null ? "on-track" : pacingBand(percent, alertRules);
    const barTop = y(day.actual);
    return `<rect class="daily-bar pace-bar-${band}${day.estimated ? " estimated" : ""}" x="${(centre(index) - barWidth / 2).toFixed(2)}" y="${barTop.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${(top + plotHeight - barTop).toFixed(2)}"><title>${escapeHtml(day.date)}: ${escapeHtml(formatExactMoney(day.actual))}${day.baseline > 0 ? ` vs ${escapeHtml(formatExactMoney(day.baseline))} at 100% pace (${Math.round(percent)}%)` : ""}${day.estimated ? " · averaged between reports" : ""}</title></rect>`;
  }).join("");
  const line = days.some(day => day.baseline > 0) ? `<path class="pace-line" d="${days.map((day, index) => `${index ? "L" : "M"}${centre(index).toFixed(1)},${y(day.baseline).toFixed(1)}`).join(" ")}"/>` : "";
  const labelCount = Math.min(5, days.length);
  const labelIndexes = [...new Set(Array.from({ length: labelCount }, (_, position) => labelCount === 1 ? 0 : Math.round(position * (days.length - 1) / (labelCount - 1))))];
  const labels = labelIndexes.map(index => `<text class="axis" x="${centre(index).toFixed(1)}" y="${height - 8}" text-anchor="${index === 0 ? "start" : index === days.length - 1 ? "end" : "middle"}">${escapeHtml(shortDate(days[index].date))}</text>`).join("");
  const todayIndex = days.findIndex(day => day.date === todayIso());
  const today = todayIndex < 0 ? "" : `<line class="today" x1="${centre(todayIndex).toFixed(1)}" x2="${centre(todayIndex).toFixed(1)}" y1="${top}" y2="${top + plotHeight}"/>`;
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily spend from ${escapeHtml(days[0].date)} to ${escapeHtml(days.at(-1).date)} against the daily spend of a 100% pace">${grid}${bars}${line}${today}${labels}</svg>`;
}

function syncPacingRangeControls() {
  const select = document.querySelector("#pacing-range");
  if (!select.options.length) select.innerHTML = PACING_RANGES.map(item => `<option value="${item.id}">${escapeHtml(item.label)}</option>`).join("");
  select.value = pacingRange.preset;
  document.querySelector("#pacing-custom").hidden = pacingRange.preset !== "custom";
  document.querySelector("#pacing-start").value = pacingRange.start;
  document.querySelector("#pacing-end").value = pacingRange.end;
}

function renderPacingDetail() {
  syncPacingRangeControls();
  const detail = buildPacingDetail({ campaigns: lastPacingRows, totals: campaignTotals, spendView: "billing", range: { preset: pacingRange.preset, custom: { start: pacingRange.start, end: pacingRange.end } } });
  const { period, range } = detail;
  document.querySelector("#pacing-dialog-eyebrow").textContent = clientScope ? `${clientScope} · Pacing details` : "Pacing details";
  const status = detail.pacing === null ? "No pacing data" : detail.pacing > alertRules.overPacing ? "Above plan" : detail.pacing < alertRules.underPacing ? "Below plan" : "On track";
  const stat = (label, value, sub, cls = "") => `<div class="pacing-stat"><small>${escapeHtml(label)}</small><strong class="${cls}">${escapeHtml(value)}</strong><span>${escapeHtml(sub)}</span></div>`;
  const periodSub = period.daysWithData === 0 ? "No reports cover this period yet"
    : `${formatMoney(period.actualTotal)} over ${period.daysWithData} day${period.daysWithData === 1 ? "" : "s"}${period.baselineTotal > 0 ? ` · ${percentText(period.percent)} of a 100% pace (${perDay(period.avgBaseline)})` : ""}`;
  document.querySelector("#pacing-stats").innerHTML = [
    stat("Pacing", detail.pacing === null ? "—" : `${detail.pacing.toFixed(0)}%`, `${status} · target ${alertRules.underPacing}–${alertRules.overPacing}%`, paceClass(detail.pacing)),
    stat("Spend to date", formatMoney(detail.spend), detail.budget > 0 ? `${(detail.spend / detail.budget * 100).toFixed(1)}% of ${formatMoney(detail.budget)} budget` : "No budget set"),
    stat("Expected at 100% pace", detail.expected > 0 ? formatMoney(detail.expected) : "—", detail.expected > 0 ? `${detail.spend >= detail.expected ? "ahead by" : "behind by"} ${formatMoney(Math.abs(detail.spend - detail.expected))}` : "Needs a budget and flight dates"),
    stat(range.label, perDay(period.avgActual), periodSub),
    stat("Needed from today", perDay(detail.requiredDaily), detail.requiredDaily === null ? "No live flight with budget left" : "to spend the remaining budget by each flight's end")
  ].join("");
  document.querySelector("#pacing-chart").innerHTML = pacingChartSvg(detail.days);
  document.querySelector("#pacing-chart-context").textContent = `${longDate(range.start)} to ${longDate(range.end)} · ${period.totalDays} day${period.totalDays === 1 ? "" : "s"}`;
  const error = document.querySelector("#pacing-range-error");
  error.textContent = range.error ? `${range.error} Showing the last 30 days.` : "";
  error.hidden = !range.error;
  const note = [];
  if (period.daysWithData === 0) note.push("No dated reports cover this period, so there are no spend bars. Pick a longer period, or import a report that covers these days.");
  else if (period.daysWithData < period.totalDays) note.push(`Reports cover ${period.daysWithData} of the ${period.totalDays} days in this period. Days with no bar have no report yet.`);
  if (range.clipped) note.push("Showing the most recent 400 days.");
  if (detail.withoutHistory && period.daysWithData) note.push(`${detail.withoutHistory} campaign${detail.withoutHistory === 1 ? " has" : "s have"} only one dated report, so ${detail.withoutHistory === 1 ? "it is" : "they are"} left out of the daily bars. ${detail.withoutHistory === 1 ? "Its" : "Their"} spend still counts in the totals above.`);
  if (detail.skippedUnits) note.push(`${detail.skippedUnits} campaign${detail.skippedUnits === 1 ? "" : "s"} without a budget or flight dates ${detail.skippedUnits === 1 ? "is" : "are"} left out of the 100% line. Upload an insertion order to add them.`);
  document.querySelector("#pacing-chart-note").textContent = note.join(" ");
  document.querySelector("#pacing-table").innerHTML = detail.rows.length ? `<table><thead><tr><th>Campaign</th><th>Flight</th><th>Budget</th><th>Spend</th><th>Expected</th><th>Pacing</th></tr></thead><tbody>${detail.rows.map(row => `<tr><td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.client)} · ${row.lines} line${row.lines === 1 ? "" : "s"}${row.fromOrder ? " · budget and flight from IO" : ""}</small></td><td>${escapeHtml(row.flight || "Not set")}</td><td>${row.budget ? escapeHtml(formatMoney(row.budget)) : "—"}</td><td>${escapeHtml(formatMoney(row.spend))}</td><td>${row.expected > 0 ? escapeHtml(formatMoney(row.expected)) : "—"}</td><td class="${paceClass(row.pacing)}"><strong>${row.pacing === null ? "—" : `${row.pacing.toFixed(1)}%`}</strong></td></tr>`).join("")}</tbody></table>` : '<p class="history-empty">No live campaigns for the current filters.</p>';
}

document.querySelector("#pacing-range").addEventListener("change", event => {
  pacingRange.preset = event.target.value;
  if (pacingRange.preset === "custom" && !pacingRange.start) {
    // Start the custom range from what is already on screen: the last 30 days.
    const end = todayIso();
    pacingRange.end = end;
    pacingRange.start = new Date(Date.parse(`${end}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10);
  }
  savePacingRange();
  renderPacingDetail();
});
for (const id of ["#pacing-start", "#pacing-end"]) {
  const input = document.querySelector(id);
  input.addEventListener("change", () => {
    pacingRange.start = document.querySelector("#pacing-start").value;
    pacingRange.end = document.querySelector("#pacing-end").value;
    savePacingRange();
    renderPacingDetail();
  });
  // Enter inside the dialog's form would close it; here it only applies the date.
  input.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); input.dispatchEvent(new Event("change")); } });
}

function openPacingDetail() {
  renderPacingDetail();
  pacingDialog.showModal();
}
document.querySelector("#pacing-card").addEventListener("click", openPacingDetail);
document.querySelector("#pacing-card").addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPacingDetail(); }
});

// --- Budget, spend and KPI details: each summary card opens a breakdown by campaign, like the pacing card ---
const metricDialog = document.querySelector("#metric-dialog");
let metricDetailKind = null;
const SOURCE_LABEL = { billing: "billing", first: "1st-party", third: "3rd-party" };
const KPI_VIEW_LABEL = { primary: "Campaign primary", CTR: "CTR", VCR: "VCR", CPA: "CPA", ROAS: "ROAS" };
const shareText = (part, whole) => whole > 0 ? `${(part / whole * 100).toFixed(1)}%` : "—";
const rowCampaign = row => `<td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.client)} · ${row.lines} line${row.lines === 1 ? "" : "s"}</small></td>`;
const metricStat = (label, value, sub, cls = "") => `<div class="pacing-stat"><small>${escapeHtml(label)}</small><strong class="${cls}">${escapeHtml(value)}</strong><span>${escapeHtml(sub)}</span></div>`;
const metricTable = (head, rows, empty = "No live campaigns for the current filters.") => rows.length ? `<table><thead><tr>${head.map(label => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>` : `<p class="history-empty">${escapeHtml(empty)}</p>`;

function metricDetailRows() {
  return buildPacingDetail({ campaigns: lastPacingRows, totals: campaignTotals, spendView: "billing", range: { preset: "7", custom: {} } });
}

function setMetricExtra(title, note, html) {
  document.querySelector("#metric-extra-section").hidden = !html;
  document.querySelector("#metric-extra-title").textContent = title;
  document.querySelector("#metric-extra-note").textContent = note;
  document.querySelector("#metric-extra").innerHTML = html;
}

function renderBudgetDetail() {
  const detail = metricDetailRows();
  const rows = [...detail.rows].sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0) || a.name.localeCompare(b.name));
  const fromIo = rows.filter(row => row.fromOrder && row.budget);
  const ioBudget = fromIo.reduce((sum, row) => sum + row.budget, 0);
  const missing = rows.filter(row => !row.budget).length;
  const largest = rows.find(row => row.budget);
  document.querySelector("#metric-dialog-title").textContent = "Active media budget";
  document.querySelector("#metric-stats").innerHTML = [
    metricStat("Active media budget", formatMoney(detail.budget), `across ${rows.length} live campaign${rows.length === 1 ? "" : "s"}`),
    metricStat("From insertion orders", formatMoney(ioBudget), `${fromIo.length} campaign${fromIo.length === 1 ? "" : "s"} · ${shareText(ioBudget, detail.budget)} of the budget`),
    metricStat("From reports", formatMoney(Math.max(detail.budget - ioBudget, 0)), missing ? `${missing} campaign${missing === 1 ? " has" : "s have"} no budget yet` : "Every live campaign has a budget"),
    metricStat("Largest campaign", largest ? formatMoney(largest.budget) : "—", largest ? largest.name : "No budgets yet")
  ].join("");
  document.querySelector("#metric-table-note").textContent = "Live campaigns, largest budget first";
  document.querySelector("#metric-table").innerHTML = metricTable(["Campaign", "Flight", "Budget", "Share", "Budget from", "Days left"], rows.map(row => `<tr>${rowCampaign(row)}<td>${escapeHtml(row.flight || "Not set")}</td><td>${row.budget ? escapeHtml(formatExactMoney(row.budget)) : "—"}</td><td>${row.budget ? shareText(row.budget, detail.budget) : "—"}</td><td>${row.budget ? (row.fromOrder ? "Insertion order" : "Report") : '<span class="warning-text">Needs a budget</span>'}</td><td>${row.daysLeft ?? "—"}</td></tr>`));
  setMetricExtra("", "", "");
}

function renderSpendDetail() {
  const detail = metricDetailRows();
  const spendOf = row => row.records.reduce((sum, record) => sum + (Number(resolveSpend(record, selectedSource)) || 0), 0);
  const rows = detail.rows.map(row => ({ ...row, shownSpend: spendOf(row) })).sort((a, b) => b.shownSpend - a.shownSpend || a.name.localeCompare(b.name));
  const spend = rows.reduce((sum, row) => sum + row.shownSpend, 0);
  const lastWeek = detail.period.daysWithData ? detail.period.actualTotal : null;
  document.querySelector("#metric-dialog-title").textContent = "Spend to date";
  document.querySelector("#metric-stats").innerHTML = [
    metricStat("Spend to date", formatMoney(spend), `${SOURCE_LABEL[selectedSource]} spend across ${rows.length} live campaign${rows.length === 1 ? "" : "s"}`),
    metricStat("Budget used", shareText(spend, detail.budget), detail.budget > 0 ? `of ${formatMoney(detail.budget)}` : "No budget set"),
    metricStat("Remaining", detail.budget > 0 ? formatMoney(Math.max(detail.budget - spend, 0)) : "—", detail.requiredDaily ? `${perDay(detail.requiredDaily)} needed to finish on time` : "No live flight with budget left"),
    metricStat("Last 7 days", lastWeek === null ? "—" : formatMoney(lastWeek), lastWeek === null ? "No reports cover the last 7 days" : `${perDay(detail.period.avgActual)} on average (billing)`)
  ].join("");
  document.querySelector("#metric-table-note").textContent = `Live campaigns, most spend first · ${SOURCE_LABEL[selectedSource]} spend`;
  document.querySelector("#metric-table").innerHTML = metricTable(["Campaign", "Budget", "Spend", "Budget used", "Remaining", "Data through"], rows.map(row => {
    const through = row.records.map(record => record.dataAsOf).filter(Boolean).sort().at(-1);
    return `<tr>${rowCampaign(row)}<td>${row.budget ? escapeHtml(formatMoney(row.budget)) : "—"}</td><td><strong>${escapeHtml(formatExactMoney(row.shownSpend))}</strong></td><td>${row.budget ? shareText(row.shownSpend, row.budget) : "—"}</td><td>${row.budget ? escapeHtml(formatMoney(Math.max(row.budget - row.shownSpend, 0))) : "—"}</td><td>${escapeHtml(through || "—")}</td></tr>`;
  }));
  // On the overview, spend also rolls up by client.
  const byClient = clientScope ? [] : [...rows.reduce((map, row) => map.set(row.client, { spend: (map.get(row.client)?.spend || 0) + row.shownSpend, budget: (map.get(row.client)?.budget || 0) + (row.budget || 0), count: (map.get(row.client)?.count || 0) + 1 }), new Map())].sort((a, b) => b[1].spend - a[1].spend);
  setMetricExtra("By client", "Live campaigns only", byClient.length > 1 ? metricTable(["Client", "Campaigns", "Budget", "Spend", "Budget used"], byClient.map(([client, item]) => `<tr><td><strong>${escapeHtml(client)}</strong></td><td>${item.count}</td><td>${item.budget ? escapeHtml(formatMoney(item.budget)) : "—"}</td><td>${escapeHtml(formatMoney(item.spend))}</td><td>${shareText(item.spend, item.budget)}</td></tr>`)) : "");
}

const KPI_CHOICES = ["CTR", "VCR", "CPA", "ROAS"];
let kpiEditGroups = [];

function renderKpiDetail() {
  const view = document.querySelector("#kpi-view").value || "primary";
  const detail = metricDetailRows();
  document.querySelector("#metric-dialog-title").textContent = "KPI watcher";
  document.querySelector("#metric-dialog-controls").innerHTML = `<label>KPI shown<select id="metric-kpi-view">${Object.entries(KPI_VIEW_LABEL).map(([value, label]) => `<option value="${value}"${value === view ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></label><small>Set each campaign's primary KPI and goal at the bottom. A campaign whose lines use different KPIs has a row for each.</small>`;
  const targetOf = record => String(record.target ?? "").replace(/^target\s*/i, "").replace(/^not provided$/i, "");
  const watch = lastKpiWatch || kpiWatch([], {});
  document.querySelector("#metric-stats").innerHTML = [
    metricStat("Off goal", String(watch.off.length), `more than ${alertRules.kpiTolerance}% from goal`, watch.off.length ? "pace-over" : ""),
    metricStat("Close", String(watch.near.length), "behind goal, within tolerance"),
    metricStat("On goal", String(watch.on.length), `of ${watch.watched} line${watch.watched === 1 ? "" : "s"} with a goal`, watch.on.length ? "pace-on-track" : ""),
    ...(watch.noGoal.length ? [metricStat("No goal set", String(watch.noGoal.length), "set one below")] : [])
  ].join("");
  const watchRows = [...watch.off, ...watch.near];
  const watchHtml = metricTable(["Line", "KPI", "Actual", "Goal", "Gap", ""], watchRows.map(item => `<tr class="${watch.off.includes(item) ? "kpi-off" : "kpi-near"}"><td><strong>${escapeHtml(recordLineLabel(item.record) || item.record.name)}</strong><small>${escapeHtml(item.record.client)} · ${escapeHtml(campaignGroupName(item.record))}</small></td><td>${escapeHtml(item.metric)}</td><td><strong>${escapeHtml(item.formatted)}</strong></td><td>${escapeHtml(item.goalText)}</td><td><span class="${watch.off.includes(item) ? "warning-text" : ""}">${item.gap.toFixed(0)}% ${item.lowerIsBetter ? "over" : "under"}</span></td><td><button class="text-button" type="button" data-kpi-open="${campaigns.indexOf(item.record)}">Details</button></td></tr>`), watch.watched ? "Every line with a goal is on it." : "No live lines have a KPI goal yet. Set goals below.");
  // One editable row per campaign and primary KPI, so a campaign with display on CTR and video on VCR gets two.
  kpiEditGroups = detail.rows.flatMap(row => {
    const byKpi = new Map();
    for (const record of row.records) byKpi.set(record.kpi || "", [...(byKpi.get(record.kpi || "") || []), record]);
    return [...byKpi.entries()].map(([kpi, records]) => ({ name: row.name, client: row.client, kpi, records, split: byKpi.size > 1 }));
  });
  document.querySelector("#metric-table-title").textContent = "Lines off or close to goal";
  document.querySelector("#metric-table-note").textContent = "Furthest from goal first";
  document.querySelector("#metric-table").innerHTML = watchHtml;
  const goalsHtml = metricTable(["Campaign", "Primary KPI", "Goal", "Actual", ""], kpiEditGroups.map((group, index) => {
    const targets = [...new Set(group.records.map(targetOf).filter(Boolean))];
    const actual = aggregateKpiView(group.records, view === "primary" ? group.kpi || "primary" : view).formatted;
    const lineNames = group.split ? ` · ${group.records.map(record => recordLineLabel(record)).slice(0, 3).join(", ")}${group.records.length > 3 ? "…" : ""}` : "";
    return `<tr><td><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(group.client)} · ${group.records.length} line${group.records.length === 1 ? "" : "s"}${escapeHtml(lineNames)}</small></td>
      <td><select class="kpi-edit-select" data-kpi-group="${index}" aria-label="Primary KPI for ${escapeHtml(group.name)}"><option value="">Not set</option>${KPI_CHOICES.map(kpi => `<option${kpi === group.kpi ? " selected" : ""}>${kpi}</option>`).join("")}${group.kpi && !KPI_CHOICES.includes(group.kpi) ? `<option selected>${escapeHtml(group.kpi)}</option>` : ""}</select></td>
      <td><input class="kpi-edit-goal" data-kpi-goal="${index}" value="${escapeHtml(targets.length === 1 ? targets[0] : "")}" placeholder="${targets.length > 1 ? "Several" : "e.g. 0.15%"}" aria-label="Goal for ${escapeHtml(group.name)}" /></td>
      <td><strong>${escapeHtml(actual)}</strong></td>
      <td><button class="text-button" type="button" data-kpi-save="${index}">Save</button></td></tr>`;
  }));
  setMetricExtra("KPIs and goals by campaign", view === "primary" ? "Actual uses each row's primary KPI" : `Actual shows ${view} for every row`, goalsHtml);
}

function renderMetricDetail() {
  document.querySelector("#metric-dialog-eyebrow").textContent = `${clientScope ? `${clientScope} · ` : ""}${{ budget: "Budget", spend: "Spend", kpi: "KPI" }[metricDetailKind]} details`;
  document.querySelector("#metric-dialog-controls").innerHTML = "";
  ({ budget: renderBudgetDetail, spend: renderSpendDetail, kpi: renderKpiDetail })[metricDetailKind]();
  document.querySelector("#metric-dialog-controls").hidden = !document.querySelector("#metric-dialog-controls").innerHTML;
}

function openMetricDetail(kind) {
  metricDetailKind = kind;
  renderMetricDetail();
  metricDialog.showModal();
}
for (const card of document.querySelectorAll("[data-metric-detail]")) {
  card.addEventListener("click", event => { if (!event.target.closest(".kpi-card-picker")) openMetricDetail(card.dataset.metricDetail); });
  card.addEventListener("keydown", event => {
    if (event.target !== card) return;
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openMetricDetail(card.dataset.metricDetail); }
  });
}
// The KPI card, its dialog and the More filters menu all choose the same KPI view.
function setKpiView(value) {
  document.querySelector("#kpi-view").value = value;
  document.querySelector("#kpi-view").dispatchEvent(new Event("change"));
  if (metricDialog.open && metricDetailKind === "kpi") renderMetricDetail();
}
metricDialog.addEventListener("change", event => { if (event.target.id === "metric-kpi-view") setKpiView(event.target.value); });
metricDialog.addEventListener("click", event => {
  const openLine = event.target.closest("[data-kpi-open]");
  if (openLine) { event.preventDefault(); metricDialog.close(); openCampaignDialog(Number(openLine.dataset.kpiOpen)); return; }
  const save = event.target.closest("[data-kpi-save]");
  if (save) {
    event.preventDefault();
    const index = Number(save.dataset.kpiSave);
    const group = kpiEditGroups[index];
    if (!group) return;
    const kpi = metricDialog.querySelector(`[data-kpi-group="${index}"]`).value;
    const target = metricDialog.querySelector(`[data-kpi-goal="${index}"]`).value.trim();
    if (!kpi && !target) return;
    const keys = group.records.map(record => campaigns.indexOf(record)).filter(position => position >= 0).map(position => lineKey(position, "record"));
    writeImportRollback(localStorage, createRemovalUndo({ campaigns, importHistory, campaignTotals, label: `setting the KPI for ${group.name}` }));
    campaigns = applyBulkEdits(campaigns, keys, { kpi, target }).campaigns;
    saveCampaigns();
    refreshAfterDataChange();
    renderMetricDetail();
    showToast("KPI updated", `${group.name}: ${kpi || group.kpi || "KPI"}${target ? ` with a goal of ${target}` : ""} on ${keys.length} line${keys.length === 1 ? "" : "s"}. Use Undo to revert.`);
    return;
  }
  const edit = event.target.closest("[data-metric-edit]");
  if (!edit) return;
  event.preventDefault();
  metricDialog.close();
  openCampaignEdit(edit.dataset.metricEdit);
});

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

// --- Reporting period: the current flight, or any of the pacing periods, including a custom range ---
const periodSelect = document.querySelector("#period-filter");
periodSelect.innerHTML = `<option value="current">Current flight</option>${PACING_RANGES.map(range => `<option value="${range.id}">${escapeHtml(range.label.replace("…", ""))}</option>`).join("")}`;
/** The selected period as one value: a preset id, or "custom:start:end" once both dates are set. */
function currentPeriod() {
  if (periodSelect.value !== "custom") return periodSelect.value || "current";
  const start = document.querySelector("#period-start").value;
  const end = document.querySelector("#period-end").value;
  return start && end && start <= end ? `custom:${start}:${end}` : "current";
}
/** How the period reads in labels: "last 30 days", "this quarter", "Oct 1 – Oct 15". */
function periodText(period = currentPeriod()) {
  if (period.startsWith("custom:")) { const [, start, end] = period.split(":"); return `${shortDate(start)} – ${shortDate(end)}`; }
  const label = PACING_RANGES.find(range => range.id === period)?.label || period;
  return label.charAt(0).toLowerCase() + label.slice(1);
}
function syncPeriodCustom() {
  const custom = periodSelect.value === "custom";
  document.querySelector("#period-custom").hidden = !custom;
  if (custom && !document.querySelector("#period-start").value) {
    const end = todayIso();
    document.querySelector("#period-end").value = end;
    document.querySelector("#period-start").value = new Date(Date.parse(`${end}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10);
  }
}
for (const id of ["#period-start", "#period-end"]) document.querySelector(id).addEventListener("change", () => { captureDashboardView(); renderCampaigns(document.querySelector("#client-filter").value); });

function captureDashboardView() {
  dashboardView = writeDashboardView(localStorage, {
    client: document.querySelector("#client-filter").value,
    period: currentPeriod(),
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
  if (String(view.period).startsWith("custom:")) {
    const [, start, end] = view.period.split(":");
    periodSelect.value = "custom";
    document.querySelector("#period-start").value = start;
    document.querySelector("#period-end").value = end;
  } else periodSelect.value = [...periodSelect.options].some(option => option.value === view.period) ? view.period : "current";
  syncPeriodCustom();
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
document.querySelector("#period-filter").addEventListener("change", () => { syncPeriodCustom(); renderCampaigns(document.querySelector("#client-filter").value); });
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
  const csv = exportCampaignsCsv(exportRows, { sort: document.querySelector("#campaign-sort").value, spendView: selectedSource, period: currentPeriod(), kpiView: document.querySelector("#kpi-view").value });
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

// --- More filters: owner, channel, alert status, KPI view, and spend source sit in a dropdown so the bar fits ---
const MORE_FILTER_DEFAULTS = { "#owner-filter": "all", "#channel-filter": "all", "#attention-filter": "all", "#kpi-view": "primary" };
function updateMoreFiltersCount() {
  const active = Object.entries(MORE_FILTER_DEFAULTS).filter(([id, value]) => (document.querySelector(id)?.value || value) !== value).length + (selectedSource !== "billing" ? 1 : 0);
  const badge = document.querySelector("#more-filters-count");
  badge.textContent = active;
  badge.hidden = active === 0;
}
document.querySelector("#clear-more-filters").addEventListener("click", () => {
  for (const [id, value] of Object.entries(MORE_FILTER_DEFAULTS)) document.querySelector(id).value = value;
  // Going back to billing spend goes through the source buttons so the saved view follows; it re-renders.
  document.querySelector('.segmented button[data-source="billing"]').click();
});
document.addEventListener("click", event => {
  const panel = document.querySelector("#more-filters");
  if (panel.open && !panel.contains(event.target)) panel.open = false;
});

const dialog = document.querySelector("#upload-dialog");
const campaignDialog = document.querySelector("#campaign-dialog");
const alertDialog = document.querySelector("#alert-dialog");
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
  const backup = createWorkspaceBackup({ campaigns, importHistory, alertRules, visibleColumns, acknowledgedAlerts: acknowledgedAlertIds, dashboardView, savedViews, metricPrefs, campaignTotals, campaignStatus, campaignOrder, todos });
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
document.querySelector("#workspace-backup-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!pendingWorkspaceBackup) return;
  // The backup's DCM and DSP days go to IndexedDB, so a large backup still fits local storage.
  await clearDeliveryStores(indexedDB).catch(() => {});
  await writeLineDeliveries(indexedDB, pendingWorkspaceBackup.campaigns, new Map()).catch(() => {});
  const campaignsOnly = pendingWorkspaceBackup.campaigns.map(({ thirdPartyDelivery, ...record }) => record);
  try {
    restoreWorkspaceBackup(localStorage, { ...pendingWorkspaceBackup, campaigns: campaignsOnly });
  } catch (error) {
    storageProblem(error);
    return;
  }
  window.location.reload();
});
document.querySelector("#reset-workspace").addEventListener("click", () => {
  if (!window.confirm("Reset this browser workspace? Imported campaigns, audit history, settings, saved views, and acknowledgments will be removed. Download a backup first if you may need them.")) return;
  resetWorkspaceStorage(localStorage);
  clearDeliveryStores(indexedDB).catch(() => {}).finally(() => window.location.reload());
});
document.querySelectorAll("#upload-button, #upload-nav, #client-documents-import").forEach(button => button.addEventListener("click", () => openImportDialog()));
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
let allowDuplicateOnce = false;
let reviewingReportKey = null;
validationResult.addEventListener("click", event => {
  if (!event.target.closest("#import-anyway")) return;
  allowDuplicateOnce = true;
  validateButton.click();
});
/**
 * Reads and checks one report file and matches its campaigns, the same way for the import dialog and the watched report
 * folder. Returns `{ status: "ready", pending }`, or `{ status: "duplicate" | "rejected", messages }` (already recorded).
 */
async function prepareImport(file, { allowDuplicate = false } = {}) {
  const fileBytes = await file.arrayBuffer();
  const fingerprint = await fingerprintBytes(fileBytes);
  if (hasSuccessfulFingerprint(importHistory, fingerprint) && !allowDuplicate) {
    recordImport(file.name, fingerprint, "Duplicate", 0, ["This exact report has already been imported."]);
    return { status: "duplicate", messages: ["This exact report has already been imported. No dashboard data was changed."] };
  }
  let report;
  try {
    report = await readReportFile(file, fileBytes);
  } catch (error) {
    recordImport(file.name, fingerprint, "Rejected", 0, [error.message]);
    return { status: "rejected", messages: [error.message] };
  }
  // A CM360 (DCM) delivery report is ad-server data: it sits beside each line's own report, compared over the same days.
  if (report.kind === "daily-delivery" && ["CM360", "DSP"].includes(report.parsed.source)) {
    if (!report.parsed.records.length) {
      const messages = report.parsed.errors.length ? report.parsed.errors : ["No dated delivery rows were found in this report."];
      recordImport(file.name, fingerprint, "Rejected", 0, messages);
      return { status: "rejected", messages };
    }
    return { status: "ready", pending: { kind: "delivery", fileName: file.name, fingerprint, report, parsed: report.parsed, targets: {} } };
  }
  if (report.kind === "daily-delivery" || report.kind === "line-items") {
    // Flashtalking daily files and DSP line-item exports are not imported on their own; campaign reports carry the lines.
    const message = "This file is a Flashtalking daily file or a DSP line-item export. Import the campaign's performance report instead; its line breakdown is read automatically.";
    recordImport(file.name, fingerprint, "Rejected", 0, [message]);
    return { status: "rejected", messages: [message] };
  }
  const result = validateCampaignCsv(report.csvText);
  if (result.valid && report.notes?.length) result.warnings.push(...report.notes);
  if (!result.valid) {
    recordImport(file.name, fingerprint, "Rejected", 0, result.errors);
    return { status: "rejected", messages: result.errors };
  }
  const pending = { fileName: file.name, fingerprint, report, result, choices: defaultImportChoices(result.campaigns), groupEdits: {}, skippedLines: new Set() };
  // Rows going into a campaign with an IO take their budget from the IO, so a missing report budget is not a problem.
  if (result.campaigns.every(row => campaignTotals[pending.choices[assignmentKey(row)]])) result.warnings = result.warnings.filter(warning => !/has no budget|have no budget/.test(warning));
  return { status: "ready", pending };
}

/** Saves the prepared import (`pendingValidatedImport`) into the dashboard. Returns how many lines it brought in. */
function commitPendingImport({ automatic = false } = {}) {
  if (pendingValidatedImport.kind === "delivery") return commitDeliveryImport({ automatic });
  const { fileName, fingerprint, result } = pendingValidatedImport;
  const effectiveRows = effectiveImport().campaigns;
  rememberAssignments(localStorage, result.campaigns, { ...pendingValidatedImport.choices, ...Object.fromEntries([...pendingValidatedImport.skippedLines].map(key => [key, SKIP])) });
  const uploadedAt = new Date().toISOString();
  const shellGroups = new Set(campaigns.filter(isPlaceholder).map(groupKey));
  const mergeResult = previewCampaignImport(campaigns, effectiveRows.map(row => ({ ...row, sourceFile: fileName, uploads: [makeUpload({ kind: "report", fileName, source: row.source, date: row.dataAsOf || null, uploadedAt })] })), "merge");
  writeImportRollback(localStorage, createImportRollback({ campaigns, importHistory, fileName, fingerprint, rowCount: effectiveRows.length, campaignKeys: effectiveRows.map(campaignImportKey), campaignTotals }));
  // Lines that join a campaign set up beforehand do not own it, so removing their report keeps the campaign.
  campaigns = removeFilledShells(mergeResult.campaigns, effectiveRows).map(record => shellGroups.has(groupKey(record)) && record.uploads ? { ...record, uploads: record.uploads.map(upload => upload.fileName === fileName ? { ...upload, created: false } : upload) } : record);
  saveCampaigns();
  const warnings = automatic ? [...result.warnings, "Imported automatically from the watched report folder."] : result.warnings;
  recordImport(fileName, fingerprint, result.warnings.length ? "Imported with warnings" : "Imported", effectiveRows.length, [], effectiveRows.map(campaignImportKey), warnings);
  return effectiveRows.length;
}

validateButton.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  validateButton.disabled = true;
  validateButton.textContent = "Validating…";
  document.querySelector("#import-preview").hidden = true;
  document.querySelector("#mapping-review").hidden = true;
  const prepared = await prepareImport(file, { allowDuplicate: allowDuplicateOnce });
  allowDuplicateOnce = false;
  validateButton.textContent = "Validate report";
  if (prepared.status !== "ready") {
    showValidationResult(prepared.messages, "error");
    if (prepared.status === "duplicate") validationResult.insertAdjacentHTML("beforeend", '<p class="duplicate-hint">Removed it from the client\u2019s uploads, or imported only part of it? Importing again is safe: rows already in the dashboard are updated, not duplicated. <button type="button" class="text-button" id="import-anyway">Import it again anyway</button></p>');
    validateButton.disabled = false;
    return;
  }
  pendingValidatedImport = prepared.pending;
  if (pendingValidatedImport.kind === "delivery") { showDeliveryImport(); return; }
  const { report, result } = pendingValidatedImport;
  normalizeLineSkips();
  renderImportAssignments();
  // Also turns Import off until every unmatched campaign has been placed.
  refreshImportAfterAssignment();
  renderMappingReview(report.headers);
  const location = report.worksheet ? `${report.worksheet}, header row ${report.headerRow}` : `header row ${report.headerRow}`;
  const mappingSummary = report.headerMappings.length ? ` ${report.headerMappings.length} source column alias${report.headerMappings.length === 1 ? " was" : "es were"} mapped automatically.` : "";
  showValidationResult([`${result.campaigns.length} campaign row${result.campaigns.length === 1 ? "" : "s"} passed validation from ${location}.${mappingSummary} Review warnings and choose Import validated report to continue.`, ...result.warnings], "success", result.warnings);
});
confirmImportButton.addEventListener("click", () => {
  if (!pendingValidatedImport) return;
  const delivery = pendingValidatedImport.kind === "delivery";
  if (!delivery && setupErrors().length) return;
  const count = commitPendingImport();
  // A report held for review is done once it is imported by hand.
  if (reviewingReportKey) { localStorage.setItem(REPORT_INBOX_KEY, JSON.stringify(readReportInbox(localStorage).filter(item => item.key !== reviewingReportKey))); reviewingReportKey = null; renderReportAutomation(); }
  refreshClientFilter();
  renderCampaigns();
  document.querySelector("#toast-message").textContent = delivery ? `${deliveryLabel()} delivery added to ${count} line${count === 1 ? "" : "s"}.` : `${count} campaign row${count === 1 ? "" : "s"} imported successfully.`;
  document.querySelector("#toast-title").textContent = delivery ? `${deliveryLabel()} report imported` : "Report imported";
  setTimeout(() => {
    dialog.close();
    const toast = document.querySelector("#toast");
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3200);
    resetImportForm();
  }, 550);
});

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

/** Lines remembered as skipped (e.g. a stale summary row) stay individual skips unless every line of the campaign is skipped. */
function normalizeLineSkips() {
  const pending = pendingValidatedImport;
  for (const group of importGroups()) {
    const skipped = group.rows.filter(row => pending.choices[assignmentKey(row)] === SKIP);
    if (skipped.length && skipped.length < group.rows.length) skipped.forEach(row => { pending.skippedLines.add(assignmentKey(row)); delete pending.choices[assignmentKey(row)]; });
  }
}

function effectiveImport() {
  const { result, choices, groupEdits, skippedLines } = pendingValidatedImport;
  // Individually skipped lines never reach the import; the campaign's other lines are unaffected.
  const kept = result.campaigns.filter(row => !skippedLines.has(assignmentKey(row)));
  const sizes = new Map();
  kept.forEach(row => sizes.set(groupKey(row), (sizes.get(groupKey(row)) || 0) + 1));
  // Setup edits only apply to rows that stay their own campaign; rows added elsewhere or skipped ignore them.
  const rows = kept.map(row => choices[assignmentKey(row)] ? row : rowWithGroupEdits(row, groupEdits[groupKey(row)], sizes.get(groupKey(row))));
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
  // A report campaign that matches nothing must be placed on purpose, so an older report doesn't quietly become a new campaign.
  const undecided = importGroups().filter(needsDecision).length;
  const messages = [...errors, ...(undecided ? [`Pick where ${undecided === 1 ? "the highlighted campaign goes" : `the ${undecided} highlighted campaigns go`} before importing: an existing campaign, a new one, or skip.`] : [])];
  errorBox.hidden = messages.length === 0;
  errorBox.textContent = messages.join(" ");
  renderImportPreview(effective.campaigns);
  confirmImportButton.disabled = effective.campaigns.length === 0 || messages.length > 0;
}

/** True when a report campaign matches nothing you track and you haven't said yet whether it's new. */
function needsDecision(group) {
  const pending = pendingValidatedImport;
  if (groupChoice(group) || pending.confirmedNew?.has(group.key)) return false;
  if (groupCampaigns(campaigns).some(item => item.key === group.key)) return false;
  const actions = previewCampaignImport(campaigns, group.rows).actions.map(item => item.action);
  return !(actions.length && actions.every(action => action === "update"));
}
const clientWords = name => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sameClient = (a, b) => { const x = clientWords(a), y = clientWords(b); return Boolean(x && y) && (x === y || x.startsWith(y) || y.startsWith(x) || x.split(" ")[0] === y.split(" ")[0]); };

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
  const sizes = new Map(groups.map(group => [group.key, group.rows.length]));
  // The report's own client comes first, since a report almost always belongs to a campaign that client already has.
  const campaignOption = (group, selected) => `<option value="${escapeHtml(group.key)}"${selected === group.key ? " selected" : ""}>Add to ${escapeHtml(group.client)} · ${escapeHtml(group.name)}</option>`;
  const targetOptions = (selected, client = null) => {
    const mine = client ? existing.filter(group => sameClient(group.client, client)) : [];
    const others = existing.filter(group => !mine.includes(group));
    const campaignsHtml = mine.length ? `<optgroup label="${escapeHtml(client)} campaigns">${mine.map(group => campaignOption(group, selected)).join("")}</optgroup>${others.length ? `<optgroup label="Other clients">${others.map(group => campaignOption(group, selected)).join("")}</optgroup>` : ""}` : others.map(group => campaignOption(group, selected)).join("");
    return `<option value="${SKIP}"${selected === SKIP ? " selected" : ""}>Skip this campaign</option>${campaignsHtml}`;
  };
  document.querySelector("#import-assign-all").innerHTML = `<option value="__mixed" selected disabled>Choose…</option><option value="${KEEP}">New or matching campaigns</option>${targetOptions("")}`;
  document.querySelector("#import-assign-all").closest("label").hidden = groups.length < 2;
  document.querySelector("#import-assignment-list").innerHTML = groups.map(group => {
    const choice = groupChoice(group);
    const edits = pending.groupEdits[group.key] || {};
    const editedRows = group.rows.map(row => rowWithGroupEdits(row, edits, sizes.get(group.key)));
    const actions = choice ? [] : previewCampaignImport(campaigns, editedRows).actions.map(item => item.action);
    const updates = actions.includes("update");
    // A report campaign with the same client and name as one you track (often one created from its IO) joins it.
    const sameName = existing.find(item => item.key === group.key);
    const keepLabel = sameName ? `Add to ${sameName.client} · ${sameName.name} (same name)` : updates ? "Update the matching campaign" : "New campaign from this report";
    const undecided = needsDecision(group);
    const isNew = !choice && !sameName && !updates;
    const firstOptions = undecided ? `<option value="" selected disabled>Choose a campaign (required)</option><option value="${NEW_CAMPAIGN}">New campaign from this report</option>` : isNew ? `<option value="${NEW_CAMPAIGN}" selected>New campaign from this report</option>` : `<option value="${KEEP}"${!choice ? " selected" : ""}>${keepLabel}</option>`;
    const chip = undecided ? '<em class="preview-action required">choose a campaign</em>' : choice === SKIP ? '<em class="preview-action replace">skipped</em>' : choice || sameName ? '<em class="preview-action update">added to campaign</em>' : updates ? '<em class="preview-action update">updates existing</em>' : '<em class="preview-action add">new campaign</em>';
    const budgetTotal = group.rows.reduce((sum, row) => sum + (Number.isFinite(row.budget) ? row.budget : 0), 0);
    const meta = [group.client, `${group.rows.length} line${group.rows.length === 1 ? "" : "s"}`, budgetTotal ? `${formatMoney(budgetTotal)} budget in report` : ""].filter(Boolean).map(escapeHtml).join(" · ");
    const skippedHere = group.rows.filter(row => pending.skippedLines.has(assignmentKey(row))).length;
    // The line selector is the one thing to review here; campaign details are edited from the campaign afterwards.
    const lines = `<details class="import-group-lines" open><summary>${group.rows.length} line${group.rows.length === 1 ? "" : "s"} to import${skippedHere ? ` · ${skippedHere} left out` : ""} <small>(untick a line to leave it out)</small></summary>${group.rows.map(row => `<label class="import-line-include"><input type="checkbox" data-line-include="${escapeHtml(assignmentKey(row))}"${pending.skippedLines.has(assignmentKey(row)) ? "" : " checked"} /><span>${escapeHtml(lineLabel(row))}</span><span>${formatMoney(row.spend)} spend${Number.isFinite(row.budget) ? ` · ${formatMoney(row.budget)} budget` : ""}</span></label>`).join("")}</details>`;
    return `<div class="import-assignment-block${undecided ? " needs-choice" : ""}"><div class="import-assignment-row"><span><strong>${escapeHtml(group.name)}</strong><small>${meta} ${chip}</small>${undecided ? `<small class="import-required-note">This doesn’t match a campaign you track. If it’s an older report for a current campaign, pick that campaign.</small>` : ""}</span><select data-group-choice="${escapeHtml(group.key)}" aria-label="What to do with ${escapeHtml(group.name)}"${undecided ? ' aria-invalid="true" required' : ""}>${firstOptions}${targetOptions(choice, group.client)}</select></div>${lines}</div>`;
  }).join("");
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
  const include = event.target.closest("[data-line-include]");
  if (include) {
    if (include.checked) pending.skippedLines.delete(include.dataset.lineInclude); else pending.skippedLines.add(include.dataset.lineInclude);
    renderImportAssignments();
    refreshImportAfterAssignment();
    return;
  }
  const choice = event.target.closest("[data-group-choice]");
  if (choice) {
    const group = importGroups().find(item => item.key === choice.dataset.groupChoice);
    pending.confirmedNew ??= new Set();
    if (group && choice.value === NEW_CAMPAIGN) { pending.confirmedNew.add(group.key); setGroupChoice(group, KEEP); }
    else if (group) { pending.confirmedNew.delete(group.key); setGroupChoice(group, choice.value); }
    renderImportAssignments();
    refreshImportAfterAssignment();
    return;
  }
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
  pendingValidatedImport.confirmedNew ??= new Set();
  importGroups().forEach(group => {
    // "New or matching campaigns" for all is an explicit answer for every campaign in the report.
    if (event.target.value === KEEP) pendingValidatedImport.confirmedNew.add(group.key); else pendingValidatedImport.confirmedNew.delete(group.key);
    setGroupChoice(group, event.target.value);
  });
  renderImportAssignments();
  refreshImportAfterAssignment();
});

// --- One import flow: pick where the report goes (an existing campaign or a new one), then the report itself ---
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

/** Where each report campaign goes before the person changes anything: what it matched last time, or by name. */
function defaultImportChoices(rows) {
  const groups = groupCampaigns(campaigns.filter(campaign => !isCampaignArchived(campaign)));
  return { ...suggestCampaigns(rows, groups, campaignTotals), ...initialChoices(rows, readAssignments(localStorage), groups) };
}

function openImportDialog() {
  resetImportForm();
  renderImportHistory();
  dialog.showModal();
}

function renderImportPreview(importedCampaigns) {
  document.querySelector("#import-preview-title").textContent = "Import impact preview";
  const mode = "merge";
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
document.querySelectorAll(".close-campaign-dialog").forEach(button => button.addEventListener("click", () => campaignDialog.close()));
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
    target: document.querySelector("#campaign-kpi-target-input").value,
    startDate: document.querySelector("#campaign-start-input").value,
    endDate: document.querySelector("#campaign-end-input").value
  });
  const error = document.querySelector("#campaign-settings-error");
  const totalsKey = groupKey(campaigns[activeCampaignIndex]);
  const totalsEntry = campaignTotals[totalsKey];
  const pacingStart = document.querySelector("#io-start-input").value;
  const pacingEnd = document.querySelector("#io-end-input").value;
  const flightEdited = Boolean(totalsEntry) && (pacingStart !== (totalsEntry.startDate || "") || pacingEnd !== (totalsEntry.endDate || ""));
  if (result.valid && flightEdited && pacingStart && pacingEnd && pacingEnd < pacingStart) { result.valid = false; result.errors = ["Order flight end must be on or after its start."]; }
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
  const before = campaigns[activeCampaignIndex];
  const datesChanged = (before.startDate || null) !== (updatedCampaign.startDate || null) || (before.endDate || null) !== (updatedCampaign.endDate || null) || flightEdited;
  if (datesChanged) writeImportRollback(localStorage, createRemovalUndo({ campaigns, importHistory, campaignTotals, label: `changing the flight dates of ${updatedCampaign.name}` }));
  if (flightEdited) campaignTotals = writeCampaignTotals(localStorage, setTotalsFlight(campaignTotals, totalsKey, pacingStart, pacingEnd));
  campaigns[activeCampaignIndex] = updatedCampaign;
  saveCampaigns();
  renderCampaigns(document.querySelector("#client-filter").value);
  renderUndoButton();
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
  saveCampaigns();
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
  document.querySelector("#campaign-kpi-target-input").value = String(campaign.target || "").replace(/^Target\s*/i, "");
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
  renderDcmComparison(campaign);
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
  document.querySelector("#campaign-start-input").value = campaign.startDate || "";
  document.querySelector("#campaign-end-input").value = campaign.endDate || "";
  renderIoTotalsNote(campaign);
  campaignDialog.showModal();
}

// --- Insertion order (PDF) review: parse in the browser, confirm, then apply ---
// --- Upload IO: one order at a time (several files queue up). It creates a campaign or revises one; nothing else. ---
const ioReviewDialog = document.querySelector("#io-review-dialog");
let pendingIo = null;
let ioQueue = [];

const ioTargetGroups = () => groupCampaigns(campaigns.filter(campaign => !isCampaignArchived(campaign)));
const orderLabel = io => [io.orderNumber, io.revision].filter(Boolean).join(" ");

async function queueIoFiles(files, { presetKey = null } = {}) {
  ioQueue.push(...files.map(file => ({ file, presetKey })));
  if (!pendingIo) await nextIo();
}

async function nextIo() {
  while (ioQueue.length) {
    const { file, presetKey } = ioQueue.shift();
    const [entry] = await readIoFiles([file]);
    if (entry.error) { showToast("Insertion order", `${file.name}: ${entry.error}`); continue; }
    pendingIo = { io: entry.io, fileName: file.name, presetKey };
    renderIoReview();
    if (!ioReviewDialog.open) ioReviewDialog.showModal();
    return;
  }
  pendingIo = null;
  if (ioReviewDialog.open) ioReviewDialog.close();
}

function renderIoReview() {
  const { io, fileName, presetKey } = pendingIo;
  document.querySelector("#io-review-eyebrow").textContent = ioQueue.length ? `Insertion order · ${ioQueue.length} more after this` : "Insertion order";
  document.querySelector("#io-review-subtitle").textContent = [io.advertiser, io.campaign, fileName].filter(Boolean).join(" · ");
  const facts = [["Agency", io.agency], ["Order", orderLabel(io) || "—"], ["Flight", io.startDate && io.endDate ? `${io.startDate} → ${io.endDate}` : "—"], ["Budget", io.budget ? formatExactMoney(io.budget) : "—"]];
  document.querySelector("#io-review-facts").innerHTML = facts.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "—")}</strong></div>`).join("");
  const warnings = document.querySelector("#io-review-warnings");
  warnings.hidden = io.warnings.length === 0;
  warnings.innerHTML = io.warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join("");
  const groups = ioTargetGroups();
  const match = presetKey ? { key: presetKey, reason: "preset" } : findCampaignForIo(clientScope ? groups.filter(group => group.client === clientScope) : groups, campaignTotals, io) || findCampaignForIo(groups, campaignTotals, io);
  const selected = match?.key || NEW_CAMPAIGN;
  document.querySelector("#io-review-target").innerHTML = `<option value="${NEW_CAMPAIGN}">New campaign from this IO</option>${groups.map(group => `<option value="${escapeHtml(group.key)}"${group.key === selected ? " selected" : ""}>${escapeHtml(`${group.client} · ${group.name}`)}</option>`).join("")}`;
  document.querySelector("#io-review-target").value = selected;
  document.querySelector("#io-new-client").value = clientScope || io.advertiser || "";
  document.querySelector("#io-new-name").value = io.campaign || "";
  document.querySelector("#io-review-match-note").textContent = !match ? "No campaign matches this order, so it will start a new one. Choose a campaign instead if it revises one you track."
    : match.reason === "preset" ? "This order will be applied to the campaign you opened."
      : match.reason === "order" ? (match.isRevision ? `This revises order ${match.appliedOrder}, already applied to this campaign. Applying it replaces that order.` : `Order ${match.appliedOrder} is already applied to this campaign. Applying it again replaces it.`)
        : "Matched to this campaign by name. Change it if that is wrong.";
  // The lines the campaign will be paced on: placements with the same name are one line.
  const lines = ioLines(setCampaignTotals({}, "preview", io, fileName).preview);
  document.querySelector("#io-review-selection").textContent = `${lines.length} line${lines.length === 1 ? "" : "s"} · ${formatExactMoney(lines.reduce((sum, line) => sum + line.budget, 0))}`;
  document.querySelector("#io-review-lines").innerHTML = lines.map(line => `<div class="io-review-line"><span class="io-line-main"><strong>${escapeHtml(line.name)}</strong><small>${escapeHtml(line.startDate)} → ${escapeHtml(line.endDate)}${line.placements.length > 1 ? ` · ${line.placements.length} flights combined` : ""}</small></span><span class="io-line-budget">${escapeHtml(formatExactMoney(line.budget))}</span></div>`).join("");
  document.querySelector("#io-review-error").hidden = true;
  syncIoTarget();
}

function syncIoTarget() {
  const isNew = document.querySelector("#io-review-target").value === NEW_CAMPAIGN;
  document.querySelector("#io-new-campaign").hidden = !isNew;
  const key = document.querySelector("#io-review-target").value;
  const revises = !isNew && campaignTotals[key];
  document.querySelector("#io-review-apply").textContent = isNew ? "Create campaign" : revises ? "Update campaign" : "Apply to campaign";
  document.querySelector("#io-review-skip").textContent = ioQueue.length ? "Skip this order" : "Cancel";
}
document.querySelector("#io-review-target").addEventListener("change", syncIoTarget);
document.querySelectorAll(".close-io-review").forEach(button => button.addEventListener("click", () => { pendingIo = null; nextIo(); }));
ioReviewDialog.addEventListener("cancel", event => { event.preventDefault(); pendingIo = null; nextIo(); });

document.querySelector("#io-review-form").addEventListener("submit", event => {
  event.preventDefault();
  if (!pendingIo) return;
  const { io, fileName } = pendingIo;
  const error = document.querySelector("#io-review-error");
  const fail = message => { error.textContent = message; error.hidden = false; };
  let key = document.querySelector("#io-review-target").value;
  let created = null;
  if (key === NEW_CAMPAIGN) {
    const client = document.querySelector("#io-new-client").value.trim();
    const name = document.querySelector("#io-new-name").value.trim();
    if (!client || !name) { fail("Enter the client and the campaign name."); return; }
    const result = createCampaign({ client, name, startDate: io.startDate, endDate: io.endDate, budget: io.budget, budgetSource: "io", billingSource: "reported", kpi: io.lineItems.find(item => item.kpi)?.kpi || "CTR", target: "Not provided", ioFileName: fileName });
    if (!result.valid) { fail(result.errors.join(" ")); return; }
    if (ioTargetGroups().some(group => group.key === groupKey(result.campaign))) { fail(`${client} already has a campaign named “${name}”. Choose it from the list to revise it.`); return; }
    created = result.campaign;
    key = groupKey(created);
  }
  const targetName = created ? created.name : groupCampaigns(campaigns).find(group => group.key === key)?.name || "the campaign";
  // Applying an order changes budgets and dates, so it gets a restore point like any other change.
  writeImportRollback(localStorage, createRemovalUndo({ campaigns, importHistory, campaignTotals, label: `${created ? "creating" : "applying order to"} ${targetName}` }));
  if (created) campaigns.push(created);
  campaignTotals = writeCampaignTotals(localStorage, setCampaignTotals(campaignTotals, key, io, fileName));
  const index = campaigns.findIndex(record => groupKey(record) === key);
  campaigns[index] = { ...campaigns[index], ioFileName: fileName, ioOrder: [io.orderNumber, io.revision].filter(Boolean).join("-") || null };
  saveCampaigns();
  const entry = campaignTotals[key];
  refreshAfterDataChange();
  if (activeCampaignIndex !== null && campaigns[activeCampaignIndex] && groupKey(campaigns[activeCampaignIndex]) === key) renderIoTotalsNote(campaigns[activeCampaignIndex]);
  showToast(created ? "Campaign created" : "Insertion order applied", `${targetName} is paced on ${entry.orders.length > 1 ? `${entry.orders.length} orders totalling ` : ""}${formatExactMoney(entry.budget)} from ${entry.startDate} to ${entry.endDate}.${created ? " Import its reports to add delivery." : ""}`);
  pendingIo = null;
  nextIo();
});

document.querySelector("#client-io-button").addEventListener("click", () => document.querySelector("#client-io-input").click());
document.querySelector("#client-io-input").addEventListener("change", async event => {
  const files = [...event.target.files];
  event.target.value = "";
  if (files.length) await queueIoFiles(files);
});

function renderIoTotalsNote(campaign) {
  const note = document.querySelector("#io-totals-note");
  const entry = campaignTotals[groupKey(campaign)];
  note.hidden = !entry;
  document.querySelector("#io-section-title").textContent = entry ? `${formatExactMoney(entry.budget)} · ${entry.startDate} → ${entry.endDate}` : "No IO uploaded";
  document.querySelector("#io-flight-fields").hidden = !entry;
  document.querySelector("#io-start-input").value = entry?.startDate || "";
  document.querySelector("#io-end-input").value = entry?.endDate || "";
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
}

document.querySelector("#io-pdf-input").addEventListener("change", async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (file && campaigns[activeCampaignIndex]) await queueIoFiles([file], { presetKey: groupKey(campaigns[activeCampaignIndex]) });
});

function renderBudgetRevisionHistory(campaign) {
  const revisions = budgetRevisionHistory(campaign);
  document.querySelector("#export-budget-revisions").disabled = revisions.length === 0;
  document.querySelector("#budget-revision-list").innerHTML = revisions.length ? revisions.map(revision => `<div><span><strong>Revision ${revision.revisionNumber} · ${escapeHtml(revision.effectiveDate)}</strong><small>${escapeHtml(revision.fileName)}${revision.note ? ` · ${escapeHtml(revision.note)}` : ""}</small></span><span><strong>${formatExactMoney(revision.amount)}</strong><small>from ${formatExactMoney(revision.previousBudget)}</small></span></div>`).join("") : '<p class="history-empty">No budget revisions recorded.</p>';
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
  currentValidationIssues = [];
  document.querySelector("#export-validation-issues").hidden = true;
  validateButton.disabled = true;
  validateButton.textContent = "Validate report";
  confirmImportButton.disabled = true;
  pendingValidatedImport = null;
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

// --- A client's upload history: every file uploaded for the account, with the option to remove any of them ---
let lastClientDocuments = [];

function documentDetail(doc) {
  const when = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
  const campaignsText = doc.campaigns.join(", ");
  if (doc.kind === "io-order") return [doc.order, Number.isFinite(doc.budget) ? formatExactMoney(doc.budget) : "", doc.startDate && doc.endDate ? `${doc.startDate} → ${doc.endDate}` : "", campaignsText, when && `applied ${when}`].filter(Boolean).join(" · ");
  const unit = doc.kind === "io-flights" ? "flight" : doc.kind === "daily" ? "line" : doc.kind === "line-items" ? "line" : "line";
  return [`${doc.lines} ${unit}${doc.lines === 1 ? "" : "s"}`, campaignsText, doc.source && doc.kind !== "report" ? doc.source : "", doc.dataAsOf ? `data through ${doc.dataAsOf}` : "", when && `uploaded ${when}`, doc.legacy ? "added before uploads were tracked" : ""].filter(Boolean).join(" · ");
}

// --- Client account view: the insertion order(s) behind each campaign, so budget and flight are easy to find ---
const IO_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const ioDate = value => value ? IO_DATE.format(new Date(`${value}T00:00:00Z`)) : "—";
const ioRange = (start, end) => start && end ? `${ioDate(start)} → ${ioDate(end)}` : "Dates not set";

function renderClientIo() {
  const panel = document.querySelector("#client-io");
  panel.hidden = !clientScope;
  if (!clientScope) return;
  const summary = buildClientIoSummary({ campaigns, totals: campaignTotals, client: clientScope });
  const withIo = summary.filter(item => item.hasIo).length;
  document.querySelector("#client-io-context").textContent = summary.length ? `${withIo} of ${summary.length} campaign${summary.length === 1 ? "" : "s"} paced on an insertion order · reports fill in spend and KPIs against these budgets and flights` : `No campaigns for ${clientScope} yet`;
  const cardFor = item => {
    const records = campaigns.filter(record => record.client === clientScope && groupKey(record) === item.key && !isCampaignArchived(record));
    const metrics = computeMetrics(records, { spendView: selectedSource, totals: campaignTotals[item.key] || null });
    const tracking = `<div class="io-tracking"><span><small>Spend to date</small><strong>${Number.isFinite(metrics.spend) ? escapeHtml(formatMoney(metrics.spend)) : "—"}</strong></span><span><small>Pacing</small><strong class="${paceClass(metrics.pacing)}">${escapeHtml(formatMetric("pacing", metrics.pacing))}</strong></span></div>`;
    if (!item.hasIo) return `<article class="io-card no-io" data-io-key="${escapeHtml(item.key)}"><div class="io-card-head"><span class="status-dot-label ${item.status}">${lineStatusLabel(item.status)}</span><strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong><button class="text-button io-edit" type="button" data-edit-campaign="${escapeHtml(item.key)}">Edit</button></div><p class="io-empty">No insertion order uploaded. Pacing uses the budget and dates from the reports${item.startDate && item.endDate ? ` (${escapeHtml(ioRange(item.startDate, item.endDate))})` : ""}.</p>${tracking}</article>`;
    const orders = item.orders.map(order => `<li><span><strong>${escapeHtml(order.order || "Order")}</strong><small>${escapeHtml(order.fileName || "")}${order.appliedAt ? ` · applied ${escapeHtml(ioDate(order.appliedAt.slice(0, 10)))}` : ""}</small></span><span class="io-order-figures">${Number.isFinite(order.budget) ? `<strong>${escapeHtml(formatExactMoney(order.budget))}</strong>` : ""}${order.startDate && order.endDate ? `<small>${escapeHtml(ioRange(order.startDate, order.endDate))}</small>` : ""}</span></li>`).join("");
    const placements = item.placements.length ? `<details class="io-placements"><summary>${item.placements.length} line${item.placements.length === 1 ? "" : "s"} on this IO</summary><ul>${item.placements.map(placement => `<li><span><strong>${escapeHtml(placement.name || placement.id)}</strong>${placement.order ? `<small>${escapeHtml(placement.order)}</small>` : ""}</span><span>${escapeHtml(ioRange(placement.startDate, placement.endDate))}</span><span>${Number.isFinite(placement.budget) ? escapeHtml(formatExactMoney(placement.budget)) : "—"}</span></li>`).join("")}</ul></details>` : "";
    return `<article class="io-card" data-io-key="${escapeHtml(item.key)}"><div class="io-card-head"><span class="status-dot-label ${item.status}">${lineStatusLabel(item.status)}</span><strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong><button class="text-button io-edit" type="button" data-edit-campaign="${escapeHtml(item.key)}">Edit</button></div>
      <div class="io-facts"><span><small>Total IO budget</small><strong>${item.budget ? escapeHtml(formatExactMoney(item.budget)) : "—"}</strong></span><span><small>Flight${item.flightEdited ? " (edited)" : ""}</small><strong>${escapeHtml(ioRange(item.startDate, item.endDate))}</strong></span></div>
      ${tracking}${orders ? `<ul class="io-orders">${orders}</ul>` : ""}${placements}</article>`;
  };
  // Completed campaigns stay out of the way: a collapsed card (status and name) in a side column, opened on click.
  const collapse = (html, key) => html
    .replace(/^<article class="([^"]*)"([^>]*)><div class="io-card-head">([\s\S]*?)<\/div>/, (_, classes, attributes, head) => `<details class="${classes} io-card-done"${attributes}${openDoneIo.has(key) ? " open" : ""}><summary class="io-card-head">${head}</summary>`)
    .replace(/<\/article>$/, "</details>");
  const active = summary.filter(item => item.status !== "completed");
  const done = summary.filter(item => item.status === "completed");
  document.querySelector("#client-io-list").innerHTML = active.length ? active.map(cardFor).join("") : summary.length ? '<p class="history-empty">No current campaigns. Completed ones are listed alongside.</p>' : '<p class="history-empty">Upload an insertion order to see its budget and flight here.</p>';
  document.querySelector("#client-io-done").hidden = done.length === 0;
  document.querySelector("#client-io-done-list").innerHTML = done.map(item => collapse(cardFor(item), item.key)).join("");
}
const openDoneIo = new Set();
document.querySelector("#client-io-done-list").addEventListener("toggle", event => {
  const card = event.target.closest?.(".io-card-done");
  if (!card) return;
  if (card.open) openDoneIo.add(card.dataset.ioKey); else openDoneIo.delete(card.dataset.ioKey);
}, true);
document.querySelector("#client-io-upload").addEventListener("click", () => document.querySelector("#client-io-input").click());
document.querySelector("#client-io").addEventListener("click", event => {
  const edit = event.target.closest("[data-edit-campaign]");
  if (!edit) return;
  event.preventDefault();
  openCampaignEdit(edit.dataset.editCampaign);
});

function renderClientDocuments() {
  const panel = document.querySelector("#client-documents");
  panel.hidden = !clientScope;
  if (!clientScope) { lastClientDocuments = []; return; }
  lastClientDocuments = listClientDocuments({ campaigns, totals: campaignTotals, client: clientScope });
  document.querySelector("#client-documents-context").textContent = lastClientDocuments.length ? `${lastClientDocuments.length} upload${lastClientDocuments.length === 1 ? "" : "s"} for ${clientScope} · remove anything that was uploaded by mistake` : `Nothing has been uploaded for ${clientScope} yet`;
  document.querySelector("#client-document-list").innerHTML = lastClientDocuments.length
    ? lastClientDocuments.map(doc => `<div class="document-row"><span class="document-kind kind-${escapeHtml(doc.kind)}">${escapeHtml(DOCUMENT_KINDS[doc.kind] || doc.kind)}</span><span class="document-main"><strong>${escapeHtml(doc.fileName)}</strong><small>${escapeHtml(documentDetail(doc))}</small></span><button class="text-button destructive-text" type="button" data-remove-document="${escapeHtml(doc.id)}" aria-label="Remove ${escapeHtml(doc.fileName)}">Remove</button></div>`).join("")
    : '<p class="history-empty">Reports and insertion orders you import for this client are listed here.</p>';
}

const DOCUMENT_REMOVAL_NOTES = {
  report: "Lines this report brought in are removed; lines that later reports updated go back to the previous report's numbers.",
  daily: "The days of delivery data from this file are removed.",
  "line-items": "The line items from this file are removed.",
  "io-order": "Pacing stops using this order's budget and flight.",
  "io-flights": "The flights saved from this order are removed."
};

/** Removes one uploaded document and the data it added for a client, with a restore point (Undo). */
function removeUploadedDocument(client, doc) {
  const feeds = doc.campaigns?.length ? `\n\nThis file feeds: ${doc.campaigns.join(", ")}.` : "";
  return applyRemoval(`removing ${doc.fileName} from ${client}`, `Remove “${doc.fileName}” and the data it added for ${client}?${feeds}\n\n${DOCUMENT_REMOVAL_NOTES[doc.kind] || ""}`, () => {
    const result = removeClientDocument({ campaigns, totals: campaignTotals, importHistory, client, document: doc });
    campaigns = result.campaigns;
    campaignTotals = writeCampaignTotals(localStorage, result.totals);
    importHistory = result.importHistory;
    writeImportHistory(localStorage, importHistory);
  });
}

document.querySelector("#client-document-list").addEventListener("click", event => {
  const button = event.target.closest("[data-remove-document]");
  const doc = button ? lastClientDocuments.find(item => item.id === button.dataset.removeDocument) : null;
  if (doc) removeUploadedDocument(clientScope, doc);
});

// --- Data sources: every uploaded report, by client or campaign, with when it was uploaded ---
const sourcesFilter = { client: "all", kind: "all", query: "", by: "client" };
let lastSourceDocs = [];
const uploadedText = doc => doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Upload time not recorded";

function sourceDetail(doc) {
  const others = doc.campaigns;
  if (doc.kind === "io-order") return [doc.order, Number.isFinite(doc.budget) ? formatExactMoney(doc.budget) : "", doc.startDate && doc.endDate ? `${doc.startDate} → ${doc.endDate}` : "", others.join(", ")].filter(Boolean).join(" · ");
  const unit = doc.kind === "io-flights" ? "flight" : "line";
  return [`${doc.lines} ${unit}${doc.lines === 1 ? "" : "s"}`, others.join(", "), doc.source && doc.kind !== "report" ? doc.source : "", doc.dataAsOf ? `data through ${doc.dataAsOf}` : "", doc.legacy ? "added before uploads were tracked" : ""].filter(Boolean).join(" · ");
}

function renderDataSources() {
  lastSourceDocs = listAllUploads({ campaigns, totals: campaignTotals, importHistory });
  const clients = [...new Set(lastSourceDocs.map(doc => doc.client))];
  if (sourcesFilter.client !== "all" && !clients.includes(sourcesFilter.client)) sourcesFilter.client = "all";
  const clientSelect = document.querySelector("#sources-client");
  clientSelect.innerHTML = `<option value="all">All clients</option>${clients.map(client => `<option value="${escapeHtml(client)}">${escapeHtml(client)}</option>`).join("")}`;
  clientSelect.value = sourcesFilter.client;
  const kindSelect = document.querySelector("#sources-kind");
  if (!kindSelect.options.length) kindSelect.innerHTML = UPLOAD_KIND_OPTIONS.map(item => `<option value="${item.id}">${escapeHtml(item.label)}</option>`).join("");
  kindSelect.value = sourcesFilter.kind;
  document.querySelector("#sources-group").value = sourcesFilter.by;
  const filtered = filterUploads(lastSourceDocs, sourcesFilter);
  const summary = summarizeUploads(lastSourceDocs);
  const filteredNote = filtered.length === lastSourceDocs.length ? "" : ` · showing ${filtered.length}`;
  document.querySelector("#data-sources-context").textContent = summary.total
    ? `${summary.total} upload${summary.total === 1 ? "" : "s"} across ${summary.clients} client${summary.clients === 1 ? "" : "s"}${summary.latest ? ` · last upload ${uploadedText({ uploadedAt: summary.latest })}` : ""}${filteredNote} · remove anything uploaded by mistake`
    : "Nothing has been uploaded yet";
  const groups = groupUploads(filtered, sourcesFilter.by);
  const row = doc => `<div class="source-row"><span class="document-kind kind-${escapeHtml(doc.kind)}">${escapeHtml(DOCUMENT_KINDS[doc.kind] || doc.kind)}</span><span class="document-main"><strong>${escapeHtml(doc.fileName)}</strong><small>${escapeHtml(sourceDetail(doc))}</small></span><span class="source-when${doc.uploadedAt ? "" : " unknown"}">${escapeHtml(uploadedText(doc))}</span><button class="text-button destructive-text" type="button" data-remove-source="${escapeHtml(`${doc.client}||${doc.id}`)}" aria-label="Remove ${escapeHtml(doc.fileName)} from ${escapeHtml(doc.client)}">Remove</button></div>`;
  document.querySelector("#data-sources-list").innerHTML = groups.length
    ? groups.map(group => `<section class="source-group" aria-label="${escapeHtml(group.label)}"><div class="source-group-head"><h3>${escapeHtml(group.label)}</h3><small>${sourcesFilter.by === "campaign" ? `${escapeHtml(group.client)} · ` : ""}${group.docs.length} upload${group.docs.length === 1 ? "" : "s"}</small></div>${group.docs.map(row).join("")}</section>`).join("")
    : `<p class="history-empty">${summary.total ? "No uploads match these filters." : "Reports, daily files, DSP line items, and insertion orders you upload are listed here."}</p>`;
}

function applySourcesView() {
  document.body.classList.toggle("sources-view", sourcesView);
  document.querySelector("#data-sources-page").hidden = !sourcesView;
  if (!sourcesView) return;
  document.querySelector("#greeting").textContent = "Data sources";
  document.querySelector("#page-subtitle").textContent = "Every report behind the dashboard, grouped by client or campaign, with when it was uploaded.";
  document.querySelector("#client-back").hidden = true;
  document.title = "Zeta | Data sources";
  renderDataSources();
}

function setSourcesView(on) {
  sourcesView = on;
  if (on) { clientScope = null; alertsView = false; pageView = null; }
  history.pushState({ view: on ? "sources" : null }, "", on ? "?view=sources" : location.pathname);
  renderCampaigns();
  window.scrollTo({ top: 0, behavior: "instant" });
}

// --- Alerts page: every active alert, what it is based on, and a way into the campaign behind it ---
const ALERT_TYPES = {
  over: { label: "Overpacing", explain: "The campaign has spent more than a straight-line pace says it should have by today. Left alone, it will run out of budget before the flight ends.", action: "Lower daily caps or bids, or confirm the budget on the IO is right." },
  under: { label: "Underpacing", explain: "The campaign has spent less than a straight-line pace says it should have by today. Left alone, it will not spend its full budget by the end of the flight.", action: "Raise caps or bids, widen targeting, or check that the line is live in the platform." },
  stale: { label: "Stale data", explain: "The newest report for this campaign is older than your stale-data limit, so the numbers here may be behind what the platform shows.", action: "Import a newer report for this campaign." },
  "missing-report": { label: "Overdue report", explain: "This campaign is set to receive a report on a schedule, and the next one has not arrived.", action: "Import the latest report, or change the expected report cadence in Edit campaign." },
  "no-budget": { label: "Budget needed", explain: "There is no budget for this line, so pacing cannot be worked out.", action: "Upload the insertion order, or enter a budget in the campaign details." },
  unmapped: { label: "Needs mapping", explain: "This line has no stable campaign ID, so the next report might not land on it.", action: "Add the source campaign ID in the campaign details." },
  source: { label: "Source discrepancy", explain: "1st-party and 3rd-party numbers for this line disagree by more than your limit.", action: "Compare the two reports and decide which spend to bill on." },
  kpi: { label: "KPI off target", explain: "The campaign's primary KPI is outside the target range by more than your tolerance.", action: "Review creative, targeting and placements for this line." },
  delivery: { label: "DCM gap", explain: "The line’s own report and DCM (CM360) disagree on impressions or clicks by more than your limit, over the same days.", action: "Check the tracking tags and the placements DCM counts for this line." },
  "kpi-decline": { label: "KPI declining", explain: "The primary KPI got worse between the last two reports by more than your limit.", action: "Check what changed between the two reports." }
};
const SEVERITY_LABEL = { critical: "Critical", warning: "Warning", info: "Info" };
const alertsFilter = { client: "all", severity: "all", type: "all", query: "" };
let alertsPageAlerts = [];

function renderAlertsPage() {
  const rows = filterCampaigns(campaigns, { client: "all", status: "all", owner: "all", channel: "all", query: "" });
  const all = unacknowledgedAlerts(evaluateAlerts(rows), acknowledgedAlertIds);
  const clients = [...new Set(all.map(alert => alert.campaign.client))].sort();
  if (alertsFilter.client !== "all" && !clients.includes(alertsFilter.client)) alertsFilter.client = "all";
  document.querySelector("#alerts-client").innerHTML = `<option value="all">All clients</option>${clients.map(client => `<option${client === alertsFilter.client ? " selected" : ""}>${escapeHtml(client)}</option>`).join("")}`;
  const types = [...new Set(all.map(alert => alert.type))];
  document.querySelector("#alerts-type").innerHTML = `<option value="all">All types</option>${types.map(type => `<option value="${type}"${type === alertsFilter.type ? " selected" : ""}>${escapeHtml(ALERT_TYPES[type]?.label || type)}</option>`).join("")}`;
  document.querySelector("#alerts-severity").value = alertsFilter.severity;
  const query = alertsFilter.query.trim().toLowerCase();
  const shown = all.filter(alert => (alertsFilter.client === "all" || alert.campaign.client === alertsFilter.client)
    && (alertsFilter.severity === "all" || alert.severity === alertsFilter.severity)
    && (alertsFilter.type === "all" || alert.type === alertsFilter.type)
    && (!query || [alert.title, alert.detail, alert.campaign.client, alert.campaign.name].some(text => String(text).toLowerCase().includes(query))));
  alertsPageAlerts = shown;
  const count = severity => all.filter(alert => alert.severity === severity).length;
  document.querySelector("#alerts-page-context").textContent = all.length ? `${all.length} active alert${all.length === 1 ? "" : "s"} across ${new Set(all.map(alert => groupKey(alert.campaign))).size} campaign${new Set(all.map(alert => groupKey(alert.campaign))).size === 1 ? "" : "s"} · thresholds come from Alert rules` : "No active alerts. Everything is within your rules.";
  document.querySelector("#alerts-page-summary").innerHTML = ["critical", "warning", "info"].map(severity => `<button type="button" class="alerts-summary-chip ${severity}${alertsFilter.severity === severity ? " active" : ""}" data-alert-severity="${severity}"><strong>${count(severity)}</strong><span>${SEVERITY_LABEL[severity]}</span></button>`).join("");
  document.querySelector("#alerts-page-export").disabled = shown.length === 0;
  document.querySelector("#alerts-page-list").innerHTML = shown.length ? shown.map((alert, position) => {
    const record = alert.campaign;
    const key = groupKey(record);
    const info = ALERT_TYPES[alert.type] || { label: alert.title, explain: "", action: "" };
    const metrics = computeMetrics(campaigns.filter(item => groupKey(item) === key && !isCampaignArchived(item)), { spendView: selectedSource, totals: campaignTotals[key] || null });
    const facts = [
      ["Campaign spend", Number.isFinite(metrics.spend) ? formatMoney(metrics.spend) : "—"],
      ["Campaign budget", Number.isFinite(metrics.budget) && metrics.budget > 0 ? formatMoney(metrics.budget) : "—"],
      ["Campaign pacing", Number.isFinite(metrics.pacing) ? `${metrics.pacing.toFixed(1)}%` : "—"],
      ["Line flight", record.startDate && record.endDate ? `${record.startDate} → ${record.endDate}` : "Not set"],
      ["Data through", record.dataAsOf || "—"]
    ];
    const line = recordLineLabel(record);
    return `<article class="alert-detail ${alert.severity}">
      <div class="alert-detail-head"><span class="alert-symbol ${alert.severity}">${alert.symbol}</span><div><p class="alert-detail-meta"><span class="severity-tag ${alert.severity}">${SEVERITY_LABEL[alert.severity]}</span>${escapeHtml(info.label)}</p><h3>${escapeHtml(alert.title)}</h3><p class="alert-detail-where">${escapeHtml(record.client)} · ${escapeHtml(campaignGroupName(record))}${line && line !== campaignGroupName(record) ? ` · ${escapeHtml(line)}` : ""}</p></div></div>
      <p class="alert-detail-reading"><strong>What it shows:</strong> ${escapeHtml(alert.detail)}</p>
      ${info.explain ? `<p class="alert-detail-explain">${escapeHtml(info.explain)}</p>` : ""}
      <dl class="alert-detail-facts">${facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
      ${info.action ? `<p class="alert-detail-action"><strong>Next step:</strong> ${escapeHtml(info.action)}</p>` : ""}
      <div class="alert-detail-buttons"><button class="primary-button" type="button" data-alert-open="${position}">Open campaign details</button><button class="secondary-button" type="button" data-alert-client="${escapeHtml(record.client)}">Go to ${escapeHtml(record.client)}</button><button class="text-button" type="button" data-alert-ack="${position}">Acknowledge</button></div>
    </article>`;
  }).join("") : `<p class="history-empty">${all.length ? "No alerts match these filters." : "No active alerts right now."}</p>`;
}

function applyAlertsView() {
  document.body.classList.toggle("alerts-view", alertsView);
  document.querySelector("#alerts-page").hidden = !alertsView;
  const link = document.querySelector("#nav-alerts");
  link.classList.toggle("active", alertsView);
  if (alertsView) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  if (!alertsView) return;
  document.querySelector("#nav-overview").classList.remove("active");
  document.querySelector("#nav-overview").removeAttribute("aria-current");
  document.querySelector("#greeting").textContent = "Alerts";
  document.querySelector("#page-subtitle").textContent = "Read each alert in full, see what it is based on, and jump into the campaign.";
  document.querySelector("#client-back").hidden = true;
  document.title = "Zeta | Alerts";
  renderAlertsPage();
}

function setAlertsView(on) {
  alertsView = on;
  if (on) { clientScope = null; sourcesView = false; pageView = null; }
  history.pushState({ view: on ? "alerts" : null }, "", on ? "?view=alerts" : location.pathname);
  renderCampaigns();
  window.scrollTo({ top: 0, behavior: "instant" });
}

document.querySelector("#alerts-client").addEventListener("change", event => { alertsFilter.client = event.target.value; renderAlertsPage(); });
document.querySelector("#alerts-severity").addEventListener("change", event => { alertsFilter.severity = event.target.value; renderAlertsPage(); });
document.querySelector("#alerts-type").addEventListener("change", event => { alertsFilter.type = event.target.value; renderAlertsPage(); });
document.querySelector("#alerts-search").addEventListener("input", event => { alertsFilter.query = event.target.value; renderAlertsPage(); });
document.querySelector("#alerts-page-rules").addEventListener("click", () => document.querySelector("#alert-settings-button").click());
document.querySelector("#alerts-page-export").addEventListener("click", () => {
  if (!alertsPageAlerts.length) return;
  const url = URL.createObjectURL(new Blob([exportAlertsCsv(alertsPageAlerts)], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `zeta-alerts-${new Date().toISOString().slice(0, 10)}.csv` });
  link.click();
  URL.revokeObjectURL(url);
});
document.querySelector("#alerts-page").addEventListener("click", event => {
  const chip = event.target.closest("[data-alert-severity]");
  if (chip) { alertsFilter.severity = alertsFilter.severity === chip.dataset.alertSeverity ? "all" : chip.dataset.alertSeverity; renderAlertsPage(); return; }
  const open = event.target.closest("[data-alert-open]");
  if (open) { const alert = alertsPageAlerts[Number(open.dataset.alertOpen)]; if (alert) openCampaignDialog(campaigns.indexOf(alert.campaign), alert.id); return; }
  const client = event.target.closest("[data-alert-client]");
  if (client) { alertsView = false; setClientScope(client.dataset.alertClient); return; }
  const ack = event.target.closest("[data-alert-ack]");
  if (ack) {
    const alert = alertsPageAlerts[Number(ack.dataset.alertAck)];
    if (!alert) return;
    acknowledgedAlertIds = acknowledgeAlert(acknowledgedAlertIds, alert);
    writeAcknowledgedAlerts(localStorage, acknowledgedAlertIds);
    renderCampaigns(document.querySelector("#client-filter").value);
  }
});
document.querySelector("#alert-card").addEventListener("click", () => setAlertsView(true));
document.querySelector("#alert-card").addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setAlertsView(true); } });
document.querySelector("#view-all-alerts").addEventListener("click", () => setAlertsView(true));

// --- Client to-dos: the morning scan's checklist plus what the dashboard's own alerts say to do ---
const saveTodos = () => { todos = pruneTodos(todos); writeTodos(localStorage, todos); };
const TAG_LABEL = { urgent: "Urgent", waiting: "Waiting", todo: "To-do", upcoming: "Upcoming", fyi: "FYI" };
const todoTag = item => item.tag && item.tag !== "todo" ? `<em class="todo-tag ${item.tag}">${TAG_LABEL[item.tag]}</em>` : "";

/** Takes in one parsed file: a brief replaces the last brief's open items; a plain checklist adds to the list. */
function takeInTodos(parsed) {
  if (!parsed.brief) {
    const result = mergeTodos(todos, parsed.items);
    todos = result.todos;
    return { added: result.added, updated: 0, removed: 0 };
  }
  const result = applyBrief(todos, parsed);
  todos = result.todos;
  if (!brief || parsed.brief.date >= brief.date) {
    brief = { ...parsed.brief, receivedAt: new Date().toISOString() };
    localStorage.setItem(BRIEF_KEY, JSON.stringify(brief));
  }
  return result;
}

// --- Morning brief on the overview: today's meetings, then one feed of open items you can narrow to a client ---
let briefFeedClient = "all";
let briefFeedExpanded = false;
const BRIEF_FEED_LIMIT = 6;
function renderMorningBrief() {
  const panel = document.querySelector("#morning-brief");
  const show = !clientScope && !sourcesView && !alertsView && (pageView === "brief" || (!pageView && (brief || todos.some(isOpen))));
  panel.hidden = !show;
  if (!show) return;
  const today = todayIso();
  const open = sortTodos(todos.filter(isOpen));
  const stale = brief && brief.date < today;
  document.querySelector("#morning-brief-title").textContent = brief ? `Morning brief · ${new Date(`${brief.date}T00:00:00Z`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}` : "To-dos";
  document.querySelector("#morning-brief-context").innerHTML = brief ? `${escapeHtml(brief.sources || "Morning scan")}${brief.skipped ? ` · <span class="warning-text">${escapeHtml(brief.skipped)}</span>` : ""}${stale ? ' · <span class="warning-text">not today’s brief yet</span>' : ""}` : "Add a morning brief to see your day here";
  const calendar = stale ? [] : brief?.calendar || [];
  document.querySelector("#morning-brief-calendar").innerHTML = calendar.length ? `<span class="brief-strip-label">Today</span>${calendar.map(entry => `<span class="brief-meeting"><b>${escapeHtml(entry.time)}</b>${escapeHtml(entry.title)}</span>`).join("")}` : "";
  // The Daily brief page already lists every item by account, so the feed shows only on the overview.
  const feedShown = pageView !== "brief";
  for (const id of ["#morning-brief-filter", "#morning-brief-feed", "#morning-brief-more"]) document.querySelector(id).hidden = !feedShown;
  if (!feedShown) return;
  const counts = new Map();
  open.forEach(item => counts.set(item.client, (counts.get(item.client) || 0) + 1));
  if (briefFeedClient !== "all" && !counts.has(briefFeedClient)) briefFeedClient = "all";
  const accounts = [...counts.keys()].sort((a, b) => (a === INTERNAL) - (b === INTERNAL) || a.localeCompare(b));
  document.querySelector("#morning-brief-filter").innerHTML = open.length ? [["all", "All", open.length], ...accounts.map(account => [account, account, counts.get(account)])].map(([value, label, count]) => `<button type="button" class="brief-chip" data-brief-client="${escapeHtml(value)}" aria-pressed="${briefFeedClient === value}">${escapeHtml(label)}<span>${count}</span></button>`).join("") : "";
  const items = open.filter(item => briefFeedClient === "all" || item.client === briefFeedClient);
  const shown = briefFeedExpanded ? items : items.slice(0, BRIEF_FEED_LIMIT);
  document.querySelector("#morning-brief-feed").innerHTML = shown.length ? shown.map(item => todoRowHtml(item, { showClient: briefFeedClient === "all" })).join("") : '<li class="brief-empty">Nothing open</li>';
  document.querySelector("#morning-brief-more").innerHTML = items.length > BRIEF_FEED_LIMIT ? `<button class="text-button" type="button" data-brief-more>${briefFeedExpanded ? "Show less" : `Show all ${items.length}`}</button>` : "";
}
const trackedClients = () => [...new Set(campaigns.filter(record => !isCampaignArchived(record)).map(record => record.client))].filter(client => client !== INTERNAL).sort((a, b) => a.localeCompare(b));

function renderClientTodos() {
  const panel = document.querySelector("#client-todos");
  panel.hidden = !clientScope;
  if (!clientScope) return;
  const mine = sortTodos(todos.filter(item => item.client === clientScope));
  const open = mine.filter(isOpen).length;
  const today = todayIso();
  document.querySelector("#client-todos-context").textContent = mine.length ? `${open} open${mine.length > open ? ` · ${mine.length - open} done (cleared after two weeks)` : ""}` : "Nothing yet. Add your morning scan, or type one below.";
  document.querySelector("#client-todo-list").innerHTML = mine.map(item => todoRowHtml(item)).join("");
  // The dashboard's own reasons to act on this client, read from its open alerts.
  const clientAlerts = unacknowledgedAlerts(evaluateAlerts(campaigns.filter(record => record.client === clientScope && !isCampaignArchived(record))), acknowledgedAlertIds);
  document.querySelector("#client-todo-auto").innerHTML = clientAlerts.length ? `<p class="client-section-label">From the dashboard</p><ul class="todo-auto-list">${clientAlerts.slice(0, 4).map(alert => `<li class="${alert.severity}"><span class="client-alert-dot"></span><span><b>${escapeHtml(ALERT_TYPES[alert.type]?.action || alert.title)}</b><small>${escapeHtml(ALERT_TYPES[alert.type]?.label || alert.title)} · ${escapeHtml(recordLineLabel(alert.campaign))} · ${escapeHtml(String(alert.detail).replace(/ · /g, ", "))}</small></span></li>`).join("")}</ul>${clientAlerts.length > 4 ? `<button class="text-button" type="button" data-todo-alerts>See all ${clientAlerts.length} alerts</button>` : ""}` : "";
}

document.querySelector("#todo-quick-add").addEventListener("submit", event => {
  event.preventDefault();
  const text = document.querySelector("#todo-quick-text").value.trim();
  if (!text || !clientScope) return;
  const due = document.querySelector("#todo-quick-due").value || null;
  todos = mergeTodos(todos, [{ client: clientScope, text, due, source: "Added by you", addedOn: todayIso() }]).todos;
  saveTodos();
  document.querySelector("#todo-quick-add").reset();
  renderCampaigns(document.querySelector("#client-filter").value);
});

const todoDialog = document.querySelector("#todo-dialog");
let todoParsed = { items: [], unknownClients: [] };
function previewTodos() {
  todoParsed = parseTodoFile(document.querySelector("#todo-text").value, { clients: trackedClients(), today: todayIso() });
  const accountCount = new Set(todoParsed.items.map(item => item.client)).size;
  const parts = todoParsed.brief ? [`Morning brief for ${shortDate(todoParsed.brief.date)}${todoParsed.brief.calendar.length ? ` · ${todoParsed.brief.calendar.length} meeting${todoParsed.brief.calendar.length === 1 ? "" : "s"}` : ""}`] : [];
  if (todoParsed.items.length) parts.push(`${todoParsed.items.length} item${todoParsed.items.length === 1 ? "" : "s"} across ${accountCount} account${accountCount === 1 ? "" : "s"}`);
  if (todoParsed.brief) parts.push("replaces the last brief’s open items");
  if (todoParsed.unknownClients.length) parts.push(`not on the dashboard yet: ${todoParsed.unknownClients.join(", ")} (shown with the brief)`);
  document.querySelector("#todo-preview").textContent = parts.length ? parts.join(" · ") : document.querySelector("#todo-text").value.trim() ? "Nothing found. Each account needs a \"## Account\" heading with \"- [ ] item\" lines under it." : "";
  document.querySelector("#todo-add").disabled = !todoParsed.items.length && !todoParsed.brief;
}
function openTodoDialog() {
  document.querySelector("#todo-text").value = "";
  previewTodos();
  todoDialog.showModal();
}
document.querySelector("#client-todo-import").addEventListener("click", openTodoDialog);
document.querySelector("#overview-todo-import").addEventListener("click", openTodoDialog);
document.querySelector("#brief-add").addEventListener("click", openTodoDialog);
document.querySelector("#todo-text").addEventListener("input", previewTodos);
document.querySelector("#todo-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  document.querySelector("#todo-text").value = await file.text();
  event.target.value = "";
  previewTodos();
});
document.querySelector("#todo-copy-prompt").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(morningScanPrompt(trackedClients()));
    showToast("Prompt copied", "Paste it into a scheduled ChatGPT task that can read your Outlook.");
  } catch {
    document.querySelector("#todo-text").value = morningScanPrompt(trackedClients());
    previewTodos();
  }
});
document.querySelector("#todo-download-template").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([todoTemplate(trackedClients(), todayIso())], { type: "text/markdown;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `northstar-todos-${todayIso()}.md` });
  link.click();
  URL.revokeObjectURL(url);
});
// --- Watched to-do folder: the morning scan saves a checklist there and the dashboard takes it in on its own ---
const FOLDER_KEY = "todo-folder";
const folderSupported = typeof window.showDirectoryPicker === "function" && typeof indexedDB !== "undefined";
let todoFolder = null;
let folderState = { lastChecked: null, lastAdded: 0, needsClick: false };

function renderFolderStatus() {
  const status = document.querySelector("#todo-folder-status");
  document.querySelector("#todo-folder-connect").textContent = todoFolder ? "Change folder…" : "Connect folder…";
  document.querySelector("#todo-folder-connect").disabled = !folderSupported;
  document.querySelector("#todo-folder-disconnect").hidden = !todoFolder;
  document.querySelector("#todo-folder-reconnect").hidden = !(todoFolder && folderState.needsClick);
  if (!folderSupported) { status.textContent = "Watching a folder needs Chrome or Edge. In this browser, paste or drop the file instead."; return; }
  if (pageView === "automation") renderAutomationPage();
  if (!todoFolder) return;
  status.textContent = folderState.needsClick
    ? `Watching “${todoFolder.name}”. Chrome needs one click this visit: use Check to-do folder next to Clients.`
    : `Watching “${todoFolder.name}”${folderState.lastChecked ? ` · checked ${folderState.lastChecked.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${folderState.lastAdded ? ` · ${folderState.lastAdded} added` : ""}` : ""}.`;
}

/** Reads new files in the watched folder. `ask` is true only from a click, when Chrome may show its permission prompt. */
async function checkTodoFolder({ ask = false } = {}) {
  if (!todoFolder) return;
  let permission = await todoFolder.queryPermission({ mode: "read" });
  if (permission !== "granted" && ask) permission = await todoFolder.requestPermission({ mode: "read" });
  folderState.needsClick = permission !== "granted";
  if (folderState.needsClick) { renderFolderStatus(); return; }
  try {
    const result = await readTodoFolder(todoFolder, readProcessedFiles(localStorage), { clients: trackedClients(), today: todayIso() });
    localStorage.setItem(TODO_FILES_KEY, JSON.stringify(result.processed));
    const totals = result.files.reduce((sum, file) => { const taken = takeInTodos(file.parsed); return { added: sum.added + taken.added, changed: sum.changed + taken.added + taken.updated + taken.removed }; }, { added: 0, changed: 0 });
    folderState = { lastChecked: new Date(), lastAdded: totals.added, needsClick: false };
    if (result.filesRead) {
      saveTodos();
      renderCampaigns(document.querySelector("#client-filter").value);
      if (totals.changed) showToast(result.files.some(file => file.parsed.brief) ? "Morning brief updated" : "New to-dos", `${totals.added} new item${totals.added === 1 ? "" : "s"} from ${result.filesRead} file${result.filesRead === 1 ? "" : "s"} in “${todoFolder.name}”.`);
    }
  } catch (error) {
    folderState.needsClick = true;
  }
  renderFolderStatus();
}

document.querySelector("#todo-folder-connect").addEventListener("click", async () => {
  try {
    const handle = await window.showDirectoryPicker({ id: "northstar-todos", mode: "read" });
    todoFolder = handle;
    await saveFolderHandle(indexedDB, FOLDER_KEY, handle);
    // A newly chosen folder is read in full, even files with names seen in an earlier folder.
    localStorage.removeItem(TODO_FILES_KEY);
    await checkTodoFolder({ ask: true });
  } catch { /* the picker was closed */ }
  renderFolderStatus();
});
document.querySelector("#todo-folder-disconnect").addEventListener("click", async () => {
  todoFolder = null;
  await saveFolderHandle(indexedDB, FOLDER_KEY, null).catch(() => {});
  renderFolderStatus();
});
document.querySelector("#todo-folder-reconnect").addEventListener("click", () => checkTodoFolder({ ask: true }));
if (folderSupported) {
  loadFolderHandle(indexedDB, FOLDER_KEY).then(handle => {
    todoFolder = handle;
    renderFolderStatus();
    return checkTodoFolder();
  }).catch(() => renderFolderStatus());
  setInterval(() => { if (todoFolder && !folderState.needsClick && document.visibilityState === "visible") checkTodoFolder(); }, 5 * 60_000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && todoFolder && !folderState.needsClick) checkTodoFolder(); });
} else renderFolderStatus();

document.querySelector("#todo-add").addEventListener("click", () => {
  const result = takeInTodos(todoParsed);
  saveTodos();
  todoDialog.close();
  renderCampaigns(document.querySelector("#client-filter").value);
  showToast(todoParsed.brief ? "Morning brief added" : "To-dos added", `${result.added} new${result.updated ? `, ${result.updated} updated` : ""}${result.removed ? `, ${result.removed} resolved since the last brief` : ""}.`);
});

// --- Daily brief and Automation pages ---
function setPageView(page) {
  pageView = PAGE_VIEWS.includes(page) ? page : null;
  clientScope = null;
  sourcesView = false;
  alertsView = false;
  history.pushState({ view: pageView }, "", pageView ? `?view=${pageView}` : location.pathname);
  renderCampaigns();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function applyPageView() {
  for (const page of PAGE_VIEWS) document.body.classList.toggle(`${page}-view`, pageView === page);
  document.querySelector("#brief-page").hidden = pageView !== "brief";
  document.querySelector("#automation-page").hidden = pageView !== "automation";
  document.querySelector("#review-page").hidden = pageView !== "review";
  document.querySelector("#billing-page").hidden = pageView !== "billing";
  document.querySelector("#settings-page").hidden = pageView !== "settings";
  if (!pageView) return;
  document.querySelector("#client-back").hidden = true;
  const titles = { brief: "Daily brief", automation: "Automation", review: "Report review", billing: "Billing", settings: "Settings" };
  const subtitles = { brief: "Your morning brief and every client's to-dos in one place.", automation: "Set up the morning brief and report uploads, step by step.", review: "Reports the automation held for you, and imports that need a look.", billing: "Monthly billing for each client, filled from DCM and DSP.", settings: "Every setting and workspace tool in one place." };
  document.querySelector("#greeting").textContent = titles[pageView];
  document.querySelector("#page-subtitle").textContent = subtitles[pageView];
  document.title = `Zeta | ${titles[pageView]}`;
  if (pageView === "brief") renderBriefPage();
  else if (pageView === "billing") renderBillingPage();
  else if (pageView === "settings") renderSettingsPage();
  else if (pageView === "automation") { renderAutomationPage(); renderReportAutomation(); }
  else renderReportAutomation();
}

/** One to-do row with its checkbox, tag, due date, source, link, and remove button. */
/** A to-do's link text: the Jira key, "Email" for an Outlook message, or "Open link". */
function linkLabel(link) {
  const ticket = /browse\/([A-Z]+-\d+)/.exec(link)?.[1];
  if (ticket) return ticket;
  if (/outlook\.(office|office365|live)\.com|outlook\.com\/(mail|owa)/i.test(link)) return "Email";
  return "Open link";
}

function todoRowHtml(item, { showClient = false } = {}) {
  const today = todayIso();
  const meta = [
    showClient ? escapeHtml(item.client) : "",
    item.due ? `<span class="${!item.done && item.due < today ? "overdue" : ""}">Due ${escapeHtml(longDate(item.due))}</span>` : "",
    item.source ? escapeHtml(item.source) : "",
    item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${escapeHtml(linkLabel(item.link))} ↗</a>` : "",
    item.origin === "brief" && item.briefDate ? `brief ${escapeHtml(shortDate(item.briefDate))}` : item.addedOn ? `added ${escapeHtml(shortDate(item.addedOn))}` : ""
  ].filter(Boolean).join(" · ");
  return `<li class="${item.done ? "done" : ""}${item.tag === "fyi" ? " fyi" : ""}"><label><input type="checkbox" data-todo-done="${escapeHtml(item.id)}"${item.done ? " checked" : ""} /><span>${todoTag(item)}${escapeHtml(item.text)}</span></label><small>${meta}</small><button class="todo-remove" type="button" data-todo-remove="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.text)}" title="Remove">✕</button></li>`;
}

function renderBriefPage() {
  const showAll = document.querySelector("#brief-filter").value === "all";
  const visible = todos.filter(item => showAll || !item.done);
  const clients = trackedClients();
  const accounts = [...clients, INTERNAL, ...[...new Set(todos.filter(item => item.tracked === false).map(item => item.client))].sort()];
  const groups = accounts.map(account => ({ account, items: sortTodos(visible.filter(item => item.client === account)) })).filter(group => group.items.length);
  const open = todos.filter(isOpen).length;
  document.querySelector("#brief-page-context").textContent = `${open} open across ${new Set(todos.filter(isOpen).map(item => item.client)).size} account${new Set(todos.filter(isOpen).map(item => item.client)).size === 1 ? "" : "s"} · most urgent first`;
  const select = document.querySelector("#brief-quick-client");
  const chosen = select.value;
  select.innerHTML = [...clients, INTERNAL].map(client => `<option${client === chosen ? " selected" : ""}>${escapeHtml(client)}</option>`).join("");
  document.querySelector("#brief-groups").innerHTML = groups.length ? groups.map(group => {
    const tracked = clients.includes(group.account);
    return `<div class="brief-group"><div class="brief-group-head"><h3>${escapeHtml(group.account)}</h3>${tracked ? `<a class="text-button" href="?client=${encodeURIComponent(group.account)}" data-client-link="${escapeHtml(group.account)}">Open client ›</a>` : group.account === INTERNAL ? "" : '<small>Not on the dashboard yet</small>'}</div><ul class="todo-list">${group.items.map(item => todoRowHtml(item)).join("")}</ul></div>`;
  }).join("") : `<p class="history-empty">No to-dos yet. Set up the morning brief on the <a href="?view=automation" data-page-view="automation">Automation</a> page, or add one above.</p>`;
}

// Checking, removing, and adding work the same on the client panel and the Daily brief page.
for (const container of ["#client-todos", "#brief-page", "#morning-brief"]) {
  document.querySelector(container).addEventListener("change", event => {
    const box = event.target.closest("[data-todo-done]");
    if (!box) return;
    todos = setTodoDone(todos, box.dataset.todoDone, box.checked);
    saveTodos();
    renderCampaigns(document.querySelector("#client-filter").value);
  });
  document.querySelector(container).addEventListener("click", event => {
    const remove = event.target.closest("[data-todo-remove]");
    if (remove) { todos = todos.filter(item => item.id !== remove.dataset.todoRemove); saveTodos(); renderCampaigns(document.querySelector("#client-filter").value); return; }
    if (event.target.closest("[data-todo-alerts]")) { alertsFilter.client = clientScope; setAlertsView(true); return; }
    const chip = event.target.closest("[data-brief-client]");
    if (chip) { briefFeedClient = chip.dataset.briefClient; briefFeedExpanded = false; renderMorningBrief(); return; }
    if (event.target.closest("[data-brief-more]")) { briefFeedExpanded = !briefFeedExpanded; renderMorningBrief(); return; }
    const page = event.target.closest("[data-page-view]");
    if (page) { event.preventDefault(); setPageView(page.dataset.pageView); return; }
    const client = event.target.closest("[data-client-link]");
    if (client) { event.preventDefault(); setClientScope(client.dataset.clientLink); }
  });
}
document.querySelector("#brief-filter").addEventListener("change", renderBriefPage);
document.querySelector("#brief-quick-add").addEventListener("submit", event => {
  event.preventDefault();
  const text = document.querySelector("#brief-quick-text").value.trim();
  const client = document.querySelector("#brief-quick-client").value;
  if (!text || !client) return;
  todos = mergeTodos(todos, [{ client, text, due: document.querySelector("#brief-quick-due").value || null, source: "Added by you", addedOn: todayIso() }]).todos;
  saveTodos();
  document.querySelector("#brief-quick-text").value = "";
  document.querySelector("#brief-quick-due").value = "";
  renderCampaigns();
});

// --- Automation setup guide ---
let automation = readAutomationSettings(localStorage);
const saveAutomation = () => localStorage.setItem(AUTOMATION_KEY, JSON.stringify(automation));
const AUTOMATION_FIELDS = { "#auto-name": "name", "#auto-email": "email", "#auto-jira-user": "jiraUser", "#auto-jira-site": "jiraSite", "#auto-timezone": "timezone", "#auto-run-time": "runTime", "#auto-folder": "folder", "#auto-extra": "extraAccounts" };
if (!automation.timezone) automation.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
for (const [selector, field] of Object.entries(AUTOMATION_FIELDS)) document.querySelector(selector).value = automation[field] ?? "";
document.querySelector("#auto-slack").checked = Boolean(automation.slack);
const currentPrompt = () => morningScanPrompt(trackedClients(), automation);

function stepStatus(id, state, label) {
  const badge = document.querySelector(`#step-${id}-status`);
  badge.className = `step-status ${state}`;
  badge.textContent = label || { done: "✓", todo: "", warn: "!" }[state];
  badge.closest(".automation-step").classList.toggle("is-done", state === "done");
}

function renderAutomationPage() {
  const clients = trackedClients();
  stepStatus("clients", clients.length ? "done" : "todo");
  document.querySelector("#step-clients-detail").textContent = clients.length ? `${clients.length} client${clients.length === 1 ? "" : "s"} on the dashboard: ${clients.join(", ")}. Add any that are missing before you copy the prompt.` : "No clients yet. Upload an IO to add your first one.";
  stepStatus("folder", todoFolder ? "done" : "todo");
  document.querySelector("#step-folder-name").textContent = automation.folder || "Northstar To-dos";
  stepStatus("connect", todoFolder ? (folderState.needsClick ? "warn" : "done") : "todo");
  document.querySelector("#step-connect-detail").textContent = !folderSupported ? "This browser can't watch a folder. Open the dashboard in Chrome or Edge." : todoFolder ? `Connected to “${todoFolder.name}”.${folderState.needsClick ? " Chrome needs one click this visit: press Connect folder again." : ""}` : "Not connected yet.";
  document.querySelector("#step-connect-button").textContent = todoFolder ? "Change folder…" : "Connect folder…";
  document.querySelector("#step-connect-button").disabled = !folderSupported;
  // A prompt copied before clients were added leaves them out of the brief.
  const copiedFor = automation.promptClients || null;
  const missing = copiedFor ? clients.filter(client => !copiedFor.includes(client)) : [];
  stepStatus("prompt", !automation.promptCopiedAt ? "todo" : missing.length ? "warn" : "done");
  document.querySelector("#step-prompt-clients").innerHTML = missing.length
    ? `<span class="warning-text">You've added ${escapeHtml(missing.join(", "))} since you copied the prompt. Copy it again and update your ChatGPT task.</span>`
    : clients.length ? `The prompt includes ${clients.length} client${clients.length === 1 ? "" : "s"}${automation.promptCopiedAt ? ` · copied ${escapeHtml(new Date(automation.promptCopiedAt).toLocaleDateString([], { month: "short", day: "numeric" }))}` : ""}.` : '<span class="warning-text">Add your clients first (step 1), so the prompt lists them.</span>';
  document.querySelector("#auto-prompt-preview").textContent = currentPrompt();
  document.querySelector("#step-schedule-quote").textContent = `Run this every weekday at ${automation.runTime || "7:00 AM"}${automation.timezone ? ` ${automation.timezone}` : ""}.`;
  stepStatus("schedule", automation.scheduledAt ? "done" : "todo");
  document.querySelector("#step-schedule-done").textContent = automation.scheduledAt ? "Scheduled ✓" : "I've scheduled it";
  const recent = brief && (Date.parse(`${todayIso()}T00:00:00Z`) - Date.parse(`${brief.date}T00:00:00Z`)) / 86_400_000 <= 3;
  stepStatus("test", recent ? "done" : "todo");
  document.querySelector("#step-test-detail").textContent = brief ? `Last brief: ${longDate(brief.date)} from ${brief.sources || "the morning scan"}${brief.skipped ? ` (skipped: ${brief.skipped})` : ""}.` : "No brief has arrived yet.";
  const done = document.querySelectorAll("#brief-steps .automation-step.is-done").length;
  const total = document.querySelectorAll("#brief-steps .automation-step").length;
  document.querySelector("#automation-progress").innerHTML = `<div class="progress-track"><span style="width:${done / total * 100}%"></span></div><span>${done} of ${total} steps done${done === total ? " · your morning brief is set up" : ""}</span>`;
}

document.querySelector("#automation-page").addEventListener("input", event => {
  const field = AUTOMATION_FIELDS[`#${event.target.id}`];
  if (field) automation[field] = event.target.value;
  if (event.target.id === "auto-slack") automation.slack = event.target.checked;
  if (field || event.target.id === "auto-slack") { saveAutomation(); renderAutomationPage(); }
});
document.querySelector("#automation-page").addEventListener("change", event => {
  if (event.target.id === "auto-slack") { automation.slack = event.target.checked; saveAutomation(); renderAutomationPage(); }
});
document.querySelector("#automation-page").addEventListener("click", async event => {
  const page = event.target.closest(".automation-review-inline");
  if (page) { event.preventDefault(); setPageView("review"); return; }
  const copy = event.target.closest("[data-copy-target]");
  if (copy) { try { await navigator.clipboard.writeText(document.querySelector(`#${copy.dataset.copyTarget}`).textContent); showToast("Copied", "Folder name copied."); } catch { /* the name stays visible to copy by hand */ } }
});
document.querySelector("#auto-copy-prompt").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentPrompt());
    automation.promptCopiedAt = new Date().toISOString();
    automation.promptClients = trackedClients();
    saveAutomation();
    renderAutomationPage();
    showToast("Prompt copied", "Paste it into a new ChatGPT chat with your connectors turned on (step 5).");
  } catch {
    document.querySelector(".prompt-preview").open = true;
    showToast("Copy it by hand", "Your browser blocked copying. Select the prompt in “See the full prompt” and copy it.");
  }
});
document.querySelector("#auto-download-template").addEventListener("click", () => document.querySelector("#todo-download-template").click());
document.querySelector("#step-clients-upload").addEventListener("click", () => document.querySelector("#client-io-button").click());
document.querySelector("#step-clients-report").addEventListener("click", () => document.querySelector("#upload-button").click());
document.querySelector("#step-connect-button").addEventListener("click", () => document.querySelector("#todo-folder-connect").click());
document.querySelector("#step-schedule-done").addEventListener("click", () => {
  automation.scheduledAt = automation.scheduledAt ? null : new Date().toISOString();
  saveAutomation();
  renderAutomationPage();
});

// --- Watched report folder: new reports import on their own when every campaign in them matches one on the dashboard ---
const REPORT_FOLDER_KEY = "report-folder";
const REPORT_ACTIVITY_KEY = "northstar-report-activity";
let reportFolder = null;
// A second, personal folder for DCM emails that Power Automate saves, kept apart from the team's shared report folder.
const DCM_FOLDER_KEY = "dcm-folder";
const DCM_PREFIX = "DCM:";
let dcmFolder = null;
const watchedFolders = () => [[reportFolder, ""], [dcmFolder, DCM_PREFIX]].filter(([folder]) => folder);
const folderForKey = key => key.startsWith(DCM_PREFIX) ? [dcmFolder, key.slice(DCM_PREFIX.length)] : [reportFolder, key];
let reportState = { lastChecked: null, needsClick: false, running: false, scanned: 0, truncated: false };
let reportSettings = readReportSettings(localStorage);
const readReportActivity = () => { try { const value = JSON.parse(localStorage.getItem(REPORT_ACTIVITY_KEY)); return Array.isArray(value) ? value : []; } catch { return []; } };

/** Whether a prepared import can go in without a person: every campaign in it lands on one already on the dashboard. */
function importIsClear() {
  if (pendingValidatedImport.kind === "delivery") {
    const plan = deliveryPlan();
    const unmatched = plan.find(item => !item.target);
    if (unmatched) return { clear: false, reason: `${deliveryLabel()} campaign “${unmatched.entry.sourceCampaignName || unmatched.entry.sourceCampaignId}” doesn't match a campaign on the dashboard. Pick the campaign once and later reports follow it.` };
    if (!plan.some(item => item.assigned.size)) return { clear: false, reason: "None of its lines matched a line on the dashboard. Review it to check the campaign." };
    return { clear: true };
  }
  const existing = new Set(groupCampaigns(campaigns.filter(record => !isCampaignArchived(record))).map(group => group.key));
  if (!effectiveImport().campaigns.length) return { clear: false, reason: "Every line in it is skipped" };
  for (const group of importGroups()) {
    const choice = groupChoice(group);
    if (choice === SKIP || (choice && existing.has(choice)) || (choice === KEEP && existing.has(group.key))) continue;
    const actions = previewCampaignImport(campaigns, group.rows).actions.map(item => item.action);
    if (actions.length && actions.every(action => action === "update")) continue;
    return { clear: false, reason: `“${group.name}” doesn't match a campaign on the dashboard. Upload its IO first, or pick the campaign yourself.` };
  }
  return { clear: true };
}

async function checkReportFolder({ ask = false } = {}) {
  await deliveryReady;
  if (!watchedFolders().length || reportState.running || dialog.open) return;
  let granted = true;
  for (const [folder] of watchedFolders()) {
    let permission = await folder.queryPermission({ mode: "read" });
    if (permission !== "granted" && ask) permission = await folder.requestPermission({ mode: "read" });
    if (permission !== "granted") granted = false;
  }
  reportState.needsClick = !granted;
  if (reportState.needsClick) { renderReportAutomation(); return; }
  reportState.running = true;
  renderReportAutomation();
  const imported = [];
  try {
    let ledger = readReportLedger(localStorage);
    let inbox = readReportInbox(localStorage);
    const activity = readReportActivity();
    const files = [];
    reportState.scanned = 0;
    reportState.truncated = false;
    for (const [folder, prefix] of watchedFolders()) {
      // Each folder sees its own part of the ledger; the DCM folder takes every file, whatever its folder is called.
      const view = Object.fromEntries(Object.entries(ledger).filter(([key]) => prefix ? key.startsWith(prefix) : !key.startsWith(DCM_PREFIX)).map(([key, value]) => [key.slice(prefix.length), value]));
      const scan = await findNewReports(folder, view, prefix ? { ...reportSettings, onlyReportFolders: false } : reportSettings);
      reportState.scanned += scan.scanned;
      reportState.truncated ||= scan.truncated;
      files.push(...scan.files.map(entry => ({ ...entry, key: prefix + entry.key, path: prefix ? ["DCM folder", ...entry.path] : entry.path })));
    }
    for (const entry of files.sort((a, b) => a.lastModified - b.lastModified)) {
      let outcome;
      let reason = "";
      const prepared = await prepareImport(entry.file);
      if (prepared.status === "duplicate") outcome = "already imported";
      else if (prepared.status === "rejected") { outcome = "couldn't read"; reason = prepared.messages[0]; }
      else {
        pendingValidatedImport = prepared.pending;
        if (pendingValidatedImport.kind !== "delivery") normalizeLineSkips();
        const check = importIsClear();
        if (check.clear) {
          const lines = commitPendingImport({ automatic: true });
          outcome = "imported";
          reason = `${lines} line${lines === 1 ? "" : "s"}`;
          imported.push(entry.name);
        } else { outcome = "needs review"; reason = check.reason; }
        pendingValidatedImport = null;
      }
      ledger = noteReport(ledger, entry.key, entry.lastModified, outcome, reportSettings);
      inbox = inbox.filter(item => item.key !== entry.key);
      if (outcome === "needs review" || outcome === "couldn't read") inbox.push({ key: entry.key, name: entry.name, folder: entry.path.join(" › "), reason, outcome, foundAt: new Date().toISOString() });
      activity.unshift({ at: new Date().toISOString(), name: entry.name, outcome, reason });
    }
    localStorage.setItem(REPORT_LEDGER_KEY, JSON.stringify(ledger));
    localStorage.setItem(REPORT_INBOX_KEY, JSON.stringify(inbox));
    localStorage.setItem(REPORT_ACTIVITY_KEY, JSON.stringify(activity.slice(0, 40)));
    reportState.lastChecked = new Date();
  } catch (error) {
    console.warn("Report folder check failed", error);
    reportState.needsClick = true;
  } finally {
    reportState.running = false;
  }
  if (imported.length) {
    refreshAfterDataChange();
    showToast("Reports imported", `${imported.length} new report${imported.length === 1 ? "" : "s"}: ${imported.slice(0, 2).join(", ")}${imported.length > 2 ? "…" : ""}`);
  } else renderCampaigns(document.querySelector("#client-filter").value);
  renderReportAutomation();
}

const outcomeLabel = { imported: "Imported", "needs review": "Needs review", "couldn't read": "Couldn't read", "already imported": "Already imported" };
function renderReportAutomation() {
  const inbox = readReportInbox(localStorage);
  const chip = document.querySelector("#report-review-chip");
  chip.hidden = !inbox.length;
  chip.textContent = `${inbox.length} report${inbox.length === 1 ? "" : "s"} to review`;
  document.querySelector("#report-folder-reconnect").hidden = !(watchedFolders().length && reportState.needsClick);
  updateReviewBadge();
  if (pageView === "review") renderReviewPage(inbox);
  if (pageView !== "automation") return;
  document.querySelector("#automation-review-link").textContent = inbox.length ? `Open Report review · ${inbox.length} waiting` : "Open Report review";
  stepStatus("rfolder", reportFolder ? "done" : "todo");
  const dcmSeen = Object.keys(readReportLedger(localStorage)).some(key => key.startsWith(DCM_PREFIX));
  stepStatus("dfolder", dcmFolder || dcmSeen ? "done" : "todo");
  stepStatus("dflow", dcmSeen ? "done" : "todo");
  stepStatus("dconnect", dcmFolder ? (reportState.needsClick ? "warn" : "done") : "todo");
  document.querySelector("#dcm-connect-detail").textContent = !folderSupported ? "This browser can't watch a folder. Open the dashboard in Chrome or Edge." : !dcmFolder ? "Not connected yet." : `Watching “${dcmFolder.name}”.${dcmSeen ? " Email reports have come through." : " Waiting for the first report email."}`;
  document.querySelector("#dcm-connect-button").textContent = dcmFolder ? "Change folder…" : "Connect the folder…";
  document.querySelector("#dcm-connect-button").disabled = !folderSupported;
  document.querySelector("#dcm-disconnect").hidden = !dcmFolder;
  stepStatus("rconnect", reportFolder ? (reportState.needsClick ? "warn" : "done") : "todo");
  stepStatus("rreview", !reportFolder ? "todo" : inbox.length ? "warn" : "done");
  document.querySelector("#report-connect-detail").textContent = !folderSupported ? "This browser can't watch a folder. Open the dashboard in Chrome or Edge." : !reportFolder ? "Not connected yet." : reportState.needsClick ? `Connected to “${reportFolder.name}”. Chrome needs one click this visit: press Check now.` : reportState.running ? `Checking “${reportFolder.name}”…` : `Watching “${reportFolder.name}”${reportState.lastChecked ? ` · checked ${reportState.lastChecked.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}, ${reportState.scanned.toLocaleString()} items looked at` : ""}${reportState.truncated ? ". That folder is very large; pick a narrower one so nothing is missed" : ""}.`;
  document.querySelector("#report-connect-button").textContent = reportFolder ? "Change folder…" : "Connect folder…";
  document.querySelector("#report-connect-button").disabled = !folderSupported;
  document.querySelector("#report-check-now").hidden = !reportFolder;
  document.querySelector("#report-disconnect").hidden = !reportFolder;
  document.querySelector("#report-only-folders").checked = reportSettings.onlyReportFolders;
  document.querySelector("#report-lookback").value = reportSettings.lookbackDays;
  document.querySelector("#report-retention").value = reportSettings.retentionDays;
}

document.querySelector("#report-connect-button").addEventListener("click", async () => {
  try {
    const handle = await window.showDirectoryPicker({ id: "northstar-reports", mode: "read" });
    reportFolder = handle;
    await saveFolderHandle(indexedDB, REPORT_FOLDER_KEY, handle);
    await checkReportFolder({ ask: true });
  } catch { /* the picker was closed */ }
  renderReportAutomation();
});
document.querySelector("#report-disconnect").addEventListener("click", async () => {
  reportFolder = null;
  await saveFolderHandle(indexedDB, REPORT_FOLDER_KEY, null).catch(() => {});
  renderReportAutomation();
});
document.querySelector("#dcm-connect-button").addEventListener("click", async () => {
  try {
    const handle = await window.showDirectoryPicker({ id: "northstar-dcm", mode: "read" });
    dcmFolder = handle;
    await saveFolderHandle(indexedDB, DCM_FOLDER_KEY, handle);
    await checkReportFolder({ ask: true });
  } catch { /* the picker was closed */ }
  renderReportAutomation();
});
document.querySelector("#dcm-disconnect").addEventListener("click", async () => {
  dcmFolder = null;
  await saveFolderHandle(indexedDB, DCM_FOLDER_KEY, null).catch(() => {});
  renderReportAutomation();
});
document.querySelector("#report-check-now").addEventListener("click", () => checkReportFolder({ ask: true }));
document.querySelector("#report-folder-reconnect").addEventListener("click", () => checkReportFolder({ ask: true }));
document.querySelector("#report-review-chip").addEventListener("click", () => setPageView("review"));
document.querySelector("#automation-page").addEventListener("change", event => {
  if (!["report-only-folders", "report-lookback", "report-retention"].includes(event.target.id)) return;
  const days = (value, fallback) => Math.max(1, Math.min(3650, Math.round(Number(value)) || fallback));
  reportSettings = { onlyReportFolders: document.querySelector("#report-only-folders").checked, lookbackDays: days(document.querySelector("#report-lookback").value, 30), retentionDays: days(document.querySelector("#report-retention").value, 180) };
  localStorage.setItem(REPORT_SETTINGS_KEY, JSON.stringify(reportSettings));
  renderReportAutomation();
});
document.querySelector("#report-inbox").addEventListener("click", async event => {
  const dismiss = event.target.closest("[data-report-dismiss]");
  if (dismiss) { localStorage.setItem(REPORT_INBOX_KEY, JSON.stringify(readReportInbox(localStorage).filter(item => item.key !== dismiss.dataset.reportDismiss))); renderReportAutomation(); return; }
  const review = event.target.closest("[data-report-review]");
  if (!review) return;
  const [folder, path] = folderForKey(review.dataset.reportReview);
  if (!folder) return;
  try {
    const file = await openReportAt(folder, path);
    reviewingReportKey = review.dataset.reportReview;
    openImportDialog();
    const transfer = new DataTransfer();
    transfer.items.add(new File([file], file.name, { type: file.type, lastModified: file.lastModified }));
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event("change"));
    allowDuplicateOnce = true;
    validateButton.click();
  } catch {
    showToast("Couldn't open it", "The file moved or OneDrive hasn't finished syncing it. Try Check now, or import it with Import report.");
  }
});
if (folderSupported) {
  Promise.all([loadFolderHandle(indexedDB, REPORT_FOLDER_KEY), loadFolderHandle(indexedDB, DCM_FOLDER_KEY)]).then(([handle, dcmHandle]) => {
    reportFolder = handle;
    dcmFolder = dcmHandle;
    renderReportAutomation();
    return checkReportFolder();
  }).catch(() => renderReportAutomation());
  setInterval(() => { if (watchedFolders().length && !reportState.needsClick && document.visibilityState === "visible") checkReportFolder(); }, 10 * 60_000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && watchedFolders().length && !reportState.needsClick) checkReportFolder(); });
} else renderReportAutomation();

document.querySelector("#sources-client").addEventListener("change", event => { sourcesFilter.client = event.target.value; renderDataSources(); });
document.querySelector("#sources-kind").addEventListener("change", event => { sourcesFilter.kind = event.target.value; renderDataSources(); });
document.querySelector("#sources-group").addEventListener("change", event => { sourcesFilter.by = event.target.value; renderDataSources(); });
document.querySelector("#sources-search").addEventListener("input", event => { sourcesFilter.query = event.target.value; renderDataSources(); });
document.querySelector("#sources-import").addEventListener("click", () => document.querySelector("#upload-nav").click());
document.querySelector("#sources-history").addEventListener("click", () => document.querySelector("#view-import-audit").click());
document.querySelector("#data-sources-list").addEventListener("click", event => {
  const button = event.target.closest("[data-remove-source]");
  if (!button) return;
  const doc = lastSourceDocs.find(item => `${item.client}||${item.id}` === button.dataset.removeSource);
  if (doc) removeUploadedDocument(doc.client, doc);
});

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
  saveCampaigns();
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
  saveCampaigns();
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
  document.querySelector("#nav-alert-count").hidden = alerts.length === 0;
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
  let health = evaluateDataHealth(importHistory);
  // Once every flagged import is marked reviewed, the card stops asking for a look.
  if (health.state === "warning" && !pendingImportReviews(importHistory, reviewedImports).length) health = { ...health, state: "healthy", title: "Data is current", detail: "Latest import reviewed" };
  const card = document.querySelector("#data-health-card");
  card.dataset.state = health.state;
  const actionable = ["warning", "error"].includes(health.state);
  if (actionable) { card.setAttribute("role", "link"); card.tabIndex = 0; card.title = "Open Report review"; } else { card.removeAttribute("role"); card.removeAttribute("tabindex"); card.removeAttribute("title"); }
  document.querySelector("#data-health-title").textContent = health.title;
  document.querySelector("#data-health-detail").textContent = health.detail;
  document.querySelector("#data-health-sync").textContent = health.lastSync;
}

refreshClientFilter();
applyDashboardView(dashboardView);
renderDataHealth();
renderCampaigns();
// Attach each line's stored days (moving any still kept inline out of local storage), then bring top-ups up to date.
const deliveryReady = readLineDeliveries(indexedDB).then(stored => {
  campaigns = campaigns.map(record => {
    if (record.thirdPartyDelivery) return record;
    const delivery = stored.get(deliveryKey(record));
    return delivery ? { ...record, thirdPartyDelivery: delivery } : record;
  });
  for (const [key, delivery] of stored) writtenDeliveries.set(key, JSON.stringify(delivery));
}).catch(() => {}).finally(() => {
  deliveryLoaded = true;
  saveCampaigns();
  renderCampaigns();
  updateStorageWarning();
});
// Ask Chrome to keep the reports database even when the disk gets low.
navigator.storage?.persisted?.().then(kept => kept || navigator.storage.persist?.()).catch(() => {});

// --- The sky behind the dashboard: time of day always, local weather once you turn it on ---
let sky = readSkySettings(localStorage);
let skyCondition = sky.weather && sky.checkedAt && Date.now() - sky.checkedAt < 3 * 3600_000 ? sky.weather : "clear";
function paintSky() {
  document.body.dataset.skyTime = skyTime(new Date().getHours());
  document.body.dataset.skyWeather = skyCondition;
  const button = document.querySelector("#sky-weather");
  button.textContent = sky.coords ? "Stop matching weather" : "Match my weather";
  document.querySelector("#settings-sky-detail").textContent = sky.coords ? `Following your local weather: ${SKY_LABEL[skyCondition].toLowerCase()} right now. Only a rounded location is sent to Open-Meteo.` : "The sky follows the time of day. Turn on weather to follow your local weather too; it asks for your location once.";
  button.title = sky.coords ? "Stop matching the sky to your local weather" : "Ask once for your location so the background follows your weather";
}
async function refreshWeather() {
  if (!sky.coords) return;
  try {
    const response = await fetch(weatherUrl(sky.coords));
    if (!response.ok) return;
    const data = await response.json();
    skyCondition = skyWeather(data.current?.weather_code);
    sky = { ...sky, weather: skyCondition, checkedAt: Date.now() };
    localStorage.setItem(SKY_KEY, JSON.stringify(sky));
  } catch {
    // Offline or blocked: the sky keeps its last mood.
  }
  paintSky();
}
document.querySelector("#sky-weather").addEventListener("click", () => {
  if (sky.coords) {
    sky = {};
    skyCondition = "clear";
    localStorage.removeItem(SKY_KEY);
    paintSky();
    return;
  }
  if (!navigator.geolocation) { showToast("Weather sky unavailable", "This browser can’t share a location."); return; }
  navigator.geolocation.getCurrentPosition(position => {
    sky = { coords: { latitude: Math.round(position.coords.latitude * 10) / 10, longitude: Math.round(position.coords.longitude * 10) / 10 } };
    localStorage.setItem(SKY_KEY, JSON.stringify(sky));
    refreshWeather();
  }, () => showToast("Location not shared", "The sky will keep following the time of day."), { maximumAge: 3600_000, timeout: 15_000 });
});
paintSky();
refreshWeather();
setInterval(() => { paintSky(); if (sky.coords && Date.now() - (sky.checkedAt || 0) > 30 * 60_000) refreshWeather(); }, 5 * 60_000);

// --- Getting started: a full-page welcome on an empty workspace, then a short checklist until the first client is open ---
function renderWelcome() {
  const panel = document.querySelector("#welcome");
  const progress = setupProgress({ campaigns, totals: campaignTotals, state: onboarding, isPlaceholder });
  const onOverview = !clientScope && !sourcesView && !alertsView && !pageView;
  const mode = progress.mode;
  document.body.classList.toggle("first-run", mode === "welcome" && onOverview);
  if (mode === "welcome" && onOverview) document.querySelector("#page-subtitle").textContent = "Let’s get your first client in.";
  panel.hidden = mode === "hidden" || !onOverview;
  panel.classList.toggle("compact", mode === "checklist");
  document.querySelector("#welcome-reopen").hidden = !onboarding.dismissed;
  if (panel.hidden) return;
  const current = progress.steps.find(step => !step.done)?.id || null;
  document.querySelector("#welcome-title").textContent = mode === "welcome" ? "Welcome to Zeta Campaign Pacing" : progress.coreDone ? "You’re set up" : `Getting started · ${progress.doneCount} of 3`;
  document.querySelector("#welcome-lede").hidden = mode !== "welcome";
  document.querySelector("#welcome-name-field").hidden = mode !== "welcome";
  document.querySelector("#welcome-skip").textContent = mode === "welcome" ? "Skip setup" : progress.coreDone ? "Done" : "Hide";
  const nameInput = document.querySelector("#welcome-name");
  if (document.activeElement !== nameInput) { try { nameInput.value = localStorage.getItem("northstar-profile-name") || ""; } catch { nameInput.value = ""; } }
  const client = progress.reportClient || progress.ioClient;
  const copy = {
    io: { title: "Upload a client’s IO", body: "Pick one live client and upload the IO PDF. The dashboard reads the budget, flights, and line items.", action: "Upload IO", done: progress.ioClient ? `IO added for ${progress.ioClient}` : "IO added" },
    report: { title: client && progress.ioClient ? `Import ${client}’s latest report` : "Import the latest report", body: "Use the xlsx or csv linked from the Jira ticket. Report lines match to the IO on their own, and you confirm anything unclear.", action: "Import report", done: progress.reportClient ? `Report in for ${progress.reportClient}` : "Report imported" },
    open: { title: progress.reportClient ? `Open ${progress.reportClient}` : "Open the client", body: "Check pacing and KPIs line by line. Each line’s Details show where every number came from.", action: progress.reportClient ? `Open ${progress.reportClient}` : "Open client", done: "Opened" }
  };
  document.querySelector("#welcome-steps").innerHTML = progress.steps.map((step, index) => {
    const text = copy[step.id];
    const state = step.done ? "done" : step.id === current ? "current" : "upcoming";
    const blocked = step.id === "open" && !progress.reportClient;
    return `<li class="welcome-step ${state}"${state === "current" ? ' aria-current="step"' : ""}><span class="welcome-marker">${step.done ? CHECK_ICON : index + 1}</span><div><h3>${escapeHtml(text.title)}</h3><p>${escapeHtml(step.done ? text.done : text.body)}</p></div>${step.done ? "" : `<button class="${state === "current" ? "primary-button" : "secondary-button"}" type="button" data-welcome-action="${step.id}"${blocked ? " disabled" : ""}>${escapeHtml(text.action)}</button>`}</li>`;
  }).join("");
  // Once a client is in, point at the two automations that save time every morning.
  const automationReady = typeof window.showDirectoryPicker === "function";
  document.querySelector("#welcome-next").innerHTML = mode === "welcome" ? "" : `<p class="welcome-next-label">Next, save time every morning</p><div class="welcome-next-grid"><a href="?view=automation" data-page-view="automation"><b>Morning brief</b><span>A scheduled ChatGPT scan of your email, Jira, and Slack drops to-dos here by client.</span></a><a href="?view=automation" data-page-view="automation"><b>Report folder</b><span>Watch a SharePoint folder in OneDrive and new reports come in on their own.</span></a></div><p class="welcome-note">Both run in this Chrome profile${automationReady ? "" : ", so open the dashboard in Chrome or Edge to set them up"}.</p>`;
  document.querySelector("#welcome-note").hidden = mode !== "welcome";
  document.querySelector("#welcome-browser").hidden = mode !== "welcome";
  // Chrome and Edge both expose the folder picker the automations use; Safari and Firefox do not.
  document.querySelector("#welcome-browser-warning").hidden = automationReady;
}
document.querySelector("#welcome").addEventListener("click", event => {
  const action = event.target.closest("[data-welcome-action]")?.dataset.welcomeAction;
  if (action === "io") document.querySelector("#client-io-button").click();
  else if (action === "report") document.querySelector("#upload-button").click();
  else if (action === "open") {
    const progress = setupProgress({ campaigns, totals: campaignTotals, state: onboarding, isPlaceholder });
    if (progress.reportClient) setClientScope(progress.reportClient);
  }
  const page = event.target.closest("[data-page-view]");
  if (page) { event.preventDefault(); setPageView(page.dataset.pageView); }
});
document.querySelector("#welcome-skip").addEventListener("click", () => {
  onboarding = writeOnboarding(localStorage, { ...onboarding, dismissed: true });
  renderWelcome();
});
document.querySelector("#welcome-reopen").addEventListener("click", () => {
  onboarding = writeOnboarding(localStorage, { ...onboarding, dismissed: false });
  setPageView(null);
});
document.querySelector("#welcome-name").addEventListener("change", event => {
  const name = event.target.value.trim();
  try { if (name) localStorage.setItem("northstar-profile-name", name); else localStorage.removeItem("northstar-profile-name"); } catch { /* keeps the default greeting */ }
  renderProfile();
});
renderWelcome();

// --- Report review: what the folder automation held back, and imports with warnings, in one place ---
function pendingImports() { return pendingImportReviews(importHistory, reviewedImports); }
function updateReviewBadge() {
  const count = readReportInbox(localStorage).length + pendingImports().length;
  const badge = document.querySelector("#nav-review-count");
  badge.textContent = count;
  badge.hidden = count === 0;
}
function renderReviewPage(inbox = readReportInbox(localStorage)) {
  document.querySelector("#review-inbox-context").textContent = inbox.length ? `${inbox.length} report${inbox.length === 1 ? "" : "s"} from your folder need${inbox.length === 1 ? "s" : ""} you to pick the campaign` : "Reports from your folder that couldn’t be matched on their own";
  document.querySelector("#report-inbox").innerHTML = inbox.length ? inbox.map(item => `<li><span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.folder || "")}${item.folder ? " · " : ""}${escapeHtml(item.reason)}</small></span><span class="report-inbox-actions"><button class="secondary-button" type="button" data-report-review="${escapeHtml(item.key)}">Review</button><button class="text-button" type="button" data-report-dismiss="${escapeHtml(item.key)}">Dismiss</button></span></li>`).join("") : `<li class="report-inbox-empty">${reportFolder ? "Nothing waiting. Reports that need a decision show up here." : "Connect a report folder first."}</li>`;
  const activity = readReportActivity().slice(0, 8);
  document.querySelector("#report-activity").innerHTML = activity.length ? activity.map(item => `<li><span class="report-outcome ${escapeHtml(item.outcome.replace(/[^a-z]+/g, "-"))}">${escapeHtml(outcomeLabel[item.outcome] || item.outcome)}</span><span>${escapeHtml(item.name)}${item.reason ? `<small>${escapeHtml(item.reason)}</small>` : ""}</span><time>${escapeHtml(new Date(item.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}</time></li>`).join("") : '<li class="report-inbox-empty">No reports checked yet.</li>';
  const pending = pendingImports();
  const clients = [...new Set(campaigns.map(record => record.client))];
  const statusLabel = { "Imported with warnings": "Imported with warnings", "Partially imported": "Partly imported", Rejected: "Didn’t import" };
  document.querySelector("#review-mark-all").hidden = pending.length < 2;
  document.querySelector("#review-imports-context").textContent = pending.length ? `${pending.length} import${pending.length === 1 ? "" : "s"} to check. Mark each one reviewed once it looks right.` : "Imports that came in with warnings, came in partly, or didn’t come in";
  document.querySelector("#review-imports").innerHTML = pending.length ? pending.map(record => {
    const touched = importClients(record, clients);
    const notes = [...(record.warnings || []), ...(record.errors || [])];
    return `<li class="review-import ${record.status === "Rejected" ? "rejected" : ""}"><div class="review-import-head"><span class="report-outcome ${record.status === "Rejected" ? "failed" : "review"}">${escapeHtml(statusLabel[record.status] || record.status)}</span><b>${escapeHtml(record.fileName)}</b><time>${escapeHtml(new Date(record.importedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}</time></div>${notes.length ? `<ul class="review-notes">${notes.map(note => `<li>${escapeHtml(note)}</li>`).join("")}</ul>` : ""}<div class="review-import-actions">${touched.map(client => `<a class="text-button" href="?client=${encodeURIComponent(client)}" data-review-client="${escapeHtml(client)}">Open ${escapeHtml(client)}</a>`).join("")}<button class="secondary-button" type="button" data-review-done="${escapeHtml(record.id)}">Mark reviewed</button></div></li>`;
  }).join("") : '<li class="report-inbox-empty">Nothing to check. Imports with warnings show up here.</li>';
}
document.querySelector("#review-page").addEventListener("click", event => {
  const done = event.target.closest("[data-review-done]");
  if (done) { reviewedImports = markImportsReviewed(localStorage, reviewedImports, [done.dataset.reviewDone]); renderReportAutomation(); renderDataHealth(); return; }
  if (event.target.closest("#review-mark-all")) { reviewedImports = markImportsReviewed(localStorage, reviewedImports, pendingImports().map(record => record.id)); renderReportAutomation(); renderDataHealth(); return; }
  const client = event.target.closest("[data-review-client]");
  if (client) { event.preventDefault(); setClientScope(client.dataset.reviewClient); }
});
document.querySelector("#automation-review-link").addEventListener("click", event => { event.preventDefault(); setPageView("review"); });
// The sidebar health card opens Report review when something needs a look.
document.querySelector("#data-health-card").addEventListener("click", () => { if (["warning", "error"].includes(document.querySelector("#data-health-card").dataset.state)) setPageView("review"); });
document.querySelector("#data-health-card").addEventListener("keydown", event => { if ((event.key === "Enter" || event.key === " ") && ["warning", "error"].includes(event.currentTarget.dataset.state)) { event.preventDefault(); setPageView("review"); } });
updateReviewBadge();

// --- DCM (CM360) delivery reports: matched to a campaign, split across its lines by placement, kept beside the report ---
function deliveryPlan() {
  const pending = pendingValidatedImport;
  const targets = Object.fromEntries(Object.entries(pending.targets).filter(([, value]) => value !== SKIP_DELIVERY));
  const plan = planDelivery(campaigns.filter(record => !isCampaignArchived(record)), pending.parsed, thirdPartyLinks, targets);
  return plan.map(item => pending.targets[item.entry.key] === SKIP_DELIVERY ? { ...item, target: null, skipped: true } : item);
}
function showDeliveryImport() {
  const { parsed, report } = pendingValidatedImport;
  const first = parsed.records[0]?.date;
  const last = parsed.records.at(-1)?.date;
  renderDeliveryAssignments();
  document.querySelector("#mapping-review").hidden = true;
  const unit = parsed.source === "DSP" ? "line item" : "placement";
  const units = new Set(parsed.placements.map(row => row.placement)).size;
  showValidationResult([`${deliveryLabel()} delivery report: ${parsed.campaigns.length} campaign${parsed.campaigns.length === 1 ? "" : "s"}, ${units ? `${units} ${unit}${units === 1 ? "" : "s"}, ` : ""}${first} to ${last}, from header row ${report.headerRow}. It fills in spend and delivery for the days after each line's latest report, and is compared to the report where both cover the same days.`], "success");
}
function renderDeliveryAssignments() {
  const plan = deliveryPlan();
  const section = document.querySelector("#import-assignments");
  section.hidden = false;
  document.querySelector("#import-assign-all").closest("label").hidden = true;
  const groups = groupCampaigns(campaigns.filter(record => !isCampaignArchived(record)));
  document.querySelector("#import-assignment-list").innerHTML = plan.map(item => {
    const chosen = pendingValidatedImport.targets[item.entry.key];
    const undecided = !item.target && !item.skipped;
    const options = `${undecided ? '<option value="" selected disabled>Choose a campaign (required)</option>' : ""}<option value="${SKIP_DELIVERY}"${item.skipped ? " selected" : ""}>Skip this campaign</option>${groups.map(group => `<option value="${escapeHtml(group.key)}"${item.target === group.key ? " selected" : ""}>${escapeHtml(group.client)} · ${escapeHtml(group.name)}${!chosen && item.target === group.key ? " (matched)" : ""}</option>`).join("")}`;
    const perLine = item.lines.map((name, index) => [name, [...item.assigned.values()].filter(value => value === index).length]);
    const lines = item.target ? `<ul class="delivery-lines">${perLine.map(([name, count]) => `<li><span>${escapeHtml(name.includes(" — ") ? name.split(" — ").slice(1).join(" — ") : name)}</span><span>${count ? `${count} ${pendingValidatedImport.parsed.source === "DSP" ? "line item" : "placement"}${count === 1 ? "" : "s"}` : '<em class="muted">nothing matched</em>'}</span></li>`).join("")}</ul>${item.unassigned.length ? `<p class="delivery-note">${item.unassigned.length} ${pendingValidatedImport.parsed.source === "DSP" ? "line item" : "placement"}${item.unassigned.length === 1 ? "" : "s"} didn’t match a line and will be left out: ${escapeHtml(item.unassigned.slice(0, 4).join(", "))}${item.unassigned.length > 4 ? "…" : ""}</p>` : ""}` : "";
    return `<div class="import-assignment-block${undecided ? " needs-choice" : ""}"><div class="import-assignment-row"><span><strong>${escapeHtml(item.entry.sourceCampaignName || item.entry.sourceCampaignId)}</strong><small>${deliveryLabel()} campaign${item.entry.sourceCampaignId ? ` ${escapeHtml(item.entry.sourceCampaignId)}` : ""} · ${item.entry.days} day${item.entry.days === 1 ? "" : "s"}, ${escapeHtml(item.entry.firstDate)} to ${escapeHtml(item.entry.lastDate)}</small>${undecided ? '<small class="import-required-note">Pick the dashboard campaign this ${deliveryLabel()} campaign belongs to. Later reports follow your choice.</small>' : ""}</span><select data-delivery-target="${escapeHtml(item.entry.key)}" aria-label="Dashboard campaign for ${escapeHtml(item.entry.sourceCampaignName)}"${undecided ? ' aria-invalid="true" required' : ""}>${options}</select></div>${lines}</div>`;
  }).join("");
  const undecided = plan.filter(item => !item.target && !item.skipped).length;
  const assigned = plan.some(item => item.target && item.assigned.size);
  const errorBox = document.querySelector("#import-setup-error");
  const message = undecided ? `Pick the campaign for ${undecided === 1 ? `the highlighted ${deliveryLabel()} campaign` : `the ${undecided} highlighted ${deliveryLabel()} campaigns`} before importing, or skip it.` : !assigned ? "Nothing in it matches a line in the chosen campaign." : "";
  errorBox.hidden = !message;
  errorBox.textContent = message;
  document.querySelector("#import-preview").hidden = true;
  confirmImportButton.disabled = Boolean(message);
}
document.querySelector("#import-assignment-list").addEventListener("change", event => {
  const select = event.target.closest("[data-delivery-target]");
  if (!select || pendingValidatedImport?.kind !== "delivery") return;
  pendingValidatedImport.targets[select.dataset.deliveryTarget] = select.value;
  renderDeliveryAssignments();
});
function commitDeliveryImport({ automatic = false } = {}) {
  const { fileName, fingerprint, parsed } = pendingValidatedImport;
  const plan = deliveryPlan();
  const result = applyDelivery(campaigns, parsed, plan, { fileName });
  // The file's own rows are kept for billing's raw data tab.
  saveRawRows(indexedDB, parsed.source, rawRowsForPlan(parsed, plan)).catch(() => {});
  writeImportRollback(localStorage, createImportRollback({ campaigns, importHistory, fileName, fingerprint, rowCount: result.lineCount, campaignKeys: [], campaignTotals }));
  campaigns = result.campaigns;
  saveCampaigns();
  thirdPartyLinks = rememberThirdPartyLinks(localStorage, thirdPartyLinks, plan, parsed.source);
  const touched = campaigns.filter(record => plan.some(item => item.target && groupKey(record) === item.target) && record.thirdPartyFiles?.[0] === fileName);
  const warnings = [
    ...plan.filter(item => item.target && item.unassigned.length).map(item => `${item.unassigned.length} ${deliveryLabel()} ${pendingValidatedImport.parsed.source === "DSP" ? "line item" : "placement"}${item.unassigned.length === 1 ? "" : "s"} in “${item.entry.sourceCampaignName}” didn’t match a line: ${item.unassigned.slice(0, 3).join(", ")}${item.unassigned.length > 3 ? "…" : ""}`),
    ...plan.filter(item => item.skipped).map(item => `${deliveryLabel()} campaign “${item.entry.sourceCampaignName}” was skipped.`),
    ...(automatic ? ["Imported automatically from the watched report folder."] : [])
  ];
  const flagged = warnings.filter(warning => !warning.startsWith("Imported automatically"));
  // Keys carry ::cm360 so a DCM import never counts as a newer copy of the line's own report.
  recordImport(fileName, fingerprint, flagged.length ? "Imported with warnings" : "Imported", result.lineCount, [], touched.map(record => `${campaignImportKey(record)}::cm360`), warnings);
  return result.lineCount;
}

function renderDcmComparison(campaign) {
  const section = document.querySelector("#dcm-section");
  const sources = DELIVERY_SOURCES.filter(source => Object.keys(campaign.thirdPartyDelivery?.[source] || {}).length);
  section.hidden = !sources.length;
  if (section.hidden) return;
  const topUp = campaign.dcmTopUp;
  const topLabel = SHORT_SOURCE[topUp?.source] || "DCM";
  document.querySelector("#dcm-topup").hidden = !topUp;
  if (topUp) document.querySelector("#dcm-topup").innerHTML = `Spend and pacing include ${topLabel} for <b>${escapeHtml(shortDate(topUp.from))} to ${escapeHtml(shortDate(topUp.to))}</b> on top of the report through ${escapeHtml(shortDate(topUp.reportAsOf))}: +${escapeHtml(formatExactMoney(topUp.added.spend))} spend and +${escapeHtml(formatCount(topUp.added.impressions))} impressions.${topUp.factor !== 1 ? ` ${topLabel} cost is scaled ×${topUp.factor.toFixed(2)} to match this line’s report over the days both cover.` : ""} The next report replaces these days.`;
  const gap = (value, flag = true) => value === null ? "—" : `<span class="${flag && Math.abs(value) > alertRules.discrepancy ? "warning-text" : ""}">${value > 0 ? "+" : ""}${value.toFixed(1)}%</span>`;
  const money = value => Number.isFinite(value) ? formatExactMoney(value) : "—";
  const countText = value => Number.isFinite(value) ? formatCount(value) : "—";
  document.querySelector("#dcm-window").hidden = true;
  document.querySelector("#dcm-table").innerHTML = sources.map(source => {
    const label = SHORT_SOURCE[source];
    const dates = Object.keys(campaign.thirdPartyDelivery[source]).sort();
    const comparison = deliveryComparison(campaign, source);
    const heading = `<h5 class="dcm-source">${escapeHtml(source === "CM360" ? "DCM (CM360)" : "DSP")} vs this report</h5>`;
    if (!comparison) return `${heading}<p class="dcm-window">${label} data from ${shortDate(dates[0])} to ${shortDate(dates.at(-1))}. The comparison shows once this line’s report covers the same days.</p>`;
    // The DSP is the 1P spend itself, so only DCM gaps are flagged.
    const flag = source === "CM360";
    const rows = [
      ["Impressions", countText(comparison.report.impressions), countText(comparison.adServer.impressions), gap(comparison.gaps.impressions, flag)],
      ["Clicks", countText(comparison.report.clicks), countText(comparison.adServer.clicks), gap(comparison.gaps.clicks, flag)],
      // DCM cost is worked out from its own rates, so it is shown for reference and never flagged.
      ["Cost", money(comparison.report.spend), money(comparison.adServer.spend), gap(comparison.gaps.spend, false)],
      ["Conversions", countText(comparison.report.conversions), countText(comparison.adServer.conversions), ""],
      ["Revenue", money(comparison.report.revenue), money(comparison.adServer.revenue), ""]
    ];
    const kpis = source === "CM360" ? `<p class="dcm-kpis"><span>DCM CPA <b>${comparison.cpa === null ? "—" : `$${Math.round(comparison.cpa).toLocaleString("en-US")}`}</b></span><span>DCM ROAS <b>${comparison.roas === null ? "—" : `${comparison.roas.toFixed(comparison.roas < 1 ? 2 : 1)}x`}</b></span><small>DCM conversions and revenue against this report’s spend for the same days.</small></p>` : "";
    return `${heading}<p class="dcm-window">${shortDate(comparison.from)} to ${shortDate(comparison.to)} · ${comparison.days} day${comparison.days === 1 ? "" : "s"} both cover</p><div class="dcm-row dcm-head"><span></span><span>This report</span><span>${label}</span><span>Gap</span></div>${rows.map(row => `<div class="dcm-row">${row.map((cell, index) => `<span>${index ? cell : escapeHtml(cell)}</span>`).join("")}</div>`).join("")}${kpis}`;
  }).join("");
}
document.querySelector("#dcm-remove").addEventListener("click", () => {
  const campaign = campaigns[activeCampaignIndex];
  if (!campaign) return;
  const { thirdPartyDelivery, thirdPartyAsOf, thirdPartyFiles, ...rest } = campaign;
  deleteRawRows(indexedDB, campaign.name).catch(() => {});
  campaigns[activeCampaignIndex] = rest;
  saveCampaigns();
  renderDcmComparison(campaigns[activeCampaignIndex]);
  renderCampaigns();
});

// --- Billing: each client's rows set up once (or read from last month's file), filled each month from DCM and DSP ---
function clientLines(client) { return campaigns.filter(record => record.client === client && !isCampaignArchived(record) && !isPlaceholder(record)); }
function lineLabelText(record) { return record.name; }
function saveBilling() { billing = writeBilling(localStorage, billing); }
function billingConfig(client) { return (billing[client] ||= { agency: "", advertiser: client, currency: "USD", periodMode: "month", periods: [], rows: [], history: {} }); }
function newRowId() { return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; }
/** The source a row most likely bills from: the DSP when its lines have DSP days, else DCM, else the client's report. */
const defaultSource = lines => lines.some(line => Object.keys(line.thirdPartyDelivery?.DSP || {}).length) ? "DSP" : lines.some(line => Object.keys(line.thirdPartyDelivery?.CM360 || {}).length) ? "CM360" : "report";
const nameWords = text => new Set(String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2 && !["zeta", "the", "and", "campaign", "2025", "2026", "2027"].includes(word)));
/** Dashboard lines a billing row names: those sharing the most words with its line and campaign names, else all of them. */
function guessLines(row, lines) {
  const words = new Set([...nameWords(row.lineName), ...nameWords(row.campaignName)]);
  const scored = lines.map(line => [line, [...nameWords(line.name)].filter(word => words.has(word)).length]);
  const best = Math.max(0, ...scored.map(([, score]) => score));
  return (best ? scored.filter(([, score]) => score === best).map(([line]) => line) : lines).map(line => line.name);
}

function renderClientBilling() {
  const panel = document.querySelector("#client-billing");
  panel.hidden = !clientScope;
  if (!clientScope) return;
  const config = billingConfig(clientScope);
  const lines = clientLines(clientScope);
  document.querySelector("#billing-client-fields").innerHTML = `
    <label>Agency<input data-billing-client="agency" value="${escapeHtml(config.agency || "")}" placeholder="Agency name from the IO" /></label>
    <label>Advertiser<input data-billing-client="advertiser" value="${escapeHtml(config.advertiser || "")}" /></label>
    <label>Currency<input data-billing-client="currency" value="${escapeHtml(config.currency || "USD")}" /></label>
    <label>Billing periods<select data-billing-client="periodMode"><option value="month"${config.periodMode !== "custom" ? " selected" : ""}>Calendar months</option><option value="custom"${config.periodMode === "custom" ? " selected" : ""}>Custom periods</option></select></label>
    ${config.periodMode === "custom" ? `<label class="billing-periods">Periods, one per line<textarea data-billing-client="periods" rows="3" placeholder="08/30/2026 - 09/26/2026">${escapeHtml((config.periods || []).map(period => `${period.from.slice(5, 7)}/${period.from.slice(8)}/${period.from.slice(0, 4)} - ${period.to.slice(5, 7)}/${period.to.slice(8)}/${period.to.slice(0, 4)}`).join("\n"))}</textarea></label>` : ""}`;
  const option = (value, label, selected) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
  document.querySelector("#billing-rows").innerHTML = config.rows.length ? config.rows.map((row, index) => `<div class="billing-row" data-billing-row="${escapeHtml(row.id)}">
      <div class="billing-row-head"><b>Row ${index + 1}</b><button class="text-button danger-text" type="button" data-billing-remove="${escapeHtml(row.id)}">Remove</button></div>
      <div class="billing-row-fields">
        <label class="wide">Campaign name<input data-billing-field="campaignName" value="${escapeHtml(row.campaignName || "")}" /></label>
        <label class="wide">Line item name<input data-billing-field="lineName" value="${escapeHtml(row.lineName || "")}" /></label>
        <label>Salesforce ID<input data-billing-field="sfid" value="${escapeHtml(row.sfid || "")}" /></label>
        <label>PO #<input data-billing-field="po" value="${escapeHtml(row.po || "")}" /></label>
        <label>Numbers from<select data-billing-field="source">${Object.entries(BILLING_SOURCES).map(([value, label]) => option(value, label, row.source)).join("")}</select></label>
        <label>Billed as<select data-billing-field="rateType">${Object.entries(RATE_TYPES).map(([value, label]) => option(value, label, row.rateType)).join("")}</select></label>
        <label>${row.rateType === "flat" ? "Fee" : row.rateType === "spend" ? "IO rate (shown only)" : "Rate"}<input data-billing-field="rate" inputmode="decimal" value="${escapeHtml(String(row.rate ?? ""))}" /></label>
        <label>Discount %<input data-billing-field="discount" inputmode="decimal" value="${escapeHtml(String(row.discount || ""))}" placeholder="0" /></label>
        <label class="wide">Note<input data-billing-field="note" value="${escapeHtml(row.note || "")}" /></label>
      </div>
      <fieldset class="billing-lines"><legend>Dashboard lines in this row</legend>${lines.map(line => `<label><input type="checkbox" data-billing-line="${escapeHtml(line.name)}"${(row.lines || []).includes(line.name) ? " checked" : ""} /> ${escapeHtml(lineLabelText(line))}</label>`).join("") || "<small>No lines on the dashboard yet.</small>"}</fieldset>
    </div>`).join("") : '<p class="billing-empty">No billing rows yet. Fill them from last month’s billing file, or add a row.</p>';
  renderBillingPreview();
}

function billingResult(client, month) {
  const config = billingConfig(client);
  return attachLineDays(computeClientBilling(config, clientLines(client), month), clientLines(client));
}
function moneyText(value) { return formatExactMoney(value); }
function dayList(days) { return days.length > 4 ? `${shortDate(days[0])} to ${shortDate(days.at(-1))} (${days.length} days)` : days.map(shortDate).join(", "); }
function billingStatusText(result) {
  if (!result.rows.length) return "Not set up";
  if (result.unavailable.length) return `Needs data: ${result.unavailable.join(", ")} has no numbers for these dates`;
  if (result.missingDays.length) return `Missing ${dayList(result.missingDays)}`;
  return "Ready";
}
function renderBillingPreview() {
  if (!clientScope) return;
  const month = previousMonth();
  const result = billingResult(clientScope, month);
  const config = billingConfig(clientScope);
  document.querySelector("#billing-preview").innerHTML = result.rows.length ? `<div class="billing-preview-head"><b>${escapeHtml(monthLabel(month))}</b><span class="billing-status ${result.ready ? "ready" : "warn"}">${escapeHtml(billingStatusText(result))}</span><strong>${moneyText(result.total)}</strong><button class="secondary-button" type="button" data-billing-download="${escapeHtml(clientScope)}" data-billing-month="${month}">Download</button></div><table class="billing-table"><thead><tr><th>Line item</th><th>Period</th><th>Quantity</th><th>Rate</th><th>Billable</th></tr></thead><tbody>${result.rows.map(item => `<tr><td>${escapeHtml(item.row.lineName || item.row.campaignName || "—")}<small>${escapeHtml(BILLING_SOURCES[item.row.source])} · ${escapeHtml(RATE_TYPES[item.row.rateType])}</small></td><td>${escapeHtml(item.period.label || `${shortDate(item.period.from)} to ${shortDate(item.period.to)}`)}</td><td>${formatCount(item.quantity)}</td><td>${escapeHtml(item.row.rateType === "spend" ? "spend" : String(item.rate))}</td><td>${moneyText(item.billable)}</td></tr>`).join("")}</tbody></table>${config.history?.[month] ? `<p class="billing-note">Downloaded ${escapeHtml(new Date(config.history[month].downloadedAt).toLocaleDateString([], { month: "short", day: "numeric" }))}.</p>` : ""}` : "";
}

document.querySelector("#client-billing").addEventListener("change", event => {
  if (!clientScope) return;
  const config = billingConfig(clientScope);
  const clientField = event.target.closest("[data-billing-client]");
  if (clientField) {
    const key = clientField.dataset.billingClient;
    if (key === "periods") {
      config.periods = clientField.value.split(/\n+/).map(text => text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/)).filter(Boolean).map(match => ({ from: `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`, to: `${match[6]}-${match[4].padStart(2, "0")}-${match[5].padStart(2, "0")}` }));
    } else config[key] = clientField.value;
    saveBilling();
    if (key === "periodMode") renderClientBilling(); else renderBillingPreview();
    return;
  }
  const rowElement = event.target.closest("[data-billing-row]");
  if (!rowElement) return;
  const row = config.rows.find(item => item.id === rowElement.dataset.billingRow);
  if (!row) return;
  const field = event.target.closest("[data-billing-field]");
  const lineBox = event.target.closest("[data-billing-line]");
  if (field) row[field.dataset.billingField] = ["rate", "discount"].includes(field.dataset.billingField) ? field.value.trim() : field.value;
  if (lineBox) row.lines = lineBox.checked ? [...new Set([...(row.lines || []), lineBox.dataset.billingLine])] : (row.lines || []).filter(name => name !== lineBox.dataset.billingLine);
  saveBilling();
  if (field?.dataset.billingField === "rateType") renderClientBilling(); else renderBillingPreview();
});
document.querySelector("#client-billing").addEventListener("click", event => {
  const remove = event.target.closest("[data-billing-remove]");
  if (remove && clientScope) {
    const config = billingConfig(clientScope);
    config.rows = config.rows.filter(row => row.id !== remove.dataset.billingRemove);
    saveBilling();
    renderClientBilling();
  }
});
document.querySelector("#billing-add-row").addEventListener("click", () => {
  if (!clientScope) return;
  const lines = clientLines(clientScope);
  billingConfig(clientScope).rows.push({ id: newRowId(), campaignName: "", lineName: "", sfid: "", po: "", source: defaultSource(lines), rateType: "cpm", rate: "", discount: "", note: "", lines: lines.map(line => line.name) });
  saveBilling();
  renderClientBilling();
});
document.querySelector("#billing-template-input").addEventListener("change", async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file || !clientScope) return;
  try {
    const names = await readSheetNames(file);
    const sheet = names.find(name => /final billing/i.test(name)) || names[0];
    const parsed = parseBillingSheet(await readXlsxFile(file, { sheet }));
    if (!parsed?.rows.length) { showToast("No billing rows found", "Look for a Final Billing tab with a Customer / Agency header row."); return; }
    const config = billingConfig(clientScope);
    const lines = clientLines(clientScope);
    config.agency = parsed.agency || config.agency;
    config.advertiser = parsed.advertiser || config.advertiser;
    config.currency = parsed.currency || config.currency;
    if (parsed.periods.length) { config.periodMode = "custom"; config.periods = parsed.periods; }
    config.rows = parsed.rows.map(row => {
      const matched = guessLines(row, lines);
      return { id: newRowId(), ...row, source: defaultSource(lines.filter(line => matched.includes(line.name))), lines: matched };
    });
    saveBilling();
    renderClientBilling();
    showToast("Billing set up", `${parsed.rows.length} row${parsed.rows.length === 1 ? "" : "s"} read from ${file.name}. Check each row’s lines and source.`);
  } catch (error) {
    showToast("Couldn't read that file", error.message);
  }
});

async function downloadBilling(client, month) {
  const config = billingConfig(client);
  const result = billingResult(client, month);
  if (!result.rows.length) return;
  for (const item of result.rows) {
    if (item.row.source === "report") continue;
    item.rawRows = await readRawRows(indexedDB, item.row.source, item.row.lines || [], item.period.from, item.period.to).catch(() => []);
  }
  const blob = await writeExcelFile(billingSheets(config, result, client)).toBlob();
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: billingFileName(config, client, month) });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  config.history = { ...(config.history || {}), [month]: { from: result.window.from, to: result.window.to, downloadedAt: new Date().toISOString(), total: result.total } };
  saveBilling();
  renderClientBilling();
  if (pageView === "billing") renderBillingPage();
  updateBillingReminder();
}
document.addEventListener("click", event => {
  const button = event.target.closest("[data-billing-download]");
  if (button) downloadBilling(button.dataset.billingDownload, button.dataset.billingMonth);
});

function billedClients() { return [...new Set(campaigns.filter(record => !isCampaignArchived(record)).map(record => record.client))].sort((a, b) => a.localeCompare(b)); }
function renderBillingPage() {
  const select = document.querySelector("#billing-month");
  const months = Array.from({ length: 12 }, (_, index) => previousMonth(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - index + 1, 1))));
  const chosen = select.value || months[1] || months[0];
  select.innerHTML = months.map(month => `<option value="${month}"${month === chosen ? " selected" : ""}>${escapeHtml(monthLabel(month))}</option>`).join("");
  const month = select.value;
  const items = billedClients().map(client => ({ client, result: billingResult(client, month), config: billing[client] }));
  const ready = items.filter(item => item.result.ready);
  document.querySelector("#billing-page-context").textContent = `${ready.length} of ${items.length} client${items.length === 1 ? "" : "s"} ready for ${monthLabel(month)} · ${moneyText(ready.reduce((sum, item) => sum + item.result.total, 0))} ready to bill`;
  document.querySelector("#billing-list").innerHTML = items.map(({ client, result, config }) => {
    const downloaded = config?.history?.[month];
    return `<li><span class="billing-client"><b>${escapeHtml(client)}</b><small class="billing-status ${!result.rows.length ? "" : result.ready ? "ready" : "warn"}">${escapeHtml(billingStatusText(result))}${downloaded ? ` · downloaded ${escapeHtml(new Date(downloaded.downloadedAt).toLocaleDateString([], { month: "short", day: "numeric" }))}` : ""}</small></span><strong>${result.rows.length ? moneyText(result.total) : ""}</strong><span class="billing-actions">${result.rows.length ? `<button class="secondary-button" type="button" data-billing-download="${escapeHtml(client)}" data-billing-month="${month}">Download</button>` : ""}<a class="text-button" href="?client=${encodeURIComponent(client)}" data-billing-setup="${escapeHtml(client)}">${result.rows.length ? "Edit setup" : "Set up"}</a></span></li>`;
  }).join("") || '<li class="billing-empty">No clients yet.</li>';
}
document.querySelector("#billing-month").addEventListener("change", renderBillingPage);
document.querySelector("#billing-list").addEventListener("click", event => {
  const setup = event.target.closest("[data-billing-setup]");
  if (!setup) return;
  event.preventDefault();
  setClientScope(setup.dataset.billingSetup);
  setTimeout(() => document.querySelector("#client-billing").scrollIntoView({ block: "start" }), 50);
});

/** From the 1st, the sidebar counts set-up clients whose last month hasn't been downloaded. */
function updateBillingReminder() {
  const month = previousMonth();
  const due = Object.entries(billing).filter(([client, config]) => config.rows?.length && !config.history?.[month] && campaigns.some(record => record.client === client)).length;
  const badge = document.querySelector("#nav-billing-count");
  badge.textContent = due;
  badge.hidden = due === 0;
  badge.title = due ? `${monthLabel(month)} billing to download for ${due} client${due === 1 ? "" : "s"}` : "";
}
updateBillingReminder();

// --- Settings: every setting and workspace tool in one place; most open the screen where that setting already lives ---
function renderSettingsPage() {
  let name = "";
  try { name = localStorage.getItem("northstar-profile-name") || ""; } catch { name = ""; }
  const nameInput = document.querySelector("#settings-name");
  if (document.activeElement !== nameInput) nameInput.value = name;
  document.querySelector("#settings-alert-summary").textContent = `Underpacing below ${alertRules.underPacing}%, overpacing above ${alertRules.overPacing}%, KPI tolerance ${alertRules.kpiTolerance}%, DCM gap above ${alertRules.discrepancy}%, data stale after ${alertRules.staleHours} hours.`;
  const watch = lastKpiWatch;
  document.querySelector("#settings-kpi-summary").textContent = watch ? `${watch.watched} live line${watch.watched === 1 ? "" : "s"} with a goal, ${watch.noGoal.length} without one. Set each campaign's KPI and goal in the KPI watcher.` : "Set each campaign's KPI and goal in the KPI watcher.";
  document.querySelector("#settings-metrics-summary").textContent = `Every campaign shows ${metricPrefs.defaults.map(metricLabel).join(", ")} unless you change it on that campaign.`;
  const viewCount = Array.isArray(savedViews) ? savedViews.length : Object.keys(savedViews?.views || savedViews || {}).length;
  document.querySelector("#settings-views-summary").textContent = viewCount ? `${viewCount} saved filter view${viewCount === 1 ? "" : "s"}.` : "Save the filters you use often and switch back to them in one click.";
  document.querySelector("#settings-brief-status").textContent = todoFolder ? `Watching “${todoFolder.name}”.` : brief ? `Last brief ${shortDate(brief.date)}; no folder connected.` : "Not set up yet.";
  document.querySelector("#settings-report-status").textContent = reportFolder ? `Watching “${reportFolder.name}”${reportState.lastChecked ? `, checked ${reportState.lastChecked.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}.` : "Not connected.";
  document.querySelector("#settings-dcm-status").textContent = dcmFolder ? `Watching “${dcmFolder.name}”.` : "Not connected.";
  const waiting = readReportInbox(localStorage).length + pendingImports().length;
  document.querySelector("#settings-review-status").textContent = waiting ? `${waiting} item${waiting === 1 ? "" : "s"} waiting.` : "Nothing waiting.";
  document.querySelector("#settings-history-status").textContent = importHistory.length ? `${importHistory.length} import${importHistory.length === 1 ? "" : "s"} recorded; the last on ${new Date(importHistory[0].importedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}.` : "No imports yet.";
  const setUp = Object.values(billing).filter(config => config.rows?.length).length;
  document.querySelector("#settings-billing-status").textContent = setUp ? `${setUp} client${setUp === 1 ? "" : "s"} set up.` : "No clients set up yet. Upload a past billing file on a client's tab.";
  renderStorageMeters();
}
document.querySelector("#settings-name").addEventListener("change", event => {
  const name = event.target.value.trim().slice(0, 60);
  try { if (name) localStorage.setItem("northstar-profile-name", name); else localStorage.removeItem("northstar-profile-name"); } catch { /* keeps the default greeting */ }
  renderProfile();
  applyPageView();
});
document.querySelector("#settings-page").addEventListener("click", event => {
  const open = event.target.closest("[data-settings-open]");
  if (open) { document.querySelector(open.dataset.settingsOpen)?.click(); return; }
  if (event.target.closest("[data-settings-kpi]")) { openMetricDetail("kpi"); return; }
  if (event.target.closest("[data-settings-welcome]")) { onboarding = writeOnboarding(localStorage, { ...onboarding, dismissed: false }); setPageView(null); return; }
  if (event.target.closest("[data-settings-sources]")) { event.preventDefault(); setSourcesView(true); return; }
  const page = event.target.closest("[data-page-view]");
  if (page) { event.preventDefault(); setPageView(page.dataset.pageView); }
});

// --- Storage: how full each store is, shown in Settings and flagged on the sidebar when it's nearly full ---
const STORAGE_TEXT = { ok: "", filling: "Getting full", full: "Nearly full" };
function setMeter(id, share, valueText) {
  const meter = document.querySelector(id);
  const level = storageLevel(share);
  meter.dataset.level = level;
  meter.querySelector(".storage-bar span").style.width = `${Math.min(100, Math.max(1, share * 100))}%`;
  meter.querySelector(".storage-bar").setAttribute("aria-valuenow", String(Math.round(share * 100)));
  meter.querySelector(".storage-meter-value").textContent = `${valueText}${STORAGE_TEXT[level] ? ` · ${STORAGE_TEXT[level]}` : ""}`;
}
const megabytes = bytes => bytes >= 1_073_741_824 ? `${(bytes / 1_073_741_824).toFixed(1)} GB` : `${(bytes / 1_048_576).toFixed(1)} MB`;
async function storageShares() {
  const local = localStorageUsed(localStorage) / LOCAL_STORAGE_LIMIT;
  const estimate = await navigator.storage?.estimate?.().catch(() => null) ?? null;
  const persisted = await navigator.storage?.persisted?.().catch(() => false) ?? false;
  return { local, estimate, persisted };
}
async function renderStorageMeters() {
  const { local, estimate, persisted } = await storageShares();
  setMeter("#storage-local", local, `${Math.round(local * 100)}% of about 5 MB`);
  const dbShare = estimate?.quota ? estimate.usage / estimate.quota : 0;
  setMeter("#storage-db", dbShare, estimate ? `${megabytes(estimate.usage || 0)} of ${megabytes(estimate.quota || 0)} available` : "Not available in this browser");
  document.querySelector("#storage-note").textContent = persisted ? "Chrome keeps this data even when your disk is low." : "Chrome may clear the DCM and DSP data if your disk gets very low. Keeping a recent backup protects it.";
}
async function updateStorageWarning() {
  const { local, estimate } = await storageShares();
  const full = storageFullShown || local >= 0.8 || (estimate?.quota && estimate.usage / estimate.quota >= 0.8);
  document.querySelector("#nav-settings-warning").hidden = !full;
  if (full && !storageWarned && !storageFullShown) { storageWarned = true; showToast("Storage is nearly full", "Open Settings to see what’s using it, and download a backup."); }
  if (pageView === "settings") renderStorageMeters();
}
