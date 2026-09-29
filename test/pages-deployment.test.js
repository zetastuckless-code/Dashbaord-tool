import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("GitHub Pages deployment verifies and publishes the production bundle", async () => {
  const workflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  const viteConfig = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");
  assert.match(workflow, /npm run verify/);
  assert.match(workflow, /actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(viteConfig, /base:\s*"\.\/"/);
});
