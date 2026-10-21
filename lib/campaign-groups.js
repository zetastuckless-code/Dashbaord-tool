import { dashboardFlightStatus } from "./campaign-filters.js";

const SEPARATOR = " — ";
const STATUS_ORDER = ["live", "scheduled", "completed", "archived"];

export function campaignGroupName(campaign) {
  const explicit = String(campaign.campaignGroup ?? "").trim();
  if (explicit) return explicit;
  const name = String(campaign.name ?? "");
  return name.includes(SEPARATOR) ? name.split(SEPARATOR)[0].trim() : name;
}

export function groupKey(campaign) {
  return `${String(campaign.client ?? "").trim().toLowerCase()}::${campaignGroupName(campaign).toLowerCase()}`;
}

function recordLineName(campaign) {
  const name = String(campaign.name ?? "");
  return name.includes(SEPARATOR) ? name.slice(name.indexOf(SEPARATOR) + SEPARATOR.length).trim() : campaign.channel || name;
}

/**
 * Lines shown when a campaign row is expanded. Imported line items (DSP export) are merged with
 * planned flights (IO / manual) by ID or name; a record with neither is its own single line.
 */
export function linesForRecord(record) {
  const lines = (record.lineItems || []).map(item => ({ ...item, kind: "line-item", record }));
  const seen = new Map(lines.map((line, index) => [String(line.id ?? "").toLowerCase() || `name:${String(line.name).toLowerCase()}`, index]));
  for (const flight of record.lineItemFlights || []) {
    const idKey = String(flight.id ?? "").toLowerCase();
    const index = seen.get(idKey) ?? seen.get(`name:${String(flight.name).toLowerCase()}`);
    if (index !== undefined) {
      lines[index] = { ...flight, ...lines[index], budget: lines[index].budget ?? flight.budget, startDate: lines[index].startDate ?? flight.startDate, endDate: lines[index].endDate ?? flight.endDate };
    } else {
      lines.push({ ...flight, kind: "flight", record });
    }
  }
  return lines.length ? lines : [{ id: record.campaignId || record.name, name: recordLineName(record), kind: "record", record, ...record }];
}

// A campaign created from an IO before any report has a spend-less "Manual" record; once real lines exist it is only a shell.
export const isPlaceholder = record => record.source === "Manual" && !(Number(record.spend) > 0) && !(record.lineItems || []).length && !(record.lineItemFlights || []).length;

/** Groups campaign records into campaigns; each group keeps its records so rollups use real components. */
export function groupCampaigns(records, asOf = new Date()) {
  const groups = new Map();
  for (const record of records) {
    const key = groupKey(record);
    if (!groups.has(key)) groups.set(key, { key, client: record.client, name: campaignGroupName(record), short: record.short, className: record.className, records: [] });
    groups.get(key).records.push(record);
  }
  return [...groups.values()].map(group => {
    const statuses = group.records.map(record => dashboardFlightStatus(record, asOf));
    const starts = group.records.map(record => record.startDate).filter(Boolean).sort();
    const ends = group.records.map(record => record.endDate).filter(Boolean).sort();
    return {
      ...group,
      status: STATUS_ORDER.find(status => statuses.includes(status)) || "live",
      startDate: starts[0] || null,
      endDate: ends.at(-1) || null,
      lines: group.records.filter(record => group.records.length < 2 || !isPlaceholder(record)).flatMap(record => linesForRecord(record).map(line => group.records.length > 1 && line.kind === "record" ? { ...line, name: recordLineName(record) } : line))
    };
  });
}
