import { normalizeCampaignKey } from "./line-item-import.js";

const baseOrder = order => String(order ?? "").replace(/-(R|Rev)\d+$/i, "").toLowerCase();

/**
 * Finds the campaign an uploaded IO most likely revises: first by order number (ignoring the revision), then by a
 * campaign-name match. Returns the group key and whether it looks like a revision of an order already applied.
 */
export function findCampaignForIo(groups, totals, io) {
  const order = baseOrder([io.orderNumber].filter(Boolean).join(""));
  if (order) {
    for (const group of groups) {
      const applied = [totals[group.key]?.order, ...group.records.map(record => record.ioOrder)].filter(Boolean);
      const match = applied.find(value => baseOrder(value) === order);
      if (match) return { key: group.key, reason: "order", appliedOrder: match, isRevision: String(match).toLowerCase() !== [io.orderNumber, io.revision].filter(Boolean).join("-").toLowerCase() };
    }
  }
  const wanted = normalizeCampaignKey(io.campaign);
  if (wanted) {
    const named = groups.filter(group => {
      const name = normalizeCampaignKey(group.name);
      return name && (name === wanted || (name.length > 8 && (wanted.includes(name) || name.includes(wanted))));
    });
    if (named.length === 1) return { key: named[0].key, reason: "name", appliedOrder: null, isRevision: false };
  }
  return null;
}
