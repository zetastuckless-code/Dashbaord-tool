import test from "node:test";
import assert from "node:assert/strict";
import { characterSvg, clientCharacters, moveClient, orderClients } from "../lib/client-marks.js";

test("clients follow your order, and new ones join alphabetically at the end", () => {
  assert.deepEqual(orderClients(["NPB", "Highmark", "Carter BloodCare", "Rent A Center"], ["Rent A Center", "Highmark"]), ["Rent A Center", "Highmark", "Carter BloodCare", "NPB"]);
  assert.deepEqual(moveClient(["A", "B", "C", "D"], "A", 2), ["B", "C", "A", "D"]);
  assert.deepEqual(moveClient(["A", "B", "C"], "C", -4), ["C", "A", "B"]);
});

test("every client keeps its own character, and the first eight never share a shape or color", () => {
  const names = ["Carter BloodCare", "Highmark", "Houston Methodist", "McMaster-Carr", "Nature's Sunshine", "NPB", "Rent A Center", "MediaDesk"];
  const characters = clientCharacters(names);
  assert.equal(new Set(names.map(name => characters.get(name).shape)).size, 8);
  assert.equal(new Set(names.map(name => characters.get(name).color)).size, 8);
  assert.deepEqual(clientCharacters([...names].reverse()).get("Highmark"), characters.get("Highmark"));
  assert.match(characterSvg(characters.get("NPB")), /^<svg class="client-character"[^>]*aria-hidden="true"/);
});
