import { parseDeliveryDate } from "./daily-delivery-import.js";

const DATE = String.raw`(\d{1,2}/\d{1,2}/\d{2,4})`;
const RATE_TYPE = String.raw`(dCPM|CPM|dCPV|CPV|CPCV|dCPC|CPC|CPA|CPL|FLAT|FIXED)`;
const UNIT = String.raw`(Video\s*Impressions|Impressions|Clicks|Views|Completes|Leads|Conversions)`;
const MONEY = String.raw`\$([\d,]+(?:\.\d+)?)`;
// The KPI cell can be a single metric ("CTR") or a goal and metric ("Awareness/CTR").
// A goal with its own price ("Clicks $0.55 CPC") also counts.
const KPI = String.raw`(?:\s+([A-Za-z][A-Za-z/&]{1,24}(?:\s+\$?[\d.,]+)?(?:\s+[A-Za-z]{2,6})?))?`;
// A dynamic rate can be quoted as a range ("$1.75 - $11.00"); the low end is kept.
const RATE = String.raw`\$([\d,]+(?:\.\d+)?)(?:\s*-\s*\$[\d,]+(?:\.\d+)?)?`;
const KPI_NAMES = ["CTR", "CPA", "VCR", "ROAS", "CPC", "CPM", "CPCV", "CPV", "CPL"];
function kpiName(text) {
  if (!text) return null;
  const parts = text.toUpperCase().split(/[\s/&]+/).map(part => part.trim()).filter(part => /^[A-Z]+$/.test(part));
  return parts.find(part => KPI_NAMES.includes(part)) || (parts.length === 1 && parts[0].length <= 6 ? parts[0] : null);
}
const SIZE_TAIL = /\s+(?:\d{2,4}\s*x\s*\d{2,4}(?:\s*,\s*\d{2,4}\s*x\s*\d{2,4})*|\d+s(?: or \d+s)?)$/i;

const toNumber = value => Number(String(value).replace(/[$,]/g, ""));
const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const LONG_DATE = String.raw`((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4})`;
const LONG_RANGE = new RegExp(`${LONG_DATE}\\s*-\\s*${LONG_DATE}`, "i");

/** "July 27, 2026" → "2026-07-27". */
function longDate(text) {
  const match = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(String(text).trim());
  const month = match ? MONTHS.indexOf(match[1].toLowerCase()) : -1;
  return month < 0 ? null : parseDeliveryDate(`${match[3]}-${String(month + 1).padStart(2, "0")}-${match[2].padStart(2, "0")}`);
}

function dateRange(text) {
  const match = new RegExp(`${DATE}\\s*-\\s*${DATE}`).exec(text);
  if (match) return { startDate: parseDeliveryDate(match[1]), endDate: parseDeliveryDate(match[2]) };
  const long = LONG_RANGE.exec(text);
  return long ? { startDate: longDate(long[1]), endDate: longDate(long[2]) } : { startDate: null, endDate: null };
}

/**
 * Zeta IOs laid out as packages: a heading row with written-out flight dates and the package name ("AA Package"),
 * then the package's paid row ending in pricing model, unit type, rate, units, and budget.
 */
