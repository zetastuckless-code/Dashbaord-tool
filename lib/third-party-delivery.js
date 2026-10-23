// Ad-server (CM360 / DCM) delivery stored beside a line's own report numbers. It never replaces the report's spend or
// pacing: it is compared to it over the same dates, and its conversions and revenue give a DCM CPA and ROAS.
import { campaignGroupName, groupKey } from "./campaign-groups.js";

export const THIRD_PARTY_LINKS_KEY = "northstar-third-party-links";
const DAY_MS = 86_400_000;
const METRICS = ["impressions", "clicks", "spend", "conversions", "revenue", "videoStarts", "videoCompletions"];
export const DELIVERY_SOURCES = ["DSP", "CM360"];
export const SOURCE_LABEL = { CM360: "DCM (CM360)", DSP: "DSP" };
/** The source that fills a line in after its latest report: the DSP (the spend itself, for 1P clients), else DCM. */
export const topUpSource = record => DELIVERY_SOURCES.find(source => Object.keys(record.thirdPartyDelivery?.[source] || {}).length) || null;
// Words every placement in an account shares, which say nothing about which line it belongs to.
const NOISE = new Set(["zeta", "global", "campaign", "the", "and", "of", "x", "s", "d", "programmatic", "general"]);
const SYNONYMS = { yt: "youtube", olv: "video", preroll: "video", ctv: "ctv", ott: "ctv", videoviews: "views", view: "views" };

const tokens = text => String(text ?? "").toLowerCase().replace(/\d+x\d+/g, " ").split(/[^a-z0-9]+/)
  .map(token => SYNONYMS[token] || token).filter(token => token && !/^\d+s?$/.test(token) && !NOISE.has(token));
const lowered = value => String(value ?? "").trim().toLowerCase();
const lineLabelOf = record => String(record.name || "").includes(" — ") ? String(record.name).split(" — ").slice(1).join(" — ") : String(record.name || "");

/**
 * Picks the line each placement belongs to. A line matches when every word of its label appears in the placement name;
 * the line with the most matching words wins, so "YouTube (Video Views)" beats "YouTube" for a Video Views placement.
 * Ties and placements no line fully matches are left unassigned.
 */
export function assignPlacements(lines, placementNames) {
  const lineTokens = lines.map(line => [...new Set(tokens(lineLabelOf(line)))]);
  const assigned = new Map();
  const unassigned = [];
  for (const placement of placementNames) {
    const have = new Set(tokens(placement));
    const scores = lineTokens.map(words => words.length && words.every(word => have.has(word)) ? words.length : 0);
    const best = Math.max(0, ...scores);
    const winners = scores.flatMap((score, index) => score === best && best > 0 ? [index] : []);
    if (winners.length === 1) assigned.set(placement, winners[0]); else unassigned.push(placement);
  }
  return { assigned, unassigned };
}

/** The dashboard campaign (group key) a source campaign belongs to: a saved link, an ID seen before, then the name. */
export function matchDeliveryCampaign(campaigns, entry, source, links = {}) {
  const keys = [entry.sourceCampaignId, entry.sourceCampaignName].map(lowered).filter(Boolean);
  for (const key of keys) if (links[`${source}::${key}`]) return links[`${source}::${key}`];
  const seen = campaigns.find(record => (record.sourceIds?.[source] || []).some(id => keys.includes(lowered(id))));
  if (seen) return groupKey(seen);
  const name = lowered(entry.sourceCampaignName);
  const groups = [...new Set(campaigns.filter(record => lowered(campaignGroupName(record)) === name).map(groupKey))];
  return groups.length === 1 ? groups[0] : null;
}

/**
 * Works out where each source campaign in a parsed delivery file goes, without changing anything. `targets` maps a
 * source campaign key to a group key chosen by hand (it wins over matching).
 */
export function planDelivery(campaigns, parsed, links = {}, targets = {}) {
  return parsed.campaigns.map(entry => {
    const target = targets[entry.key] ?? matchDeliveryCampaign(campaigns, entry, parsed.source, links);
    const lines = target ? campaigns.filter(record => groupKey(record) === target) : [];
    const rows = (parsed.placements?.length ? parsed.placements : parsed.records).filter(record => lowered(record.sourceCampaignId || record.sourceCampaignName) === entry.key);
    const names = [...new Set(rows.map(row => row.placement || entry.sourceCampaignName))];
    // A campaign with one line takes every placement; otherwise placements are matched to lines by name.
    const { assigned, unassigned } = lines.length === 1 ? { assigned: new Map(names.map(name => [name, 0])), unassigned: [] } : assignPlacements(lines, names);
    return { entry, target, lines: lines.map(line => line.name), assigned, unassigned, rows };
  });
}

