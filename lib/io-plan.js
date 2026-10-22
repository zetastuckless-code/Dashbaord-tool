import { groupKey } from "./campaign-groups.js";

const SEPARATOR = " — ";
// Words that say nothing about which line it is. Channel words (display, video, youtube, audio) are kept: they are
// often all a report calls a line ("Display", "YouTube (Video Views)").
const STOP_WORDS = new Set(["standard", "dma", "package", "cross", "screen", "cpm", "the", "and", "of", "an", "for", "to", "in", "on", "line", "item", "campaign", "placement", "added", "value", "programmatic", "zeta", "global", "q1", "q2", "q3", "q4"]);
// Report shorthand that names a format another way: OLV is online (pre-roll) video.
const SYNONYMS = { olv: ["video"], preroll: ["video"] };
const tokens = text => String(text ?? "").toLowerCase().replace(/pre-roll/g, "preroll").replace(/[^a-z0-9]+/g, " ").split(" ").filter(token => token.length > 1 && !STOP_WORDS.has(token) && !/^\d{4}$/.test(token)).flatMap(token => [token, ...(SYNONYMS[token] || [])]);
const normalizeName = name => String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const within = (value, start, end) => Boolean(value && start && end && value >= start && value <= end);
const nearlyEqual = (a, b) => Number.isFinite(a) && Number.isFinite(b) && b > 0 && Math.abs(a - b) <= 1;

