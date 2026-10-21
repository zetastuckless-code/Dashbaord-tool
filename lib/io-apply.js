import { createBudgetRevision } from "./budget-revisions.js";

const FLIGHT_FIELDS = ["rate", "rateType", "units", "unit", "kpi"];

/** Fields a new campaign can take from a parsed insertion order. */
export function campaignFieldsFromIo(io, fileName = "") {
  return {
    client: io.advertiser || "",
    name: io.campaign || "",
    startDate: io.startDate || "",
    endDate: io.endDate || "",
    budget: io.budget ?? "",
    budgetSource: "io",
    ioFileName: fileName,
    ioOrder: [io.orderNumber, io.revision].filter(Boolean).join("-") || null
  };
}

function toFlight(item, io, now) {
  const flight = { id: item.id, name: item.name, startDate: item.startDate || io.startDate || null, endDate: item.endDate || io.endDate || null, budget: item.budget, source: "io", updatedAt: now.toISOString() };
  for (const field of FLIGHT_FIELDS) if (item[field] !== null && item[field] !== undefined) flight[field] = item[field];
  return flight;
}

/**
 * Applies the selected IO placements to a campaign as line-item flights (merged by ID, so a revised IO updates
 * rather than duplicates) and, when asked, sets the campaign budget from the order with an audited revision.
 */
export function applyIoToCampaign(campaign, io, { fileName = "", selectedIds = null, setBudget = true, now = new Date() } = {}) {
  const selected = io.lineItems.filter(item => !selectedIds || selectedIds.includes(item.id));
  const flights = [...(campaign.lineItemFlights || [])];
  for (const item of selected) {
    const flight = toFlight(item, io, now);
    const match = flights.findIndex(existing => String(existing.id).toLowerCase() === String(item.id).toLowerCase());
    if (match === -1) flights.push(flight); else flights[match] = { ...flights[match], ...flight };
  }
  let next = { ...campaign, lineItemFlights: flights, ioFileName: fileName || campaign.ioFileName || null, ioOrder: [io.orderNumber, io.revision].filter(Boolean).join("-") || campaign.ioOrder || null };
  if (!next.startDate && io.startDate) next.startDate = io.startDate;
  if (!next.endDate && io.endDate) next.endDate = io.endDate;
  let revised = false;
  if (setBudget && io.budget > 0) {
    if (Number(next.budget) === io.budget) {
      next.budgetSource = "io";
    } else {
      const revision = createBudgetRevision(next, { amount: io.budget, effectiveDate: now.toISOString().slice(0, 10), fileName: fileName || "insertion-order.pdf", note: `Applied from insertion order${next.ioOrder ? ` ${next.ioOrder}` : ""}` }, now.toISOString());
      if (revision.valid) { next = revision.campaign; revised = true; }
    }
  }
  return { campaign: next, applied: selected.length, revised };
}
