import test from "node:test";
import assert from "node:assert/strict";
import { applyAssignments, assignmentKey, initialChoices, KEEP, lineLabel, readAssignments, rememberAssignments, SKIP } from "../lib/import-assignment.js";
import { groupCampaigns } from "../lib/campaign-groups.js";
import { mergeCampaignImports } from "../lib/import-merge.js";

const nature = { client: "Nature's Sunshine", name: "Nature's Sunshine 2026", short: "NS", className: "nova", spend: 800_000, budget: 857_000, source: "Zeta Global" };
const groups = groupCampaigns([nature]);
const youtubeRow = { client: "Nature's Sunshine Report", name: "Nature's Sunshine 2026 — YouTube", channel: "YouTube", spend: 492_000, budget: 527_000, source: "Zeta Global" };
const displayRow = { client: "Nature's Sunshine Report", name: "Nature's Sunshine 2026 — Display", channel: "Display", spend: 2_700, budget: 71_000, source: "Zeta Global" };
const memoryStorage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };

test("derives the line label from the name suffix, the channel, or the name", () => {
  assert.equal(lineLabel(youtubeRow), "YouTube");
  assert.equal(lineLabel({ name: "Standard Display", channel: "Display" }), "Display");
  assert.equal(lineLabel({ name: "Solo" }), "Solo");
});

test("moves a row into an existing campaign as one of its lines and drops skipped rows", () => {
  const choices = { [assignmentKey(youtubeRow)]: groups[0].key, [assignmentKey(displayRow)]: SKIP };
  const { campaigns, skipped } = applyAssignments([youtubeRow, displayRow], choices, groups);
  assert.equal(skipped, 1);
  assert.equal(campaigns.length, 1);
  assert.deepEqual([campaigns[0].client, campaigns[0].campaignGroup, campaigns[0].name], ["Nature's Sunshine", "Nature's Sunshine 2026", "Nature's Sunshine 2026 — YouTube"]);
  const grouped = groupCampaigns(mergeCampaignImports([nature], campaigns).campaigns);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].records.length, 2);
});

test("keeps rows untouched by default and when the chosen campaign no longer exists", () => {
  const { campaigns } = applyAssignments([youtubeRow], { [assignmentKey(youtubeRow)]: "gone::campaign" }, groups);
  assert.deepEqual(campaigns, [youtubeRow]);
  assert.deepEqual(applyAssignments([youtubeRow], {}, groups).campaigns, [youtubeRow]);
});

test("keeps two rows that map to the same line distinct", () => {
  const twin = { ...youtubeRow, name: "Other — YouTube" };
  const choices = { [assignmentKey(youtubeRow)]: groups[0].key, [assignmentKey(twin)]: groups[0].key };
  const { campaigns } = applyAssignments([youtubeRow, twin], choices, groups);
  assert.deepEqual(campaigns.map(row => row.name), ["Nature's Sunshine 2026 — YouTube", "Nature's Sunshine 2026 — YouTube (2)"]);
});

test("remembers choices for the next report, forgets rows set back to keep, and ignores stale targets", () => {
  const storage = memoryStorage();
  rememberAssignments(storage, [youtubeRow, displayRow], { [assignmentKey(youtubeRow)]: groups[0].key, [assignmentKey(displayRow)]: SKIP });
  const remembered = readAssignments(storage);
  assert.equal(Object.keys(remembered).length, 2);
  assert.deepEqual(initialChoices([youtubeRow, displayRow], remembered, groups), { [assignmentKey(youtubeRow)]: groups[0].key, [assignmentKey(displayRow)]: SKIP });
  assert.deepEqual(initialChoices([youtubeRow], remembered, []), {});
  rememberAssignments(storage, [youtubeRow], { [assignmentKey(youtubeRow)]: KEEP });
  assert.equal(Object.keys(readAssignments(storage)).length, 1);
  storage.setItem("northstar-import-assignments", "{broken");
  assert.deepEqual(readAssignments(storage), {});
});
