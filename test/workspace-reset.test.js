import test from "node:test";
import assert from "node:assert/strict";
import { resetWorkspaceStorage, WORKSPACE_STORAGE_KEYS } from "../lib/workspace-reset.js";

test("clears every dashboard-owned browser storage key", () => {
  const values = new Map([...WORKSPACE_STORAGE_KEYS.map(key => [key, "saved"]), ["unrelated-application", "keep"]]);
  const storage = { removeItem: key => values.delete(key) };
  assert.equal(resetWorkspaceStorage(storage), WORKSPACE_STORAGE_KEYS.length);
  assert.deepEqual([...values.entries()], [["unrelated-application", "keep"]]);
});
