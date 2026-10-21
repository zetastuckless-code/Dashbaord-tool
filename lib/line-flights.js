const flightNumber = name => {
  const match = /\bFlight\s*(\d+)\b/i.exec(String(name ?? ""));
  return match ? Number(match[1]) : null;
};

/** Every placement of every order applied to a campaign, earliest flight first (a placement ID appears once). */
export function campaignPlacements(entry) {
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
  return placements.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));
}

/**
 * Pairs report lines named "Flight N" with the N-th placement flight (by start date) of the campaign's insertion
 * orders. Lines without a flight number are never guessed at, since pairing them by position can mislabel them.
 * Returns a Map of line → placement; lines that cannot be paired confidently are left out.
 */
export function matchLinesToPlacements(lines, placements) {
  const matches = new Map();
  if (!placements.length) return matches;
  const records = lines.filter(line => line.kind === "record");
  const numbered = records.map(line => flightNumber(line.name));
  if (records.length && numbered.every(number => number !== null)) {
    records.forEach((line, index) => { const placement = placements[numbered[index] - 1]; if (placement) matches.set(line, placement); });
  }
  return matches;
}