/** Stores each line's days (replacing days already stored, so overlapping month-to-date files never double count). */
export function applyDelivery(campaigns, parsed, plan, { fileName = "" } = {}) {
  const next = campaigns.map(record => ({ ...record }));
  const source = parsed.source;
  let lineCount = 0;
  for (const item of plan) {
    if (!item.target) continue;
    const lines = next.filter(record => groupKey(record) === item.target);
    lines.forEach((line, index) => {
      const mine = item.rows.filter(row => item.assigned.get(row.placement || item.entry.sourceCampaignName) === index);
      if (!mine.length) return;
      const byDate = {};
      for (const row of mine) {
        const day = byDate[row.date] || Object.fromEntries(METRICS.map(metric => [metric, null]));
        for (const metric of METRICS) if (Number.isFinite(row[metric])) day[metric] = (day[metric] ?? 0) + row[metric];
        byDate[row.date] = day;
      }
      const delivery = { ...(line.thirdPartyDelivery || {}) };
      delivery[source] = Object.fromEntries(Object.entries({ ...(delivery[source] || {}), ...byDate }).sort(([a], [b]) => a.localeCompare(b)).slice(-400));
      line.thirdPartyDelivery = delivery;
      line.sourceIds = { ...(line.sourceIds || {}), [source]: [...new Set([...(line.sourceIds?.[source] || []), lowered(item.entry.sourceCampaignId), lowered(item.entry.sourceCampaignName)].filter(Boolean))] };
      line.thirdPartyAsOf = Object.keys(delivery[source]).at(-1);
      if (fileName) line.thirdPartyFiles = [...new Set([fileName, ...(line.thirdPartyFiles || [])])].slice(0, 30);
      lineCount += 1;
    });
  }
  return { campaigns: next, lineCount };
}

const addDays = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * Compares a line's ad-server numbers with its own report over the same dates. The window runs between two of the
 * report's dated totals (or from the flight start) so both sides cover exactly the same days, and every day in it must
 * be in the ad-server data. Returns null when no such window exists yet.
 */
export function deliveryComparison(record, source = "CM360") {
  const days = record.thirdPartyDelivery?.[source];
  if (!days || !Object.keys(days).length) return null;
  const snapshots = (record.performanceSnapshots || []).filter(snapshot => !snapshot.dcm && String(snapshot.source).toLowerCase() !== source.toLowerCase()).sort((a, b) => a.date.localeCompare(b.date));
  const dates = Object.keys(days).sort();
  const first = dates[0];
  const last = dates.at(-1);
  const end = [...snapshots].reverse().find(snapshot => snapshot.date <= last && snapshot.date >= first);
  if (!end) return null;
  const zero = Object.fromEntries(METRICS.map(metric => [metric, 0]));
  let start = [...snapshots].find(snapshot => snapshot.date >= addDays(first, -1) && snapshot.date < end.date);
  if (!start && record.startDate && record.startDate >= first && record.startDate <= end.date) start = { date: addDays(record.startDate, -1), ...zero };
  if (!start) return null;
  const windowDays = [];
  for (let day = addDays(start.date, 1); day <= end.date; day = addDays(day, 1)) windowDays.push(day);
  if (windowDays.some(day => !days[day])) return null;
  const adServer = Object.fromEntries(METRICS.map(metric => [metric, windowDays.reduce((sum, day) => sum + (Number.isFinite(days[day][metric]) ? days[day][metric] : 0), 0)]));
  const report = Object.fromEntries(METRICS.map(metric => [metric, Number.isFinite(end[metric]) && Number.isFinite(start[metric]) ? end[metric] - start[metric] : null]));
  const gap = metric => Number.isFinite(report[metric]) && adServer[metric] > 0 ? (report[metric] - adServer[metric]) / adServer[metric] * 100 : null;
  const spend = report.spend;
  return {
    source, from: windowDays[0], to: windowDays.at(-1), days: windowDays.length, adServer, report,
    gaps: { impressions: gap("impressions"), clicks: gap("clicks"), spend: gap("spend") },
    // DCM's conversions and revenue against the spend the report shows for the same days.
    cpa: Number.isFinite(spend) && adServer.conversions > 0 ? spend / adServer.conversions : null,
    roas: Number.isFinite(spend) && spend > 0 ? adServer.revenue / spend : null
  };
}

/** The largest delivery gap worth flagging (impressions, or clicks once both sides have enough to compare). */
export function deliveryGap(comparison, { minimumImpressions = 1000, minimumClicks = 100 } = {}) {
  if (!comparison) return null;
  const candidates = [];
  if (comparison.adServer.impressions >= minimumImpressions && Number.isFinite(comparison.gaps.impressions)) candidates.push(["impressions", comparison.gaps.impressions]);
  if (comparison.adServer.clicks >= minimumClicks && Number.isFinite(comparison.gaps.clicks)) candidates.push(["clicks", comparison.gaps.clicks]);
  if (!candidates.length) return null;
  const [metric, value] = candidates.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  return { metric, value };
}

