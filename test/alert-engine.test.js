import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ALERT_RULES, evaluateCampaignAlerts, evaluateKpiDeterioration, evaluateKpiTarget, evaluateMissingReport, validateAlertRules } from "../lib/alert-engine.js";

test("validates and normalizes alert thresholds", () => {
  assert.deepEqual(validateAlertRules({ underPacing: "80", overPacing: "115", discrepancy: "12.5", kpiTolerance: "5", kpiDeterioration: "25", staleHours: "48", minimumImpressions: "2500" }), { valid: true, errors: [], rules: { underPacing: 80, overPacing: 115, discrepancy: 12.5, kpiTolerance: 5, kpiDeterioration: 25, staleHours: 48, minimumImpressions: 2500 } });
});

test("rejects invalid and crossed thresholds", () => {
  const result = validateAlertRules({ underPacing: 120, overPacing: 100, discrepancy: -1, kpiTolerance: 101, kpiDeterioration: -1, staleHours: 0, minimumImpressions: -1 });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 8);
});

test("evaluates KPI deterioration between same-source snapshots", () => {
  const campaign = { kpi: "CTR", performanceSnapshots: [
    { date: "2026-09-20", source: "CM360", impressions: 1000, clicks: 20 },
    { date: "2026-09-25", source: "CM360", impressions: 2000, clicks: 20 }
  ] };
  const result = evaluateKpiDeterioration(campaign, 20);
  assert.equal(result.flagged, true);
  assert.equal(result.deterioration, 50);
  assert.equal(evaluateKpiDeterioration(campaign, 50).flagged, false);
});

test("flags missing and overdue reports only for monitored cadences", () => {
  const asOf = new Date("2026-09-28T12:00:00Z");
  assert.equal(evaluateMissingReport({ reportCadence: "daily" }, asOf).missing, true);
  assert.equal(evaluateMissingReport({ reportCadence: "daily", dataAsOf: "2026-09-26" }, asOf).missing, true);
  assert.equal(evaluateMissingReport({ reportCadence: "weekly", dataAsOf: "2026-09-26" }, asOf).missing, false);
  assert.equal(evaluateMissingReport({ reportCadence: "none" }, asOf), null);
});

test("flags imported campaigns awaiting stable ID mapping", () => {
  const alerts = evaluateCampaignAlerts([{ client: "Apex", name: "Launch", requiresMapping: true, pacing: 100 }]);
  assert.equal(alerts[0].title, "Campaign ID needs mapping");
  assert.equal(alerts[0].id, "apex-launch-unmapped");
});

test("suppresses KPI and source alerts until minimum volume is reached", () => {
  const campaign = { client: "Apex", name: "Launch", pacing: 100, spend: 100, billingSource: "third", impressions: 999, kpi: "CTR", value: "0.2%", target: "1%", firstPartySpend: 120, thirdPartySpend: 100 };
  assert.deepEqual(evaluateCampaignAlerts([campaign], DEFAULT_ALERT_RULES), []);
  assert.deepEqual(evaluateCampaignAlerts([{ ...campaign, impressions: 1000 }], DEFAULT_ALERT_RULES).map(alert => alert.title), ["CTR outside target", "Source discrepancy"]);
});

test("evaluates and prioritizes pacing and discrepancy alerts", () => {
  const campaigns = [
    { name: "Under", pacing: 79, spend: 100, firstPartySpend: 100, thirdPartySpend: 100 },
    { name: "Over", pacing: 112, spend: 100, firstPartySpend: 115, thirdPartySpend: 100, billingSource: "third" }
  ];
  const alerts = evaluateCampaignAlerts(campaigns, DEFAULT_ALERT_RULES);
  assert.deepEqual(alerts.map(alert => alert.title), ["Overpacing", "Underpacing", "Source discrepancy"]);
  assert.equal(alerts[0].severity, "critical");
  assert.equal(alerts[2].detail, "15.0% source variance · limit 10%");
});

test("does not alert at the exact threshold", () => {
  const alerts = evaluateCampaignAlerts([{ pacing: 85, spend: 100, firstPartySpend: 110, thirdPartySpend: 100, billingSource: "third" }]);
  assert.equal(alerts.length, 0);
});