function zetaPackageRows(lines) {
  const paid = new RegExp(`\\b${RATE_TYPE}\\s+${UNIT}\\s+${RATE}\\s+([\\d,]+)\\s+${MONEY}${KPI}$`, "i");
  const items = [];
  let current = null;
  for (const line of lines) {
    const heading = new RegExp(`^${LONG_DATE}\\s*-\\s*${LONG_DATE}\\s+(.+)$`, "i").exec(line);
    if (heading) {
      const label = heading[3].replace(/\s+-(\s+-)*\s*$/, "").trim();
      // A placement can sit on its own dated row with its pricing on the same line ("… Cross-Screen Standard Display CPM
      // Impressions $5.00 20,000,000 $100,000.00 Awareness/CTR"): that row is the line itself.
      const inline = paid.exec(label);
      if (inline && !/^added value\b/i.test(label)) {
        const [, rateType, unit, rate, units, budget, kpi] = inline;
        const placement = label.slice(0, inline.index).trim();
        current = { name: cleanName(placement), startDate: longDate(heading[1]), endDate: longDate(heading[2]), count: 1, addedValue: false };
        items.push({ name: current.name, placement, startDate: current.startDate, endDate: current.endDate, rateType: normalizeRateType(rateType), unit: unit.replace(/\s+/g, " "), rate: toNumber(rate), units: toNumber(units), budget: toNumber(budget), kpi: kpiName(kpi), status: "active" });
        continue;
      }
      const packageName = /^(.*?\bPackage)\b/i.exec(label)?.[1] || label;
      current = { name: packageName.trim(), startDate: longDate(heading[1]), endDate: longDate(heading[2]), count: 0, addedValue: /^added value\b/i.test(label) };
      if (current.addedValue) items.push({ name: label, placement: label, startDate: current.startDate, endDate: current.endDate, rateType: null, unit: null, rate: null, units: null, budget: 0, kpi: null, status: "active", addedValue: true });
      continue;
    }
    const match = paid.exec(line);
    if (!match || !current || current.addedValue) continue;
    const [, rateType, unit, rate, units, budget, kpi] = match;
    current.count += 1;
    const placement = line.slice(0, match.index).replace(/^-\s*/, "").trim();
    items.push({
      name: current.count === 1 ? current.name : `${current.name} ${current.count}`, placement,
      startDate: current.startDate, endDate: current.endDate, rateType: normalizeRateType(rateType), unit: unit.replace(/\s+/g, " "), rate: toNumber(rate), units: toNumber(units), budget: toNumber(budget), kpi: kpiName(kpi), status: "active",
      package: current, format: placementFormat(placement), goal: /^[A-Za-z]+/.exec(kpi || "")?.[0] || ""
    });
  }
  return nameFlightPackages(items).map(({ package: _package, format: _format, goal: _goal, ...item }) => item);
}

const FORMAT = /\b(Standard Display|Native Display|High Impact Display|Rich Media|Pre-?Roll Video|Online Video|Streaming Audio|Connected TV|CTV|OTT|Native|Display|Video|Audio)\b/i;
const placementFormat = placement => FORMAT.exec(String(placement).replace(/^cross[- ]screen\s+/i, ""))?.[1] || "";

/**
 * Packages that are only flight labels ("F1 Package", "F2 Package") hold the same tactics flight after flight. Each
 * line is named by flight and tactic ("F1 Standard Display Awareness") so it lines up with a report that splits the
 * campaign the same way. A flight label used twice for different dates is renumbered in order.
 */
function nameFlightPackages(items) {
  const paid = items.filter(item => item.package);
  const packages = [...new Set(paid.map(item => item.package))];
  const flightTag = pkg => /^(F|Flight\s*)(\d+)\s+Package$/i.exec(pkg.name);
  if (!packages.length || !packages.every(flightTag)) return items;
  const tags = packages.map(flightTag);
  const renumber = new Set(tags.map(tag => Number(tag[2]))).size !== tags.length;
  const tagOf = new Map(packages.map((pkg, index) => [pkg, `${tags[index][1].trim()}${renumber ? index + 1 : tags[index][2]}`]));
  return items.map(item => {
    if (!item.package || !item.format) return item;
    const sameFormat = paid.filter(other => other.package === item.package && other.format.toLowerCase() === item.format.toLowerCase());
    const goal = sameFormat.length > 1 && item.goal ? ` ${item.goal[0].toUpperCase()}${item.goal.slice(1).toLowerCase()}` : "";
    return { ...item, name: `${tagOf.get(item.package)} ${item.format}${goal}` };
  });
}

function cleanName(raw) {
  // Older IO layouts run the audience, device list, and placement type into the name cell.
  let name = String(raw).replace(/\s+/g, " ").trim().replace(/\s+Desktop\b.*$/i, "");
  const audience = /^(.*?)\s+(Primary|Secondary):\s*.*?(?:\s([A-Z]{2,5}))?$/.exec(name);
  if (audience) name = `${audience[1]}${audience[3] ? ` ${audience[3]}` : ""} · ${audience[2]}`;
  while (SIZE_TAIL.test(name)) name = name.replace(SIZE_TAIL, "");
  return name.replace(/^cross[- ]screen\s+/i, "").trim();
}

const normalizeRateType = value => value.replace(/^d/i, "d").replace(/^(d?)(.*)$/, (_, prefix, rest) => prefix + rest.toUpperCase());