export function readThirdPartyLinks(storage) {
  try {
    const value = JSON.parse(storage.getItem(THIRD_PARTY_LINKS_KEY));
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function rememberThirdPartyLinks(storage, links, plan, source) {
  const next = { ...links };
  for (const item of plan) if (item.target) for (const key of [item.entry.sourceCampaignId, item.entry.sourceCampaignName].map(lowered).filter(Boolean)) next[`${source}::${key}`] = item.target;
  try { storage.setItem(THIRD_PARTY_LINKS_KEY, JSON.stringify(next)); } catch { /* links are re-learned on the next import */ }
  return next;
}

// --- Top-up: DCM days after a line's latest report count toward its spend, delivery, and data-through date ---
const TOPPED = ["spend", "firstPartySpend", "impressions", "clicks", "conversions", "revenue", "videoStarts", "videoCompletions"];
const COUNTS = ["impressions", "clicks", "conversions", "revenue", "videoStarts", "videoCompletions"];
const signature = record => JSON.stringify([record.dataAsOf, ...TOPPED.map(field => record[field] ?? null)]);
const round2 = value => Math.round(value * 100) / 100;

/**
 * Adds DCM days newer than a line's latest report on top of that report, so the line stays current between reports.
 * The report's own numbers are kept in `reportBase`; a newer report replaces them and the top-up starts again from it.
 * Where DCM and the report overlap, DCM cost is scaled to the report's spend for those days, since DCM prices with its
 * own rates. Counts (impressions, clicks, conversions, revenue) are added as DCM reports them.
 */
export function applyDcmTopUp(record, source = topUpSource(record)) {
  const days = source ? record.thirdPartyDelivery?.[source] : null;
  const toppedUp = record.dcmTopUp && signature(record) === record.dcmTopUp.signature;
  const base = toppedUp ? record.reportBase : { dataAsOf: record.dataAsOf, ...Object.fromEntries(TOPPED.map(field => [field, record[field] ?? null])) };
  const snapshots = (record.performanceSnapshots || []).filter(snapshot => !snapshot.dcm);
  const restored = { ...record, ...base, performanceSnapshots: snapshots };
  delete restored.dcmTopUp;
  delete restored.reportBase;
  if (!days || !base.dataAsOf || !Number.isFinite(Number(base.spend))) return restored;
  const newer = Object.keys(days).filter(day => day > base.dataAsOf && (!record.endDate || day <= record.endDate)).sort();
  if (!newer.length) return restored;
  const comparison = deliveryComparison(restored, source);
  const factor = comparison && comparison.adServer.spend > 0 && comparison.report.spend > 0 ? Math.min(4, Math.max(0.25, comparison.report.spend / comparison.adServer.spend)) : 1;
  const added = Object.fromEntries(["spend", ...COUNTS].map(field => [field, 0]));
  const next = { ...restored, reportBase: base };
  const running = Object.fromEntries(["spend", ...COUNTS].map(field => [field, Number.isFinite(base[field]) ? base[field] : null]));
  const daySnapshots = [];
  for (const day of newer) {
    const metrics = days[day];
    for (const field of Object.keys(added)) {
      const value = Number.isFinite(metrics[field]) ? metrics[field] * (field === "spend" ? factor : 1) : 0;
      added[field] += value;
      if (running[field] !== null) running[field] += value;
    }
    daySnapshots.push({ date: day, source: record.source || "Unknown", dcm: true, spend: round2(running.spend), ...Object.fromEntries(COUNTS.map(field => [field, running[field]])) });
  }
  next.spend = round2(Number(base.spend) + added.spend);
  if (Number.isFinite(base.firstPartySpend)) next.firstPartySpend = round2(base.firstPartySpend + added.spend);
  for (const field of COUNTS) if (Number.isFinite(base[field])) next[field] = base[field] + added[field];
  next.dataAsOf = newer.at(-1);
  next.performanceSnapshots = [...snapshots, ...daySnapshots].sort((a, b) => a.date.localeCompare(b.date));
  next.dcmTopUp = { source, from: newer[0], to: newer.at(-1), days: newer.length, reportAsOf: base.dataAsOf, factor: Math.round(factor * 1000) / 1000, added: { ...added, spend: round2(added.spend) } };
  next.dcmTopUp.signature = signature(next);
  return next;
}

export const applyDcmTopUps = campaigns => campaigns.map(record => record.thirdPartyDelivery || record.dcmTopUp ? applyDcmTopUp(record) : record);

/** A file's own rows, each tagged with the dashboard line its placement or line item was matched to. */
export function rawRowsForPlan(parsed, plan) {
  const rows = [];
  for (const item of plan) {
    if (!item.target) continue;
    for (const row of parsed.rawRows || []) {
      if (lowered(row.sourceCampaignId || row.sourceCampaignName) !== item.entry.key) continue;
      const index = item.assigned.get(row.placement || item.entry.sourceCampaignName);
      if (index === undefined) continue;
      rows.push({ date: row.date, campaign: row.sourceCampaignName, campaignId: row.sourceCampaignId, placement: row.placement, creative: row.creative, impressions: row.impressions, clicks: row.clicks, spend: row.spend, videoStarts: row.videoStarts, videoCompletions: row.videoCompletions, conversions: row.conversions, revenue: row.revenue, line: item.lines[index] });
    }
  }
  return rows;
}
