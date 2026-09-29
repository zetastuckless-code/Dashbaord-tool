import test from "node:test";
import assert from "node:assert/strict";
import { previewCampaignImport } from "../lib/import-preview.js";

test("previews merge additions and updates without mutating campaigns", () => {
  const existing = [{ client: "Apex", name: "Existing", campaignId: "1", source: "CM360", spend: 10 }];
  const imported = [{ client: "Apex", name: "Renamed", campaignId: "1", source: "DSP", spend: 15 }, { client: "Nova", name: "New", campaignId: "2", source: "CM360", spend: 20 }];
  const preview = previewCampaignImport(existing, imported, "merge");
  assert.deepEqual({ added: preview.added, updated: preview.updated, unchanged: preview.unchanged, removed: preview.removed }, { added: 1, updated: 1, unchanged: 0, removed: 0 });
  assert.deepEqual(preview.actions.map(item => item.action), ["update", "add"]);
  assert.equal(existing[0].spend, 10);
});

test("previews replacement impact and clones the imported collection", () => {
  const imported = [{ client: "Apex", name: "Only", source: "CM360" }];
  const preview = previewCampaignImport([{ name: "One" }, { name: "Two" }], imported, "replace");
  assert.deepEqual({ added: preview.added, updated: preview.updated, unchanged: preview.unchanged, removed: preview.removed }, { added: 1, updated: 0, unchanged: 0, removed: 2 });
  assert.equal(preview.actions[0].action, "replace");
  assert.notEqual(preview.campaigns[0], imported[0]);
});
