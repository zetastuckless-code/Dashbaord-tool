const STORAGE_KEY = "northstar-acknowledged-alerts";

export function alertSignature(alert) {
  const detail = String(alert?.detail ?? "").replace(/\b\d+\s+hours old\b/gi, "hours old");
  return [alert?.severity, alert?.title, detail, alert?.campaign?.dataAsOf].map(value => String(value ?? "").trim()).join("::");
}

function normalizeAcknowledgments(value) {
  if (!Array.isArray(value)) return [];
  const records = new Map();
  for (const item of value) {
    const record = typeof item === "string" ? { id: item, signature: null, acknowledgedAt: null } : item;
    if (!record || typeof record.id !== "string" || !record.id) continue;
    records.set(record.id, { id: record.id, signature: typeof record.signature === "string" ? record.signature : null, acknowledgedAt: typeof record.acknowledgedAt === "string" ? record.acknowledgedAt : null });
  }
  return [...records.values()];
}

export function readAcknowledgedAlerts(storage) {
  try { return normalizeAcknowledgments(JSON.parse(storage.getItem(STORAGE_KEY))); }
  catch { return []; }
}

export function acknowledgeAlert(records, alert, acknowledgedAt = new Date().toISOString()) {
  const normalized = normalizeAcknowledgments(records);
  const item = typeof alert === "string" ? { id: alert } : alert;
  if (!item?.id) return normalized;
  return [...normalized.filter(record => record.id !== item.id), { id: item.id, signature: typeof alert === "string" ? null : alertSignature(item), acknowledgedAt }];
}

export function writeAcknowledgedAlerts(storage, records) {
  storage.setItem(STORAGE_KEY, JSON.stringify(normalizeAcknowledgments(records)));
}

export function removeAcknowledgment(records, alertId) {
  return normalizeAcknowledgments(records).filter(record => record.id !== alertId);
}

export function unacknowledgedAlerts(alerts, records) {
  const acknowledged = new Map(normalizeAcknowledgments(records).map(record => [record.id, record]));
  return alerts.filter(alert => {
    const record = acknowledged.get(alert.id);
    return !record || (record.signature !== null && record.signature !== alertSignature(alert));
  });
}
