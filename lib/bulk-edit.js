const BILLING = new Set(["first", "third", "reported"]);
const CADENCES = new Set(["none", "daily", "weekly"]);
const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const same = (left, right) => String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();

export const lineKey = (index, kind, id = "") => `${index}|${kind === "record" ? "record" : "item"}|${id}`;

export function parseLineKey(key) {
  const [index, kind, ...rest] = String(key).split("|");
  return { index: Number(index), kind, id: rest.join("|") };
}

/** Blank fields mean "leave unchanged", so a bulk edit only touches what was filled in. */
export function validateBulkEdits(edits) {
  const errors = [];
  for (const [field, label] of [["startDate", "Start date"], ["endDate", "End date"]]) {
    if (edits[field] && !isDate(edits[field])) errors.push(`${label} must be a valid date.`);
  }
  if (edits.startDate && edits.endDate && edits.startDate > edits.endDate) errors.push("End date must be on or after the start date.");
  if (edits.budget !== undefined && edits.budget !== "" && !(Number(String(edits.budget).replace(/[$,\s]/g, "")) > 0)) errors.push("Budget must be a number above zero.");
  if (edits.billingSource && !BILLING.has(edits.billingSource)) errors.push("Choose a valid billing source.");
  if (edits.reportCadence && !CADENCES.has(edits.reportCadence)) errors.push("Choose a valid report cadence.");
  return errors;
}

export function applyRecordEdits(record, edits) {
  const text = field => String(edits[field] ?? "").trim();
  const next = { ...record };
  if (text("owner")) next.owner = text("owner");
  if (text("channel")) next.channel = text("channel");
  if (text("kpi")) next.kpi = text("kpi").toUpperCase();
  if (text("target")) next.target = /^target/i.test(text("target")) ? text("target") : `Target ${text("target")}`;
  if (BILLING.has(edits.billingSource)) next.billingSource = edits.billingSource;
  if (CADENCES.has(edits.reportCadence)) next.reportCadence = edits.reportCadence;
  return next;
}

function editLine(line, edits) {
  const next = { ...line };
  if (edits.startDate) next.startDate = edits.startDate;
  if (edits.endDate) next.endDate = edits.endDate;
  const budget = Number(String(edits.budget ?? "").replace(/[$,\s]/g, ""));
  if (String(edits.budget ?? "").trim() !== "" && budget > 0) next.budget = budget;
  return next;
}

/** Edits line items and planned flights (matched by ID) on one record. */
export function applyLineItemEdits(record, ids, edits) {
  const wanted = id => ids.some(candidate => same(candidate, id));
  return {
    ...record,
    lineItems: (record.lineItems || []).map(item => wanted(item.id) ? editLine(item, edits) : item),
    lineItemFlights: (record.lineItemFlights || []).map(flight => wanted(flight.id) ? editLine(flight, edits) : flight)
  };
}

/** Applies one edit set to a mixed selection and reports how much each part changed. */
export function applyBulkEdits(campaigns, keys, edits) {
  const parsed = keys.map(parseLineKey);
  const next = campaigns.map(campaign => campaign);
  let records = 0;
  let items = 0;
  const idsByRecord = new Map();
  for (const { index, kind, id } of parsed) {
    if (!next[index]) continue;
    if (kind === "record") { next[index] = applyRecordEdits(next[index], edits); records += 1; }
    else idsByRecord.set(index, [...(idsByRecord.get(index) || []), id]);
  }
  for (const [index, ids] of idsByRecord) { next[index] = applyLineItemEdits(next[index], ids, edits); items += ids.length; }
  return { campaigns: next, records, items };
}
