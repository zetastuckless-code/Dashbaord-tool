export const WORKSPACE_BACKUP_VERSION = 1;

export function createWorkspaceBackup(state, exportedAt = new Date().toISOString()) {
  return JSON.stringify({
    schemaVersion: WORKSPACE_BACKUP_VERSION,
    exportedAt,
    campaigns: state.campaigns || [],
    importHistory: state.importHistory || [],
    alertRules: state.alertRules || {},
    visibleColumns: state.visibleColumns || [],
    acknowledgedAlerts: state.acknowledgedAlerts || [],
    dashboardView: state.dashboardView || {},
    savedViews: state.savedViews || []
  }, null, 2);
}

export function validateWorkspaceBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    return { valid: false, errors: ["Backup is not valid JSON."] };
  }
  const errors = [];
  if (!backup || typeof backup !== "object" || Array.isArray(backup)) errors.push("Backup must contain a workspace object.");
  if (backup?.schemaVersion !== WORKSPACE_BACKUP_VERSION) errors.push(`Unsupported backup version. Expected version ${WORKSPACE_BACKUP_VERSION}.`);
  if (!Array.isArray(backup?.campaigns)) errors.push("Backup campaigns must be an array.");
  if (!Array.isArray(backup?.importHistory)) errors.push("Backup import history must be an array.");
  if (!backup?.alertRules || typeof backup.alertRules !== "object" || Array.isArray(backup.alertRules)) errors.push("Backup alert rules must be an object.");
  if (!Array.isArray(backup?.visibleColumns)) errors.push("Backup visible columns must be an array.");
  if (!Array.isArray(backup?.acknowledgedAlerts)) errors.push("Backup acknowledgments must be an array.");
  if (!backup?.dashboardView || typeof backup.dashboardView !== "object" || Array.isArray(backup.dashboardView)) errors.push("Backup dashboard view must be an object.");
  if (backup?.savedViews !== undefined && !Array.isArray(backup.savedViews)) errors.push("Backup saved views must be an array.");
  return errors.length ? { valid: false, errors } : { valid: true, errors: [], backup };
}

export function restoreWorkspaceBackup(storage, backup) {
  storage.setItem("northstar-campaigns", JSON.stringify(backup.campaigns));
  storage.setItem("northstar-import-history", JSON.stringify(backup.importHistory));
  storage.setItem("northstar-alert-rules", JSON.stringify(backup.alertRules));
  storage.setItem("northstar-campaign-columns", JSON.stringify(backup.visibleColumns));
  storage.setItem("northstar-acknowledged-alerts", JSON.stringify(backup.acknowledgedAlerts));
  storage.setItem("northstar-dashboard-view", JSON.stringify(backup.dashboardView));
  storage.setItem("northstar-saved-views", JSON.stringify(backup.savedViews || []));
}