/** Every paid placement of a campaign's orders, earliest first. A placement ID appears once per order. */
export function ioPlacements(entry) {
  const seen = new Set();
  const placements = [];
  for (const order of entry?.orders || []) {
    for (const placement of order.placements || []) {
      const identity = `${order.order}|${placement.id}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      placements.push({ ...placement, order: order.order });
    }
  }
  return placements.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate) || String(a.id).localeCompare(String(b.id)));
}

/**
 * The campaign's IO lines: placements with the same name are one line (an extension or a later monthly flight of the
 * same package), with their budgets added and their dates spanning first start to last end.
 */
export function ioLines(entry) {
  const lines = new Map();
  for (const placement of ioPlacements(entry)) {
    const key = normalizeName(placement.name) || String(placement.id).toLowerCase();
    if (!lines.has(key)) lines.set(key, { key, name: placement.name || placement.id, budget: 0, startDate: placement.startDate, endDate: placement.endDate, placements: [] });
    const line = lines.get(key);
    line.budget = Math.round((line.budget + (Number(placement.budget) || 0)) * 100) / 100;
    if (placement.startDate < line.startDate) line.startDate = placement.startDate;
    if (placement.endDate > line.endDate) line.endDate = placement.endDate;
    line.placements.push(placement);
  }
  return [...lines.values()].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
}

/** The part of a record's name after the campaign ("Chicago" in "McMaster Display Q3 — Chicago"). */
export function recordLineLabel(record) {
  const name = String(record.name ?? "");
  return name.includes(SEPARATOR) ? name.slice(name.indexOf(SEPARATOR) + SEPARATOR.length).trim() : record.channel || name;
}

/**
 * Pairs each report line of a campaign with an IO line, in order of confidence:
 * 1. the IO placement ID appears in the report line's name or ID;
 * 2. a report line named "Flight N" is the N-th IO placement by start date;
 * 3. the IO line's distinctive words ("Chicago", "AA") appear in the report line, with one best match;
 * 4. the report line's budget equals one IO line's or placement's budget;
 * 5. when one IO line and one report line are left over and the report line started delivering inside that IO line's
 *    dates, they are paired (without delivery dates there is no evidence, so it stays unplanned).
 * A report line whose delivery falls entirely outside the IO flight is "outside"; any other unpaired line is "unplanned".
 * Returns Map(record → { line, status }).
 */
export function matchRecordsToIoLines(records, entry) {
  const lines = ioLines(entry);
  const placements = lines.flatMap(line => line.placements).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate) || String(a.id).localeCompare(String(b.id)));
  const lineOf = placement => lines.find(line => line.placements.includes(placement));
  const result = new Map();
  const outside = record => (record.deliveryEnd && entry?.startDate && record.deliveryEnd < entry.startDate) || (record.deliveryStart && entry?.endDate && record.deliveryStart > entry.endDate);
  const pending = [];
  for (const record of records) {
    if (outside(record)) { result.set(record, { line: null, status: "outside" }); continue; }
    const label = recordLineLabel(record);
    const haystack = [record.name, record.campaignId, ...(record.aliases || [])].map(value => String(value ?? "").toLowerCase()).join(" ");
    const byId = placements.find(placement => String(placement.id).length >= 5 && /[a-z]/i.test(placement.id) && haystack.includes(String(placement.id).toLowerCase()));
    if (byId) { result.set(record, { line: lineOf(byId), status: "matched" }); continue; }
    const flight = /\bflight\s*(\d+)\b/i.exec(label);
    if (flight && placements[Number(flight[1]) - 1]) { result.set(record, { line: lineOf(placements[Number(flight[1]) - 1]), status: "matched" }); continue; }
    // The IO line sharing the most words wins; on a tie, the line with fewer other words is the closer one
    // ("YouTube" is the general YouTube line, not the Trueview Video Views line that also mentions YouTube).
    const words = new Set(tokens([label, record.channel, ...(record.aliases || [])].join(" ")));
    const scored = lines.map(line => { const lineWords = new Set(tokens(line.name)); const hits = [...lineWords].filter(word => words.has(word)).length; return { line, hits, share: lineWords.size ? hits / lineWords.size : 0 }; }).filter(item => item.hits > 0);
    const most = Math.max(0, ...scored.map(item => item.hits));
    const tied = scored.filter(item => item.hits === most);
    const closest = Math.max(0, ...tied.map(item => item.share));
    const top = tied.filter(item => item.share === closest);
    if (top.length === 1) { result.set(record, { line: top[0].line, status: "matched" }); continue; }
    const budget = Number(record.budget);
    const byBudget = [...lines.filter(line => nearlyEqual(budget, line.budget)), ...placements.filter(placement => nearlyEqual(budget, Number(placement.budget))).map(lineOf)];
    const uniqueBudget = [...new Set(byBudget)];
    if (uniqueBudget.length === 1) { result.set(record, { line: uniqueBudget[0], status: "matched" }); continue; }
    pending.push(record);
  }
  const used = new Set([...result.values()].map(value => value.line).filter(Boolean));
  const freeLines = lines.filter(line => !used.has(line));
  if (lines.length === 1 && pending.length) pending.forEach(record => result.set(record, { line: lines[0], status: "matched" }));
  else if (freeLines.length === 1 && pending.length === 1 && within(pending[0].deliveryStart, freeLines[0].startDate, freeLines[0].endDate)) result.set(pending[0], { line: freeLines[0], status: "matched" });
  for (const record of records) if (!result.has(record)) result.set(record, { line: null, status: "unplanned" });
  return result;
}

/**
 * Makes the insertion order the source of a campaign's dates: every line of a campaign with an IO takes the dates of
 * the IO line it matches (or the IO flight when it matches none), so status, filters, alerts, and pacing all agree
 * with the IO. Each record also keeps which IO line it belongs to. Campaigns without an IO are left as they are.
 */
export function applyIoPlan(campaigns, totals = {}) {
  const groups = new Map();
  campaigns.forEach(record => { const key = groupKey(record); if (totals[key]) groups.set(key, [...(groups.get(key) || []), record]); });
  const updates = new Map();
  for (const [key, records] of groups) {
    const entry = totals[key];
    const matches = matchRecordsToIoLines(records, entry);
    for (const record of records) {
      const { line, status } = matches.get(record);
      // A line delivered entirely outside the IO flight belongs to another flight, so it keeps its own dates.
      const keep = status === "outside";
      const startDate = keep ? record.startDate : line?.startDate || entry.startDate || record.startDate;
      const endDate = keep ? record.endDate : line?.endDate || entry.endDate || record.endDate;
      const next = { ...record, startDate, endDate, ioLine: line?.key || null, ioLineName: line?.name || null, ioLineStatus: status };
      if (next.startDate !== record.startDate || next.endDate !== record.endDate || next.ioLine !== record.ioLine || next.ioLineStatus !== record.ioLineStatus || next.ioLineName !== record.ioLineName) updates.set(record, next);
    }
  }
  return updates.size ? campaigns.map(record => updates.get(record) || record) : campaigns;
}
