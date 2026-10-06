const LINE_TOLERANCE = 2.5;

/** Rebuilds visual lines from pdf.js text items: grouped by baseline, ordered left to right. */
export function itemsToLines(items) {
  const rows = [];
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const [, , , , x, y] = item.transform;
    const row = rows.find(candidate => Math.abs(candidate.y - y) <= LINE_TOLERANCE);
    if (row) row.items.push({ x, width: item.width || 0, text: item.str });
    else rows.push({ y, items: [{ x, width: item.width || 0, text: item.str }] });
  }
  return rows.sort((a, b) => b.y - a.y).map(row => {
    const ordered = row.items.sort((a, b) => a.x - b.x);
    let line = "";
    let previousEnd = null;
    for (const item of ordered) {
      if (previousEnd !== null && item.x - previousEnd > 1.5) line += " ";
      line += item.text;
      previousEnd = item.x + item.width;
    }
    return line.replace(/\s+/g, " ").trim();
  }).filter(Boolean);
}

/** Extracts text lines per page from a PDF using a pdf.js module supplied by the caller. */
export async function extractPdfLines(pdfjs, bytes) {
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, isEvalSupported: false });
  const document = await task.promise;
  const pages = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const page = await document.getPage(number);
    pages.push(itemsToLines((await page.getTextContent()).items));
  }
  await task.destroy?.();
  return pages;
}
