import test from "node:test";
import assert from "node:assert/strict";
import { csvDelimiter, decodeCsvBytes, parseCsv } from "../lib/importer.js";
import { detectDailyDelivery } from "../lib/daily-delivery-import.js";

const csv = '"Advertisement","Campaign","Date","Line Item","Clicks","Impressions","Spend"\r\n"Ad","ZCA-12572_Carter BloodCare Streaming Audio","2026-10-27","AA Audio","0","5455","120.01"\r\n';
const utf16le = text => { const bytes = new Uint8Array(text.length * 2); [...text].forEach((char, index) => { bytes[index * 2] = char.charCodeAt(0); }); return bytes; };

test("a DSP export reads the same as UTF-8, UTF-16 with or without a byte-order mark, or tab-separated", () => {
  const variants = {
    utf8: new TextEncoder().encode(csv),
    bomUtf8: new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(csv)]),
    utf16Bom: new Uint8Array([0xff, 0xfe, ...utf16le(csv)]),
    utf16: utf16le(csv),
    tabs: utf16le(csv.replace(/","/g, "\"\t\""))
  };
  for (const [name, bytes] of Object.entries(variants)) {
    const rows = parseCsv(decodeCsvBytes(bytes));
    const daily = detectDailyDelivery(rows);
    assert.ok(daily, name);
    assert.equal(rows[1][daily.columns.impressions], "5455", name);
  }
  assert.equal(csvDelimiter("a;b;c\n1;2;3"), ";");
  assert.equal(csvDelimiter('"x, y",b\n'), ",");
});

test("a redirect page saved in place of the report says so and carries the real link", async () => {
  const { readReportFile } = await import("../lib/workbook-import.js");
  const html = '<html><head><title>Object moved</title></head><body>\n<h2>Object moved to <a href="https://protect.checkpoint.com/v2/r01/___https://e.support.zetaglobal.net/hqnhp?abc&amp;x=1___.YzJ1">here</a>.</h2>\n</body></html>\n';
  await assert.rejects(readReportFile({ name: "Carterbloodcare daily report 2026-10-28.csv" }, new TextEncoder().encode(html)), error => /saved a redirect/.test(error.message) && error.message.includes("https://protect.checkpoint.com/v2/r01/___https://e.support.zetaglobal.net/hqnhp?abc&x=1___.YzJ1"));
});
