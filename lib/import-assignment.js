import { isPlaceholder, groupKey } from "./campaign-groups.js";

export const ASSIGNMENTS_KEY = "northstar-import-assignments";
const MAX_REMEMBERED = 500;
export const KEEP = "";
export const SKIP = "__skip";
const SEPARATOR = " — ";

export const assignmentKey = row => `${String(row.client ?? "").trim().toLowerCase()}::${String(row.campaignId || row.name || "").trim().toLowerCase()}`;

export function lineLabel(row) {
  const name = String(row.name ?? "");
  return name.includes(SEPARATOR) ? name.slice(name.indexOf(SEPARATOR) + SEPARATOR.length).trim() : String(row.channel || name).trim();
}

export function readAssignments(storage) {
  try {
    const value = JSON.parse(storage.getItem(ASSIGNMENTS_KEY));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

/** Remembers each row's choice (keep clears it) so the next report for the same source lands in the same campaign. */
export function rememberAssignments(storage, rows, choices) {
  const stored = readAssignments(storage);
  for (const row of rows) {
    const key = assignmentKey(row);
    const choice = choices[key];
    if (!choice) delete stored[key];
    else stored[key] = choice;
  }
  const bounded = Object.fromEntries(Object.entries(stored).slice(-MAX_REMEMBERED));
  storage.setItem(ASSIGNMENTS_KEY, JSON.stringify(bounded));
  return bounded;
}

/** Remembered choices that still point at an existing campaign (or skip), for pre-selecting the dropdowns. */
export function initialChoices(rows, remembered, groups) {
  const valid = new Set(groups.map(group => group.key));
  return Object.fromEntries(rows.map(row => [assignmentKey(row), remembered[assignmentKey(row)]]).filter(([, choice]) => choice === SKIP || valid.has(choice)));
}

/**
 * A report line joining a campaign that was created first takes that campaign's confirmed setup where the report is silent.
 * When the campaign has one line, a budget typed in (or taken from an order) is kept rather than replaced by the report's.
 */
export function inheritShellSetup(row, shell, { single = false } = {}) {
  if (!shell) return row;
  const unsetTarget = !row.target || /not provided/i.test(row.target);
  const keepsBudget = single && Number(shell.budget) > 0 && ["manual", "io"].includes(shell.budgetSource);
  return {
    ...row,
    ...(keepsBudget ? { budget: shell.budget, budgetSource: shell.budgetSource, ioFileName: shell.ioFileName || row.ioFileName || null } : {}),
    owner: row.owner || shell.owner || null,
    channel: row.channel || shell.channel || null,
    startDate: row.startDate || shell.startDate || null,
    endDate: row.endDate || shell.endDate || null,
    billingSource: shell.billingSource || row.billingSource,
    reportCadence: shell.reportCadence ?? row.reportCadence,
    target: unsetTarget && shell.target && (!shell.kpi || shell.kpi === row.kpi) ? shell.target : row.target
  };
}

/** Once real lines have joined a campaign, its empty setup shell has done its job and is removed. */
export function removeFilledShells(campaigns, importedRows) {
  const receiving = new Set(importedRows.map(groupKey));
  return campaigns.filter(campaign => !(isPlaceholder(campaign) && receiving.has(groupKey(campaign))));
}

/**
 * Applies the per-row choices: keep as imported, skip, or move into an existing campaign (client, campaign group,
 * and a "Campaign — Line" name), so the rows merge with that campaign's current lines instead of standing alone.
 */
export function applyAssignments(rows, choices, groups) {
  const byKey = new Map(groups.map(group => [group.key, group]));
  const used = new Map();
  let skipped = 0;
  const campaigns = [];
  for (const row of rows) {
    const choice = choices[assignmentKey(row)];
    if (choice === SKIP) { skipped += 1; continue; }
    const group = choice ? byKey.get(choice) : null;
    if (!group) { campaigns.push(row); continue; }
    let name = `${group.name}${SEPARATOR}${lineLabel(row)}`;
    const count = (used.get(name) || 0) + 1;
    used.set(name, count);
    if (count > 1) name = `${name} (${count})`;
    const joining = rows.filter(other => choices[assignmentKey(other)] === choice).length;
    const assigned = inheritShellSetup(row, group.records?.find(isPlaceholder), { single: joining === 1 });
    campaigns.push({ ...assigned, client: group.client, campaignGroup: group.name, name, short: group.short || row.short, className: group.className || row.className });
  }
  return { campaigns, skipped };
}

const SUGGEST_STOP = new Set(["zeta", "global", "agency", "report", "reporting", "display", "campaign", "the", "and", "llc", "inc", "co", "of", "a"]);
const words = text => new Set(String(text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter(word => word && !SUGGEST_STOP.has(word)));
const overlap = (left, right) => [...left].filter(word => right.has(word)).length;
const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && b > 0 && Math.abs(a - b) <= 1;

/**
 * For report campaigns that match no dashboard campaign by name, suggests the campaign they most likely belong to:
 * one from the same client (shared client words) whose name shares the most distinctive words. A campaign with an
 * insertion order must also fit: the report's delivery dates fall inside the IO flight, and when the report carries
 * line budgets, at least one agrees with the IO. A client with a single fitting IO campaign takes the report even
 * without shared words. Returns { [assignmentKey]: groupKey } for the rows of each suggested campaign.
 */
export function suggestCampaigns(rows, groups, totals = {}) {
  const byReportGroup = new Map();
  rows.forEach(row => { const key = groupKey(row); byReportGroup.set(key, [...(byReportGroup.get(key) || []), row]); });
  const existing = new Set(groups.map(group => group.key));
  const suggestions = {};
  for (const [key, members] of byReportGroup) {
    if (existing.has(key)) continue;
    const clientWords = words(members[0].client);
    const reportName = String(members[0].campaignGroup || members[0].name || "").split(" — ")[0];
    const nameWords = new Set([...words(reportName)].filter(word => !clientWords.has(word)));
    const starts = members.map(row => row.deliveryStart).filter(Boolean).sort();
    const ends = members.map(row => row.deliveryEnd || row.dataAsOf).filter(Boolean).sort();
    const budgets = members.map(row => Number(row.budget)).filter(value => value > 0);
    const fits = group => {
      const entry = totals[group.key];
      if (!entry) return true;
      if (starts.length && entry.endDate && starts[0] > entry.endDate) return false;
      if (ends.length && entry.startDate && ends.at(-1) < entry.startDate) return false;
      if (!budgets.length) return true;
      const planned = [entry.budget, ...(entry.orders || []).flatMap(order => [order.budget, ...(order.placements || []).map(placement => placement.budget)])];
      return budgets.some(budget => planned.some(value => close(budget, Number(value))));
    };
    const candidates = groups.filter(group => overlap(words(group.client), clientWords) > 0 && fits(group));
    const scored = candidates.map(group => ({ group, score: overlap(new Set([...words(group.name)].filter(word => !words(group.client).has(word))), nameWords) }));
    const best = Math.max(0, ...scored.map(item => item.score));
    const top = scored.filter(item => item.score === best);
    const withIo = candidates.filter(group => totals[group.key]);
    const pick = best > 0 && top.length === 1 ? top[0].group : withIo.length === 1 && candidates.length === withIo.length ? withIo[0] : null;
    if (pick) members.forEach(row => { suggestions[assignmentKey(row)] = pick.key; });
  }
  return suggestions;
}