test("evaluates lower-is-better cost KPIs with tolerance", () => {
  assert.deepEqual(evaluateKpiTarget({ kpi: "CPA", value: "$48.20", target: "Target $40" }, 10), { flagged: true, actual: 48.2, target: 40, lowerIsBetter: true, difference: 20.500000000000007, metric: "CPA" });
  assert.equal(evaluateKpiTarget({ kpi: "CPA", value: "$43", target: "$40" }, 10).flagged, false);
});

test("evaluates higher-is-better percentage and multiplier KPIs", () => {
  assert.equal(evaluateKpiTarget({ kpi: "VCR", value: "60%", target: "Target 70%" }, 10).flagged, true);
  assert.equal(evaluateKpiTarget({ kpi: "ROAS", value: "4.2x", target: "3.5x" }, 10).flagged, false);
  assert.equal(evaluateKpiTarget({ kpi: "CTR", value: "—", target: "1%" }, 10), null);
});

test("campaign alert evaluation includes KPI misses", () => {
  const alerts = evaluateCampaignAlerts([{ client: "Apex", name: "Retargeting", pacing: 100, kpi: "CPA", value: "$50", target: "$40" }]);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].title, "CPA outside target");
  assert.equal(alerts[0].id, "apex-retargeting-kpi-cpa");
});

test("alert IDs remain stable when campaign ordering changes", () => {
  const campaign = { campaignId: "CMP 42", pacing: 120 };
  assert.equal(evaluateCampaignAlerts([campaign])[0].id, "cmp-42-over");
  assert.equal(evaluateCampaignAlerts([{ pacing: 100 }, campaign])[0].id, "cmp-42-over");
});

test("pacing alerts use authoritative spend and flight dates", () => {
  const campaign = { name: "Flight", startDate: "2026-09-01", endDate: "2026-09-10", budget: 1000, spend: 100, firstPartySpend: 600, billingSource: "first", pacing: 50 };
  const alerts = evaluateCampaignAlerts([campaign], DEFAULT_ALERT_RULES, new Date("2026-09-04T00:00:00Z"));
  assert.equal(alerts[0].title, "Overpacing");
  assert.equal(alerts[0].detail, "150% pacing · limit 110%");
});

test("future flights do not create false underpacing alerts", () => {
  const campaign = { name: "Future", startDate: "2026-10-01", endDate: "2026-10-10", budget: 1000, spend: 0, pacing: 1 };
  const alerts = evaluateCampaignAlerts([campaign], DEFAULT_ALERT_RULES, new Date("2026-09-25T00:00:00Z"));
  assert.equal(alerts.length, 0);
});

test("completed flights no longer generate operational alerts", () => {
  const campaign = { name: "Complete", startDate: "2026-09-01", endDate: "2026-09-10", budget: 1000, spend: 1500, pacing: 150, kpi: "CPA", value: "$80", target: "$40", firstPartySpend: 1500, thirdPartySpend: 1000 };
  const alerts = evaluateCampaignAlerts([campaign], DEFAULT_ALERT_RULES, new Date("2026-09-25T00:00:00Z"));
  assert.equal(alerts.length, 0);
});

test("archived campaigns do not generate operational alerts", () => {
  const campaign = { client: "Apex", name: "Archived", archivedAt: "2026-09-20T12:00:00Z", pacing: 200, kpi: "CPA", value: "$100", target: "$10", firstPartySpend: 100, thirdPartySpend: 10 };
  assert.deepEqual(evaluateCampaignAlerts([campaign], DEFAULT_ALERT_RULES), []);
});

test("flags stale dated data but not current or future-dated data", () => {
  const campaigns = [
    { name: "Stale", pacing: 100, dataAsOf: "2026-09-20" },
    { name: "Current", pacing: 100, dataAsOf: "2026-09-25" },
    { name: "Future date", pacing: 100, dataAsOf: "2026-09-26" }
  ];
  const alerts = evaluateCampaignAlerts(campaigns, { ...DEFAULT_ALERT_RULES, staleHours: 36 }, new Date("2026-09-25T12:00:00Z"));
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].title, "Data is stale");
  assert.match(alerts[0].detail, /Data through 2026-09-20/);
});