function uniqueIds(lineItems) {
  const seen = new Map();
  const used = new Set(lineItems.map(item => item.id).filter(Boolean));
  return lineItems.map(item => {
    if (item.id) return item;
    const base = `io-${slug(item.name) || "line"}`;
    // Count on until the id is free: "F2 Package" seen twice must not take the id of a line named "F2 Package 2".
    let count = seen.get(base) || 0;
    let id;
    do { count += 1; id = count === 1 ? base : `${base}-${count}`; } while (used.has(id));
    seen.set(base, count);
    used.add(id);
    return { ...item, id };
  });
}

/** Zeta advertising insertion order: header fields plus one placement row per line, flight dates first. */
function parseZetaRio(lines) {
  const field = label => lines.map(line => new RegExp(`^${label}:\\s*(.+)$`, "i").exec(line)?.[1]?.trim()).find(Boolean) || "";
  const durations = dateRange(field("Duration"));
  const effective = dateRange(field("Insertion Order Effective Dates"));
  const budgetText = /^Budget:\s*\$([\d,]+(?:\.\d+)?)/im.exec(lines.join("\n"))?.[1];
  const rowPattern = new RegExp(`^${DATE}\\s*-\\s*${DATE}\\s+(.+?)\\s+${RATE_TYPE}\\s+${UNIT}\\s+${MONEY}\\s+([\\d,]+)\\s+${MONEY}${KPI}$`, "i");
  const lineItems = [];
  for (const line of lines) {
    const match = rowPattern.exec(line);
    if (!match) continue;
    const [, start, end, placement, rateType, unit, rate, units, budget, kpi] = match;
    lineItems.push({
      name: cleanName(placement), placement: placement.trim(), startDate: parseDeliveryDate(start), endDate: parseDeliveryDate(end),
      rateType: normalizeRateType(rateType), unit: unit.replace(/\s+/g, " "), rate: toNumber(rate), units: toNumber(units), budget: toNumber(budget), kpi: kpiName(kpi), status: "active"
    });
  }
  if (!lineItems.length) lineItems.push(...zetaPackageRows(lines));
  return {
    format: "zeta-rio", agency: field("Agency"), advertiser: field("Advertiser"), campaign: field("Campaign"), orderNumber: field("Insertion Order #") || null, revision: null,
    startDate: durations.startDate || effective.startDate, endDate: durations.endDate || effective.endDate, budget: budgetText ? toNumber(budgetText) : null, lineItems
  };
}

// Placement names often end with their flight dates ("..._2026-09-27_2026-10-24") and start with a channel prefix.
const tidyAgencyName = (value, id = "") => String(value).trim().replace(id ? new RegExp(`^${id}_`) : /^$/, "").replace(/_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/, "").replace(/^Cross[- ]Screen\s+/i, "").trim();

const titleCase = value => value === value.toUpperCase() ? value.toLowerCase().replace(/(^|\s)\S/g, letter => letter.toUpperCase()) : value;

/** Agency order (OX-style): placement ID, flight, rate, units, cost; the placement name sits on a following line. */
function parseAgencyOrder(lines) {
  const joined = lines.join("\n");
  const orderMatch = /Order #\s*(O-[A-Z0-9]+?)(?:-(R\d+))?(?=\s|$)/.exec(joined);
  const flight = dateRange(/Flight\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*-\s*\d{1,2}\/\d{1,2}\/\d{2,4}/.exec(joined)?.[0] || "");
  const campaign = lines.map(line => /(?:^|\s)Campaign\s+(?!ID\b)(.+)$/.exec(line)?.[1]?.trim()).find(Boolean) || "";
  const total = /Order total\s*\$([\d,]+(?:\.\d+)?)/.exec(joined)?.[1];
  const agencyIndex = lines.findIndex(line => /^FROM$/i.test(line));
  const rowPattern = new RegExp(`^(?:(NEW|REVISED|CANCELLED|UNCHANGED)\\s+)?(P[0-9A-Z]{4,8})\\s+.*?${DATE}\\s*-\\s*${DATE}\\s+${RATE_TYPE}\\s+(?:${UNIT}\\s+)?${MONEY}\\s+([\\d,]+)\\s+${MONEY}$`, "i");
  // "MCPE 7 / RAC / OLA / 71355 - DIGITAL / RENT A CENTER / OLA / RAC_National_OLA_Q4_2026": medium / client / product / campaign.
  const mcpe = lines.find(line => /^MCPE\b/.test(line) && /\s-\s.+\/.+\/.+\/.+/.test(line));
  const mcpeParts = mcpe ? mcpe.split(/\s-\s(.+)$/)[1].split("/").map(part => part.trim()) : [];
  const client = mcpeParts.length >= 4 ? titleCase(mcpeParts[1]) : "";
  const product = mcpeParts.length >= 4 && mcpeParts[2] !== mcpeParts[1] ? titleCase(mcpeParts[2]) : "";
  const lineItems = [];
  lines.forEach((line, index) => {
    const match = rowPattern.exec(line);
    if (!match) return;
    const [, status, id, start, end, rateType, unit, rate, units, cost] = match;
    const nameLine = lines.slice(index + 1, index + 5).map(candidate => /^\d+\s+(\S.*)$/.exec(candidate)?.[1]).find(Boolean) || id;
    lineItems.push({
      id, name: tidyAgencyName(nameLine, id), placement: nameLine.trim(), startDate: parseDeliveryDate(start), endDate: parseDeliveryDate(end),
      rateType: normalizeRateType(rateType), unit: unit ? unit.replace(/\s+/g, " ") : null, rate: toNumber(rate), units: toNumber(units), budget: toNumber(cost), kpi: null,
      status: /cancel/i.test(status || "") ? "cancelled" : "active"
    });
  });
  return {
    format: "agency-order", agency: agencyIndex >= 0 ? lines[agencyIndex + 1] || "" : "", advertiser: client || campaign.replace(/\s+20\d{2}$/, "").trim(), product, campaign,
    orderNumber: orderMatch?.[1] || null, revision: orderMatch?.[2] || null, startDate: flight.startDate, endDate: flight.endDate, budget: total ? toNumber(total) : null, lineItems
  };
}

