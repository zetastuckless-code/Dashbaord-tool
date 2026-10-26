import test from "node:test";
import assert from "node:assert/strict";
import { applyCampaignStatus, moveCampaign, orderGroups, setCampaignStatus } from "../lib/campaign-order.js";
import { dashboardFlightStatus } from "../lib/campaign-filters.js";

const group = (key, status = "live") => ({ key, status });

test("completed campaigns always go last; the rest follow the saved order", () => {
  const groups = [group("a"), group("b", "completed"), group("c"), group("d")];
  assert.deepEqual(orderGroups(groups, ["d", "a"]).map(item => item.key), ["d", "a", "c", "b"]);
  assert.deepEqual(orderGroups(groups, ["d", "a"], { manual: false }).map(item => item.key), ["a", "c", "d", "b"]);
});

test("moves a campaign up, down, to the top, and to the bottom of the shown campaigns", () => {
  const shown = ["a", "b", "c"];
  assert.deepEqual(moveCampaign([], shown, "c", "up"), ["a", "c", "b"]);
  assert.deepEqual(moveCampaign([], shown, "a", "down"), ["b", "a", "c"]);
  assert.deepEqual(moveCampaign([], shown, "c", "top"), ["c", "a", "b"]);
  assert.deepEqual(moveCampaign([], shown, "a", "bottom"), ["b", "c", "a"]);
  assert.deepEqual(moveCampaign([], shown, "a", "up"), ["a", "b", "c"]);
});

test("moving within a filtered list keeps hidden campaigns in their saved places", () => {
  const order = ["x", "a", "y", "b", "c"];
  assert.deepEqual(moveCampaign(order, ["a", "b", "c"], "c", "top"), ["x", "c", "y", "a", "b"]);
});

test("a hand-set status applies to every line of the campaign and drives its status", () => {
  const rows = [{ client: "Acme", name: "Spring — Display", startDate: "2026-01-01", endDate: "2026-12-31" }, { client: "Acme", name: "Spring — Video", startDate: "2026-01-01", endDate: "2026-12-31" }, { client: "Acme", name: "Fall — Display" }];
  let status = setCampaignStatus({}, "acme::spring", "paused");
  const paused = applyCampaignStatus(rows, status);
  assert.deepEqual(paused.map(row => row.manualStatus), ["paused", "paused", undefined]);
  assert.equal(dashboardFlightStatus(paused[0], new Date("2026-06-01T00:00:00Z")), "paused");
  status = setCampaignStatus(status, "acme::spring", "completed");
  assert.equal(dashboardFlightStatus(applyCampaignStatus(paused, status)[1], new Date("2026-06-01T00:00:00Z")), "completed");
  status = setCampaignStatus(status, "acme::spring", "auto");
  const back = applyCampaignStatus(applyCampaignStatus(paused, status), status);
  assert.equal(back[0].manualStatus, undefined);
  assert.equal(dashboardFlightStatus(back[0], new Date("2026-06-01T00:00:00Z")), "live");
  assert.equal(applyCampaignStatus(back, status), back);
});

test("a campaign the client canceled counts as completed and keeps its own status", () => {
  const record = { client: "Rent A Center", name: "OLA Q4 — Flight 1", startDate: "2026-09-27", endDate: "2026-12-26" };
  const key = "rent a center::ola q4";
  const statuses = setCampaignStatus({}, key, "canceled");
  assert.deepEqual(statuses, { [key]: "canceled" });
  assert.equal(dashboardFlightStatus({ ...record, manualStatus: "canceled" }, new Date("2026-10-26T12:00:00Z")), "completed");
  assert.deepEqual(setCampaignStatus(statuses, key, "auto"), {});
});

test("a line's own status wins over its IO line's, which wins over its campaign's", async () => {
  const { applyCampaignStatus, ioLineStatusKey, recordStatusKey } = await import("../lib/campaign-order.js");
  const display = { client: "RAC", name: "RAC OLA Q4 — Display", ioLine: "standard display package" };
  const video = { client: "RAC", name: "RAC OLA Q4 — Video", ioLine: "olv" };
  const other = { client: "RAC", name: "RAC OLA Q4 — Native" };
  const key = "rac::rac ola q4";
  const statuses = { [key]: "paused", [ioLineStatusKey(key, "olv")]: "completed", [recordStatusKey(other)]: "canceled" };
  const [a, b, c] = applyCampaignStatus([display, video, other], statuses);
  assert.deepEqual([a.manualStatus, b.manualStatus, c.manualStatus], ["paused", "completed", "canceled"]);
  const [d] = applyCampaignStatus([display], { [ioLineStatusKey(key, "standard display package")]: "completed" });
  assert.equal(d.manualStatus, "completed");
});
