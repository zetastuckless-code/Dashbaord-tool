import { groupKey } from "./campaign-groups.js";

export const CAMPAIGN_STATUS_KEY = "northstar-campaign-status";
export const CAMPAIGN_ORDER_KEY = "northstar-campaign-order";
// "canceled" is a campaign the client ended early: it counts as completed everywhere, with its own label.
export const MANUAL_STATUSES = Object.freeze(["paused", "completed", "canceled"]);

const readJson = (storage, key, fallback, valid) => {
  try {
    const value = JSON.parse(storage.getItem(key));
    return valid(value) ? value : fallback;
  } catch {
    return fallback;
  }
};

/** Campaigns marked paused, completed, or canceled by hand, by campaign key. */
export const readCampaignStatus = storage => readJson(storage, CAMPAIGN_STATUS_KEY, {}, value => value && typeof value === "object" && !Array.isArray(value));
export const readCampaignOrder = storage => readJson(storage, CAMPAIGN_ORDER_KEY, [], Array.isArray);

/** Marks a campaign paused, completed, or canceled, or (any other status) hands it back to its dates. */
export function setCampaignStatus(statusMap, key, status) {
  const next = { ...statusMap };
  if (MANUAL_STATUSES.includes(status)) next[key] = status;
  else delete next[key];
  return next;
}

/**
 * Copies each campaign's hand-set status onto its lines (manualStatus), so every view that reads a line's status
 * agrees: lines that join the campaign later pick it up too. Returns the same array when nothing changes.
 */
export function applyCampaignStatus(campaigns, statusMap = {}) {
  let changed = false;
  const next = campaigns.map(record => {
    const status = MANUAL_STATUSES.includes(statusMap[groupKey(record)]) ? statusMap[groupKey(record)] : undefined;
    if ((record.manualStatus || undefined) === status) return record;
    changed = true;
    const { manualStatus: _previous, ...rest } = record;
    return status ? { ...rest, manualStatus: status } : rest;
  });
  return changed ? next : campaigns;
}

/**
 * Puts campaigns in the order you set (when the list uses portfolio order), with completed campaigns always last.
 * Campaigns you have not placed keep their current order after the ones you have.
 */
export function orderGroups(groups, order = [], { manual = true } = {}) {
  const position = new Map(order.map((key, index) => [key, index]));
  return groups
    .map((group, index) => ({ group, index }))
    .sort((a, b) => {
      const doneA = a.group.status === "completed" ? 1 : 0;
      const doneB = b.group.status === "completed" ? 1 : 0;
      if (doneA !== doneB) return doneA - doneB;
      if (manual) {
        const placedA = position.has(a.group.key) ? position.get(a.group.key) : Infinity;
        const placedB = position.has(b.group.key) ? position.get(b.group.key) : Infinity;
        if (placedA !== placedB) return placedA - placedB;
      }
      return a.index - b.index;
    })
    .map(item => item.group);
}

/**
 * Moves a campaign up, down, to the top, or to the bottom of the campaigns shown, and returns the saved order.
 * Only the shown campaigns change places; the rest keep their saved positions.
 */
export function moveCampaign(order, shownKeys, key, where) {
  const index = shownKeys.indexOf(key);
  if (index < 0) return order;
  const shown = [...shownKeys];
  shown.splice(index, 1);
  const target = where === "up" ? Math.max(0, index - 1) : where === "down" ? Math.min(shown.length, index + 1) : where === "top" ? 0 : shown.length;
  shown.splice(target, 0, key);
  // The shown campaigns take the saved slots they already used (new ones are added at the end), in their new order.
  const full = [...order, ...shownKeys.filter(item => !order.includes(item))];
  const slots = full.map((item, slot) => (shownKeys.includes(item) ? slot : -1)).filter(slot => slot >= 0);
  const result = [...full];
  slots.forEach((slot, position) => { result[slot] = shown[position]; });
  return result;
}
