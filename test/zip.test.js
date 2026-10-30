import test from "node:test";
import assert from "node:assert/strict";
import { isZipName, unzipReports } from "../lib/zip.js";

async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A minimal zip (no CRCs; the reader doesn't check them) with each file stored or deflated. */
async function makeZip(files) {
  const encoder = new TextEncoder();
  const locals = [];
  const central = [];
  let offset = 0;
  for (const { name, text, method = 8, flags = 0 } of files) {
    const nameBytes = encoder.encode(name);
    const raw = encoder.encode(text);
    const packed = method === 8 ? await deflate(raw) : raw;
    const local = new Uint8Array(30 + nameBytes.length + packed.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(6, flags, true); lv.setUint16(8, method, true);
    lv.setUint32(18, packed.length, true); lv.setUint32(22, raw.length, true); lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30); local.set(packed, 30 + nameBytes.length);
    const entry = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(entry.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(8, flags, true); cv.setUint16(10, method, true);
    cv.setUint32(20, packed.length, true); cv.setUint32(24, raw.length, true); cv.setUint16(28, nameBytes.length, true); cv.setUint32(42, offset, true);
    entry.set(nameBytes, 46);
    locals.push(local); central.push(entry); offset += local.length;
  }
  const size = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, size, true); ev.setUint32(16, offset, true);
  return new Uint8Array(await new Blob([...locals, ...central, end]).arrayBuffer());
}

test("opens the report inside a zipped DCM attachment", async () => {
  const csv = "Example DCM\n\nDate,Placement,Impressions\n2026-10-29,Display,1200\n";
  const reports = await unzipReports(await makeZip([{ name: "1234_Example_DCM_20261030.csv", text: csv }]));
  assert.deepEqual(reports.map(item => [item.name, new TextDecoder().decode(item.bytes)]), [["1234_Example_DCM_20261030.csv", csv]]);
});

test("keeps only reports, flattens folders, and reads stored entries", async () => {
  const reports = await unzipReports(await makeZip([
    { name: "__MACOSX/._a.csv", text: "junk" },
    { name: "notes.txt", text: "read me" },
    { name: "exports/b.csv", text: "a,b\n1,2\n", method: 0 },
    { name: "c.xlsx", text: "xlsx bytes" }
  ]));
  assert.deepEqual(reports.map(item => item.name), ["b.csv", "c.xlsx"]);
  assert.equal(new TextDecoder().decode(reports[0].bytes), "a,b\n1,2\n");
});

test("explains zips it can't open", async () => {
  await assert.rejects(unzipReports(new TextEncoder().encode("not a zip at all, just text")), /damaged or isn't a zip/);
  await assert.rejects(unzipReports(await makeZip([{ name: "locked.csv", text: "x", flags: 1 }])), /password-protected/);
  assert.equal(isZipName("Report.ZIP"), true);
  assert.equal(isZipName("Report.csv"), false);
});
