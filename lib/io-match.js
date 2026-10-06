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
  // Report lines are often grouped under a short name ("OLA", "Hyperlocal") that appears inside the order's campaign name.
  const orderTokens = new Set(normalizeCampaignKey([io.campaign, io.product].filter(Boolean).join(" ")).split(" ").filter(Boolean));
  const scored = groups.map(group => ({ group, tokens: normalizeCampaignKey(group.name).split(" ").filter(Boolean) }))
    .filter(({ tokens }) => tokens.length && tokens.join("").length >= 3 && tokens.every(token => orderTokens.has(token)));
  if (scored.length) {
    const best = Math.max(...scored.map(item => item.tokens.length));
    const top = scored.filter(item => item.tokens.length === best);
    if (top.length === 1) return { key: top[0].group.key, reason: "name", appliedOrder: null, isRevision: false };
  }
  return null;
}
