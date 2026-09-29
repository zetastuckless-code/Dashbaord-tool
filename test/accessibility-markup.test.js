import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("provides landmark navigation, table context, and labelled dialogs", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /class="skip-link" href="#overview"/);
  assert.match(html, /<main[^>]+id="overview"[^>]+tabindex="-1"/);
  assert.match(html, /<caption class="sr-only">Campaign performance/);
  const dialogs = [...html.matchAll(/<dialog[^>]+aria-labelledby="([^"]+)"/g)];
  assert.equal(dialogs.length, 8);
  for (const [, labelId] of dialogs) assert.match(html, new RegExp(`<h2 id="${labelId}">`));
});

test("exposes toggle and mobile navigation state to assistive technology", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="mobile-menu"[^>]+aria-controls="primary-navigation"[^>]+aria-expanded="false"/);
  assert.equal([...html.matchAll(/data-source="[^"]+" aria-pressed="(?:true|false)"/g)].length, 3);
  assert.match(html, /id="toast" role="status" aria-live="polite"/);
});