/**
 * Slingshot "Internet Order": numbered lines (001, 002 ...) with flight dates, units @ net amount and a rate line,
 * and the placement name on the lines that follow. Page headers repeat mid-order, so they are skipped. Added-value
 * lines carry a $0 amount.
 */
function parseInternetOrder(lines, fileName) {
  const HEADER = [/^Slingshot, LLC/, /^INTERNET ORDER$/, /^Publication\s*:/, /^Client\s*:/, /^Division\s*:/, /^Product\s*:/, /^Campaign\s*:\s*$/, /^Start End Net$/, /^Line Date Date Creative Size Type Amount$/];
  const joined = lines.join("\n");
  const field = pattern => pattern.exec(joined)?.[1]?.trim() || "";
  const client = field(/^Client\s*:\s*(.+?)(?:\s+Page\s*:.*)?$/m);
  const descriptionLine = lines.findIndex(line => /Description\s*:/.test(line));
  let campaign = descriptionLine >= 0 ? lines[descriptionLine].replace(/^.*Description\s*:\s*/, "").trim() : "";
  if (descriptionLine >= 0 && lines[descriptionLine + 1] && !/^Campaign\s*:/.test(lines[descriptionLine + 1])) {
    campaign = `${campaign}${/-$/.test(campaign) ? "" : " "}${lines[descriptionLine + 1].trim()}`;
  }
  const orderNumber = field(/Order No\.\s*:\s*0*(\d+)/);
  const total = /Order Total\s*\$([\d,]+(?:\.\d+)?)/.exec(joined)?.[1];
  const rowPattern = new RegExp(`^(\\d{3})\\s+${DATE}\\s+${DATE}\\s*(.*)$`);
  const paidPattern = /(\d[\d,]*)\s+(Impressions|Clicks|Views)\s+@\s+([\d,]*\.\d{2})$/i;
  const ratePattern = new RegExp(`(?:^|\\s)(\\d+\\.?\\d{0,4})\\s+${RATE_TYPE}$`, "i");
  const lineItems = [];
  let current = null;
  let collecting = false;
  for (const line of lines) {
    if (HEADER.some(pattern => pattern.test(line))) { collecting = false; continue; }
    const row = rowPattern.exec(line);
    if (row) {
      const [, number, start, end, rest] = row;
      const paid = paidPattern.exec(rest);
      const added = /(^|\s)\.00$/.test(rest);
      current = { id: number, name: "", placement: "", startDate: parseDeliveryDate(start), endDate: parseDeliveryDate(end), rateType: null, unit: paid ? paid[2] : null, rate: null, units: paid ? toNumber(paid[1]) : null, budget: paid ? toNumber(paid[3]) : 0, kpi: null, status: "active", addedValue: !paid && added };
      lineItems.push(current);
      collecting = false;
      continue;
    }
    if (!current) continue;
    const rate = ratePattern.exec(line);
    if (rate && current.rate === null) { current.rate = Number(rate[1]); current.rateType = normalizeRateType(rate[2]); continue; }
    const placement = /^Placement\s*:\s*(.+)$/.exec(line);
    if (placement) { current.placement = placement[1].trim(); collecting = true; continue; }
    const projected = /^Projected\s*:\s*([\d,]+)\s*(Impressions)?/.exec(line);
    if (projected) { if (current.units === null) current.units = toNumber(projected[1]); collecting = false; continue; }
    if (/^(Instructions|Estimated Impressions)\s*:/.test(line)) { collecting = false; continue; }
    if (collecting) current.placement = `${current.placement} ${line}`.replace(/\s+/g, " ").trim();
  }
  for (const item of lineItems) {
    item.name = (item.placement || `Line ${item.id}`).replace(/^Cross-?Device_?/i, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  }
  const dates = lineItems.flatMap(item => [item.startDate, item.endDate]).filter(Boolean).sort();
  const revision = /\bRev\.?\s*(\d+)\b/i.exec(fileName || "")?.[1];
  return {
    format: "internet-order", agency: /^(Slingshot, LLC)/m.exec(joined)?.[1] || "", advertiser: client, campaign: campaign || client,
    orderNumber: orderNumber || null, revision: revision ? `Rev${revision}` : null, startDate: dates[0] || null, endDate: dates.at(-1) || null,
    budget: total ? toNumber(total) : null, lineItems
  };
}

const round2 = value => Math.round(value * 100) / 100;

/**
 * Parses insertion-order text (one array of lines per page) into campaign facts and line items.
 * Supports the Zeta advertising IO, agency orders with placement IDs, and Slingshot internet orders; anything else returns
 * `valid: false` with guidance rather than guessing.
 */
export function parseInsertionOrder(pages, { fileName = "" } = {}) {
  // Icon-font glyphs (private-use characters) can precede table cells; they carry no text.
  const lines = pages.flat().map(line => String(line).replace(/[\uE000-\uF8FF]/g, " ").replace(/\s+/g, " ").trim());
  const text = lines.join("\n");
  let io;
  if (/ADVERTISING INSERTION ORDER/i.test(text) || /^Agency:\s*\S/im.test(text)) io = parseZetaRio(lines);
  else if (/Order #\s*O-[A-Z0-9]+/.test(text)) io = parseAgencyOrder(lines);
  else if (/^INTERNET ORDER$/m.test(text) && /Order No\./.test(text)) io = parseInternetOrder(lines, fileName);
  else return { valid: false, errors: ["This PDF is not a recognized insertion order. Supported layouts: Zeta advertising IO, agency orders with placement IDs, and Slingshot internet orders."], warnings: [], lineItems: [] };
  const warnings = [];
  const cancelled = io.lineItems.filter(item => item.status === "cancelled");
  const active = io.lineItems.filter(item => item.status !== "cancelled");
  if (cancelled.length) warnings.push(`${cancelled.length} cancelled placement${cancelled.length === 1 ? " was" : "s were"} left out.`);
  const lineItems = uniqueIds(active);
  if (!lineItems.length) return { ...io, valid: false, errors: ["No placement rows were found in this insertion order. The layout may have changed; add the flights manually or send a sample so the parser can be extended."], warnings, lineItems: [] };
  const lineTotal = round2(lineItems.reduce((sum, item) => sum + item.budget, 0));
  if (io.budget !== null && Math.abs(lineTotal - io.budget) > Math.max(1, io.budget * 0.0005)) warnings.push(`Line budgets total $${lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} but the order states $${io.budget.toLocaleString("en-US", { minimumFractionDigits: 2 })}. Review before applying.`);
  const addedValue = lineItems.filter(item => item.addedValue).length;
  if (addedValue) warnings.push(`${addedValue} added-value placement${addedValue === 1 ? " has" : "s have"} no budget and ${addedValue === 1 ? "is" : "are"} left unselected.`);
  const missingDates = lineItems.filter(item => !item.startDate || !item.endDate).length;
  if (missingDates) warnings.push(`${missingDates} placement${missingDates === 1 ? " has" : "s have"} no readable flight dates.`);
  return { ...io, budget: io.budget ?? lineTotal, lineItems, lineTotal, valid: true, errors: [], warnings };
}
