const same = (left, right) => String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();

/**
 * One file that put data on a campaign line. The list is kept on the line itself, so a client's upload history can
 * never drift from the data it describes. `created` marks a line that this upload brought into the dashboard.
 */
export function makeUpload({ kind, fileName, source = null, date = null, days = null, lineIds = null, uploadedAt = new Date().toISOString() }) {
  return { id: [kind, fileName, source ?? "", date ?? ""].join("|"), kind, fileName, source, date, ...(days ? { days } : {}), ...(lineIds ? { lineIds } : {}), uploadedAt };
}

/**
 * Adds incoming uploads to a line's list. An earlier upload of the same file, or a report for the same source and date,
 * is replaced because the new one overwrote its numbers; daily days and line IDs the new file covers are taken away from
 * older files, so removing an old file never removes what a newer one replaced.
 */
export function mergeUploads(existing = [], incoming = []) {
  const list = Array.isArray(existing) ? existing : [];
  const next = Array.isArray(incoming) ? incoming : [];
  let created = false;
  const kept = [];
  for (const old of list) {
    const replaced = next.some(item => old.kind === item.kind && (same(old.fileName, item.fileName) || (item.kind === "report" && item.date && old.date === item.date && same(old.source, item.source))));
    if (replaced) { created = created || Boolean(old.created); continue; }
    let entry = old;
    for (const item of next) {
      if (item.kind !== old.kind) continue;
      if (entry.days && item.days && same(old.source, item.source)) entry = { ...entry, days: entry.days.filter(day => !item.days.includes(day)) };
      if (entry.lineIds && item.lineIds) entry = { ...entry, lineIds: entry.lineIds.filter(id => !item.lineIds.some(other => same(other, id))) };
    }
    if ((entry.days && !entry.days.length) || (entry.lineIds && !entry.lineIds.length)) continue;
    kept.push(entry);
  }
  return [...kept, ...next.map(item => (created && !item.created ? { ...item, created: true } : item))];
}
