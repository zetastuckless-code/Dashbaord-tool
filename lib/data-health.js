export function evaluateDataHealth(history, now = new Date()) {
  if (!Array.isArray(history) || !history.length) return { state: "empty", title: "Demo data", detail: "No reports imported", lastSync: "Not available" };
  const successful = history.find(record => ["Imported", "Imported with warnings"].includes(record.status));
  const latestSuccessTime = successful ? new Date(successful.importedAt).getTime() : null;
  const unresolvedFailures = history.filter(record => ["Rejected", "Duplicate"].includes(record.status) && (!latestSuccessTime || new Date(record.importedAt).getTime() > latestSuccessTime));
  if (!successful) return { state: "error", title: "Import attention needed", detail: `${unresolvedFailures.length} unsuccessful attempt${unresolvedFailures.length === 1 ? "" : "s"}`, lastSync: "Never" };
  const ageMs = Math.max(0, now.getTime() - latestSuccessTime);
  const ageHours = ageMs / 3_600_000;
  const lastSync = ageHours < 1 ? `${Math.max(1, Math.round(ageMs / 60_000))} min ago` : ageHours < 24 ? `${Math.round(ageHours)} hr ago` : `${Math.floor(ageHours / 24)} days ago`;
  if (unresolvedFailures.length) return { state: "warning", title: "Import attention needed", detail: `${unresolvedFailures.length} issue${unresolvedFailures.length === 1 ? "" : "s"} since last sync`, lastSync };
  if (ageHours >= 24) return { state: "stale", title: "Data may be stale", detail: "No successful import in 24 hours", lastSync };
  if (successful.status === "Imported with warnings") {
    const warningCount = successful.warnings?.length || 1;
    return { state: "warning", title: "Imported with warnings", detail: `${warningCount} item${warningCount === 1 ? "" : "s"} to review`, lastSync };
  }
  return { state: "healthy", title: "Data is current", detail: "Latest import succeeded", lastSync };
}
