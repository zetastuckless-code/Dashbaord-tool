// Reads the reports inside a .zip attachment (some DCM emails send their CSV zipped). Uses the browser's own
// DecompressionStream, so no library is needed. Handles stored and deflated entries; encrypted and ZIP64 archives are
// reported as unreadable.

const REPORT_FILE = /\.(xlsx|csv)$/i;
const MAX_UNZIPPED = 200 * 1024 * 1024;

export const isZipName = name => /\.zip$/i.test(String(name ?? ""));

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * The report files (.csv, .xlsx) inside a zip, as `{ name, bytes }`, in archive order. Folders inside the zip are
 * flattened to the file name; macOS "__MACOSX" copies and hidden files are left out. Throws when the zip can't be read.
 */
export async function unzipReports(buffer) {
  const data = new Uint8Array(buffer);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let end = -1;
  for (let index = data.length - 22; index >= Math.max(0, data.length - 22 - 65_535); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) { end = index; break; }
  }
  if (end < 0) throw new Error("This .zip file is damaged or isn't a zip.");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  if (offset === 0xffffffff || count === 0xffff) throw new Error("This .zip uses a format the dashboard can't open (ZIP64). Unzip it and import the report inside.");
  const reports = [];
  let total = 0;
  for (let entry = 0; entry < count; entry += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("This .zip file is damaged.");
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const size = view.getUint32(offset + 20, true);
    const unzippedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    const path = new TextDecoder().decode(data.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
    const name = path.split("/").at(-1);
    if (!name || path.startsWith("__MACOSX/") || name.startsWith(".") || name.startsWith("~$") || !REPORT_FILE.test(name)) continue;
    if (flags & 1) throw new Error(`“${name}” in this .zip is password-protected. Unzip it and import the report inside.`);
    total += unzippedSize;
    if (total > MAX_UNZIPPED) throw new Error("The reports in this .zip are too large to open.");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const packed = data.subarray(start, start + size);
    if (method === 0) reports.push({ name, bytes: packed.slice() });
    else if (method === 8) reports.push({ name, bytes: await inflate(packed) });
    else throw new Error(`“${name}” in this .zip is compressed in a way the dashboard can't open. Unzip it and import the report inside.`);
  }
  return reports;
}
