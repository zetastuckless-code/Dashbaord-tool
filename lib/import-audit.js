const STATUS_GROUPS = Object.freeze({
  successful: ["Imported", "Imported with warnings"],
  attention: ["Rejected", "Duplicate"],
  historical: ["Superseded", "Reverted"]
});

export function filterImportAudit(history, { status = "all", query = "" } = {}) {
  const search = String(query).trim().toLowerCase();
  return history.filter(record => {
    const matchesStatus = status === "all" || (STATUS_GROUPS[status] || [status]).includes(record.status);
    const searchable = [record.fileName, record.status, record.fingerprint, ...(record.errors || []), ...(record.warnings || [])].join(" ").toLowerCase();
    return matchesStatus && (!search || searchable.includes(search));
  });
}

export function summarizeImportAudit(history) {
  return {
    total: history.length,
    successful: filterImportAudit(history, { status: "successful" }).length,
    attention: filterImportAudit(history, { status: "attention" }).length,
    historical: filterImportAudit(history, { status: "historical" }).length
  };
}
