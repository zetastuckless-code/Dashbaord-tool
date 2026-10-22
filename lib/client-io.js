import { groupCampaigns } from "./campaign-groups.js";
import { ioLines } from "./io-plan.js";
import { isCampaignArchived } from "./campaign-archive.js";

const validNumber = value => Number.isFinite(value) && value > 0;

/**
 * The insertion-order reference for each of a client's campaigns: the orders behind it, the flight it is paced on,
 * the total budget, and each order's placements. Orders come from the saved campaign totals; a campaign created from
 * an IO before totals existed falls back to the IO fields saved on its records.
 */
export function buildClientIoSummary({ campaigns, totals = {}, client, asOf = new Date() }) {
  const records = campaigns.filter(record => record.client === client && !isCampaignArchived(record));
  return groupCampaigns(records, asOf).map(group => {
    const entry = totals[group.key] || null;
    if (entry) {
      return {
        key: group.key, name: group.name, status: group.status, hasIo: true, source: "orders",
        budget: entry.budget, startDate: entry.startDate, endDate: entry.endDate,
        flightEdited: Boolean(entry.datesOverride),
        orders: entry.orders.map(order => ({ order: order.order, fileName: order.fileName, budget: order.budget, startDate: order.startDate, endDate: order.endDate, appliedAt: order.appliedAt })),
        // Lines, not raw placements: an extension or later flight with the same name adds to its line.
        placements: ioLines(entry).map(line => ({ id: line.key, name: line.name, order: line.placements.length > 1 ? `${line.placements.length} flights combined` : line.placements[0]?.order || null, startDate: line.startDate, endDate: line.endDate, budget: line.budget, flights: line.placements.length, reported: group.records.filter(record => record.ioLineStatus === "matched" && record.ioLine === line.key).length }))
      };
    }
    const fromIo = group.records.filter(record => record.ioFileName || record.ioOrder || record.budgetSource === "io");
    if (!fromIo.length) return { key: group.key, name: group.name, status: group.status, hasIo: false, budget: null, startDate: group.startDate, endDate: group.endDate, flightEdited: false, orders: [], placements: [] };
    const budget = fromIo.reduce((sum, record) => sum + (validNumber(Number(record.budget)) ? Number(record.budget) : 0), 0);
    const flights = fromIo.flatMap(record => (record.lineItemFlights || []).filter(flight => flight.source === "io"));
    const seen = new Set();
    const orders = fromIo.filter(record => record.ioFileName || record.ioOrder).filter(record => { const id = `${record.ioOrder}|${record.ioFileName}`; return seen.has(id) ? false : seen.add(id); })
      .map(record => ({ order: record.ioOrder || null, fileName: record.ioFileName || "", budget: null, startDate: null, endDate: null, appliedAt: null }));
    return {
      key: group.key, name: group.name, status: group.status, hasIo: true, source: "campaign",
      budget: budget || null, startDate: group.startDate, endDate: group.endDate, flightEdited: false, orders,
      placements: flights.filter(flight => flight.startDate && flight.endDate).map(flight => ({ id: String(flight.id ?? ""), name: String(flight.name ?? ""), order: null, startDate: flight.startDate, endDate: flight.endDate, budget: Number.isFinite(flight.budget) ? flight.budget : null })).sort((a, b) => a.startDate.localeCompare(b.startDate))
    };
  }).sort((a, b) => Number(b.hasIo) - Number(a.hasIo) || a.name.localeCompare(b.name));
}
