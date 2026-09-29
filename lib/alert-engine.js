import { discrepancyStatus, resolveSpend } from "./source-comparison.js";
import { campaignFlightStatus, effectivePacing } from "./spend-pacing.js";
import { calculateKpi } from "./metric-calculations.js";
import { compareLatestSnapshots } from "./performance-snapshots.js";
import { isCampaignArchived } from "./campaign-archive.js";

export const DEFAULT_ALERT_RULES = Object.freeze({ underPacing: 85, overPacing: 110, discrepancy: 10, kpiTolerance: 10, kpiDeterioration: 20, staleHours: 36, minimumImpressions: 1000 });

function metricNumber(value) {
  const number = Number(String(value ?? "").replace(/[$,%×x\s,]/gi, ""));
  return Number.isFinite(number) ? number : null;
}

function alertId(campaign, type, fallback) {
  const identity = campaign.campaignId || [campaign.client, campaign.name].filter(Boolean).join("-") || fallback;
  return `${identity}-${type}`.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function evaluateKpiTarget(campaign, tolerance = 10) {
  const actual = metricNumber(campaign.value);
  const target = metricNumber(String(campaign.target ?? "").replace(/^target\s*/i, ""));
  if (actual === null || target === null || campaign.value === "—") return null;
  const metric = String(campaign.kpi || "KPI").toUpperCase();
  const lowerIsBetter = new Set(["CPA", "CPC", "CPM", "CPL", "CPI"]).has(metric);
  const boundary = lowerIsBetter ? target * (1 + tolerance / 100) : target * (1 - tolerance / 100);
  const flagged = lowerIsBetter ? actual > boundary : actual < boundary;
  const difference = target === 0 ? null : Math.abs(actual - target) / Math.abs(target) * 100;
  return { flagged, actual, target, lowerIsBetter, difference, metric };
}

export function evaluateKpiDeterioration(campaign, threshold = 20) {
  const comparison = compareLatestSnapshots(campaign);
  if (!comparison) return null;
  const previous = calculateKpi(campaign.kpi, comparison.previous);
  const latest = calculateKpi(campaign.kpi, comparison.latest);
  if (!previous || !latest || previous.value === 0) return null;
  const metric = String(campaign.kpi || "KPI").toUpperCase();
  const lowerIsBetter = new Set(["CPA", "CPC", "CPM", "CPL", "CPI"]).has(metric);
  const deterioration = (lowerIsBetter ? latest.value - previous.value : previous.value - latest.value) / Math.abs(previous.value) * 100;
  return { flagged: deterioration > threshold, deterioration, metric, previous, latest };
}

export function evaluateMissingReport(campaign, asOf = new Date()) {
  const cadence = String(campaign.reportCadence || "none").toLowerCase();
  if (!new Set(["daily", "weekly"]).has(cadence)) return null;
  if (!campaign.dataAsOf) return { missing: true, cadence, hoursOld: null };
  const timestamp = Date.parse(`${campaign.dataAsOf}T23:59:59Z`);
  if (!Number.isFinite(timestamp) || timestamp > asOf.getTime()) return null;
  const hoursOld = (asOf.getTime() - timestamp) / 3_600_000;
  const maximumHours = cadence === "daily" ? 36 : 192;
  return { missing: hoursOld > maximumHours, cadence, hoursOld, maximumHours };
}

export function validateAlertRules(input) {
  const rules = {
    underPacing: Number(input.underPacing),
    overPacing: Number(input.overPacing),
    discrepancy: Number(input.discrepancy),
    kpiTolerance: Number(input.kpiTolerance),
    kpiDeterioration: Number(input.kpiDeterioration),
    staleHours: Number(input.staleHours),
    minimumImpressions: Number(input.minimumImpressions)
  };
  const errors = [];
  if (!Number.isFinite(rules.underPacing) || rules.underPacing < 0 || rules.underPacing >= 100) errors.push("Underpacing threshold must be between 0 and 99.9%.");
  if (!Number.isFinite(rules.overPacing) || rules.overPacing <= 100) errors.push("Overpacing threshold must be greater than 100%.");
  if (!Number.isFinite(rules.discrepancy) || rules.discrepancy < 0 || rules.discrepancy > 100) errors.push("Discrepancy threshold must be between 0 and 100%.");
  if (!Number.isFinite(rules.kpiTolerance) || rules.kpiTolerance < 0 || rules.kpiTolerance > 100) errors.push("KPI tolerance must be between 0 and 100%.");
  if (!Number.isFinite(rules.kpiDeterioration) || rules.kpiDeterioration < 0 || rules.kpiDeterioration > 1000) errors.push("KPI deterioration threshold must be between 0 and 1,000%.");
  if (!Number.isFinite(rules.staleHours) || rules.staleHours < 1 || rules.staleHours > 720) errors.push("Data freshness threshold must be between 1 and 720 hours.");
  if (!Number.isInteger(rules.minimumImpressions) || rules.minimumImpressions < 0 || rules.minimumImpressions > 1_000_000_000) errors.push("Minimum impressions must be a whole number between 0 and 1,000,000,000.");
  if (Number.isFinite(rules.underPacing) && Number.isFinite(rules.overPacing) && rules.underPacing >= rules.overPacing) errors.push("Underpacing must be below overpacing.");
  return { valid: errors.length === 0, errors, rules: errors.length ? null : rules };
}

export function evaluateCampaignAlerts(campaigns, rules = DEFAULT_ALERT_RULES, asOf = new Date()) {
  const minimumImpressions = Number.isFinite(Number(rules.minimumImpressions)) ? Number(rules.minimumImpressions) : DEFAULT_ALERT_RULES.minimumImpressions;
  return campaigns.flatMap((campaign, campaignIndex) => {
    if (isCampaignArchived(campaign)) return [];
    const flightStatus = campaignFlightStatus(campaign, asOf);
    if (["scheduled", "completed"].includes(flightStatus)) return [];
    const alerts = [];
    if (campaign.requiresMapping) alerts.push({ id: alertId(campaign, "unmapped", campaignIndex), campaignIndex, severity: "warning", symbol: "?", title: "Campaign ID needs mapping", detail: "Add the stable source campaign ID in campaign settings", campaign });
    const expectedReport = evaluateMissingReport(campaign, asOf);
    if (expectedReport?.missing) alerts.push({ id: alertId(campaign, "missing-report", campaignIndex), campaignIndex, severity: "warning", symbol: "↓", title: "Expected report is overdue", detail: expectedReport.hoursOld === null ? `No ${expectedReport.cadence} report has been received` : `${expectedReport.cadence} report · ${Math.floor(expectedReport.hoursOld)} hours old`, campaign });
    const dataTimestamp = campaign.dataAsOf ? Date.parse(`${campaign.dataAsOf}T23:59:59Z`) : null;
    const staleHours = dataTimestamp && dataTimestamp <= asOf.getTime() ? (asOf.getTime() - dataTimestamp) / 3_600_000 : null;
    if (staleHours !== null && staleHours > rules.staleHours) alerts.push({ id: alertId(campaign, "stale", campaignIndex), campaignIndex, severity: "warning", symbol: "◷", title: "Data is stale", detail: `Data through ${campaign.dataAsOf} · ${Math.floor(staleHours)} hours old`, campaign });
    const pacing = effectivePacing({ ...campaign, spend: resolveSpend(campaign, "billing") }, asOf);
    const meetsMinimumVolume = campaign.impressions === null || campaign.impressions === undefined || Number(campaign.impressions) >= minimumImpressions;
    const pacingLabel = pacing === null ? "—" : Number(pacing.toFixed(1));
    if (pacing !== null && pacing > rules.overPacing) alerts.push({ id: alertId(campaign, "over", campaignIndex), campaignIndex, severity: "critical", symbol: "↗", title: "Overpacing", detail: `${pacingLabel}% pacing · limit ${rules.overPacing}%`, campaign });
    if (pacing !== null && pacing < rules.underPacing) alerts.push({ id: alertId(campaign, "under", campaignIndex), campaignIndex, severity: "warning", symbol: "↘", title: "Underpacing", detail: `${pacingLabel}% pacing · minimum ${rules.underPacing}%`, campaign });
    const discrepancy = discrepancyStatus(campaign, rules.discrepancy);
    if (meetsMinimumVolume && discrepancy.flagged) alerts.push({ id: alertId(campaign, "source", campaignIndex), campaignIndex, severity: "info", symbol: "⇄", title: "Source discrepancy", detail: `${discrepancy.label} · limit ${rules.discrepancy}%`, campaign });
    const kpi = evaluateKpiTarget(campaign, rules.kpiTolerance);
    if (meetsMinimumVolume && kpi?.flagged) alerts.push({ id: alertId(campaign, `kpi-${kpi.metric}`, campaignIndex), campaignIndex, severity: "critical", symbol: "!", title: `${kpi.metric} outside target`, detail: `${campaign.value} actual · ${campaign.target} · ${kpi.difference?.toFixed(1) ?? "—"}% variance`, campaign });
    const deterioration = evaluateKpiDeterioration(campaign, rules.kpiDeterioration);
    if (meetsMinimumVolume && deterioration?.flagged) alerts.push({ id: alertId(campaign, `kpi-${deterioration.metric}-decline`, campaignIndex), campaignIndex, severity: "warning", symbol: "↘", title: `${deterioration.metric} deteriorating`, detail: `${deterioration.previous.formatted} to ${deterioration.latest.formatted} · ${deterioration.deterioration.toFixed(1)}% decline`, campaign });
    return alerts;
  }).sort((a, b) => ({ critical: 0, warning: 1, info: 2 })[a.severity] - ({ critical: 0, warning: 1, info: 2 })[b.severity]);
}
