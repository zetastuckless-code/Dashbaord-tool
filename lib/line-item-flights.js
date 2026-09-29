import { parseCsv } from "./importer.js";

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function amount(value) {
  return Number(String(value ?? "").replace(/[$,\s]/g, ""));
}

export function saveLineItemFlight(campaign, input, now = new Date()) {
  const id = String(input.id ?? "").trim();
  const name = String(input.name ?? "").trim();
  const startDate = String(input.startDate ?? "").trim();
  const endDate = String(input.endDate ?? "").trim();
  const budget = amount(input.budget);
  const errors = [];
  if (!id || !name) errors.push("Line item ID and name are required.");
  if (!validDate(startDate) || !validDate(endDate)) errors.push("Flight dates must use valid YYYY-MM-DD dates.");
  if (validDate(startDate) && validDate(endDate) && endDate < startDate) errors.push("Flight end must be on or after flight start.");
  if (!Number.isFinite(budget) || budget <= 0) errors.push("Line item budget must be greater than zero.");
  const flight = { id, name, startDate, endDate, budget, updatedAt: now.toISOString() };
  const flights = [...(campaign.lineItemFlights || [])];
  const match = flights.findIndex(item => item.id.toLowerCase() === id.toLowerCase());
  if (!errors.length) {
    if (match === -1) flights.push(flight);
    else flights[match] = { ...flights[match], ...flight };
    const campaignBudget = Number(campaign.budget);
    const allocated = flights.reduce((total, item) => total + Number(item.budget || 0), 0);
    if (Number.isFinite(campaignBudget) && campaignBudget > 0 && allocated > campaignBudget + 0.005) errors.push("Line item budgets cannot exceed the current approved campaign budget.");
  }
  if (errors.length) return { valid: false, errors, campaign };
  return { valid: true, errors: [], campaign: { ...campaign, lineItemFlights: flights }, flight, created: match === -1 };
}

export function summarizeLineItemBudgets(campaign) {
  const campaignBudget = Number(campaign.budget);
  const allocated = (campaign.lineItemFlights || []).reduce((total, item) => total + (Number(item.budget) || 0), 0);
  const comparable = Number.isFinite(campaignBudget) && campaignBudget >= 0;
  return {
    allocated,
    campaignBudget: comparable ? campaignBudget : null,
    remaining: comparable ? campaignBudget - allocated : null,
    fullyAllocated: comparable && Math.abs(campaignBudget - allocated) < 0.005,
    overAllocated: comparable && allocated > campaignBudget + 0.005
  };
}

export function removeLineItemFlight(campaign, lineItemId) {
  const normalizedId = String(lineItemId ?? "").trim().toLowerCase();
  if (!normalizedId) return { removed: false, campaign };
  const flights = campaign.lineItemFlights || [];
  const remaining = flights.filter(flight => String(flight.id).trim().toLowerCase() !== normalizedId);
  if (remaining.length === flights.length) return { removed: false, campaign };
  return { removed: true, campaign: { ...campaign, lineItemFlights: remaining } };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportLineItemFlightsCsv(campaign) {
  const headers = ["client", "campaign", "campaign_id", "line_item_id", "line_item_name", "flight_start", "flight_end", "line_item_budget", "campaign_budget"];
  const rows = (campaign.lineItemFlights || []).map(flight => [campaign.client, campaign.name, campaign.campaignId, flight.id, flight.name, flight.startDate, flight.endDate, flight.budget, campaign.budget]);
  return [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
}

export function importLineItemFlightsCsv(campaign, text) {
  let rows;
  try { rows = parseCsv(String(text).replace(/^\uFEFF/, "")); }
  catch (error) { return { valid: false, errors: [error.message], campaign, imported: 0 }; }
  if (rows.length < 2) return { valid: false, errors: ["The line-item file must include a header and at least one data row."], campaign, imported: 0 };
  const headers = rows[0].map(header => String(header).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  const required = ["line_item_id", "line_item_name", "flight_start", "flight_end", "line_item_budget"];
  const missing = required.filter(header => !headers.includes(header));
  if (missing.length) return { valid: false, errors: [`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`], campaign, imported: 0 };

  let updated = campaign;
  const errors = [];
  rows.slice(1).forEach((row, index) => {
    const record = Object.fromEntries(headers.map((header, column) => [header, row[column] ?? ""]));
    if (record.campaign_id && campaign.campaignId && record.campaign_id.trim().toLowerCase() !== String(campaign.campaignId).trim().toLowerCase()) {
      errors.push(`Row ${index + 2}: campaign ID does not match the open campaign.`);
      return;
    }
    const result = saveLineItemFlight(updated, { id: record.line_item_id, name: record.line_item_name, startDate: record.flight_start, endDate: record.flight_end, budget: record.line_item_budget });
    if (!result.valid) errors.push(`Row ${index + 2}: ${result.errors.join(" ")}`);
    else updated = result.campaign;
  });
  return errors.length ? { valid: false, errors: errors.slice(0, 8), campaign, imported: 0 } : { valid: true, errors: [], campaign: updated, imported: rows.length - 1 };
}
