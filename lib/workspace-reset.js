export const WORKSPACE_STORAGE_KEYS = Object.freeze([
  "northstar-campaigns", "northstar-import-history", "northstar-alert-rules", "northstar-campaign-columns",
  "northstar-acknowledged-alerts", "northstar-dashboard-view", "northstar-saved-views", "northstar-last-import-rollback", "northstar-folder-ledger", "northstar-campaign-metrics", "northstar-import-assignments", "northstar-campaign-totals", "northstar-campaign-status", "northstar-campaign-order", "northstar-todos", "northstar-brief", "northstar-billing", "northstar-salesforce", "northstar-reporting", "northstar-reviewed-imports", "northstar-third-party-links"
]);

export function resetWorkspaceStorage(storage) {
  for (const key of WORKSPACE_STORAGE_KEYS) storage.removeItem(key);
  return WORKSPACE_STORAGE_KEYS.length;
}
