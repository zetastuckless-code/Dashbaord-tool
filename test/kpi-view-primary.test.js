import test from "node:test";
import assert from "node:assert/strict";
import { resolveKpiView } from "../lib/kpi-view.js";

const line = { kpi: "CTR", value: "0.07%", spend: 6112, firstPartySpend: 6112, impressions: 1880614, clicks: 1376, conversions: null };

test("the primary KPI value follows the KPI the line is set to, not the value saved at import", () => {
  assert.equal(resolveKpiView(line).formatted, "0.07%");
  assert.equal(resolveKpiView({ ...line, kpi: "CPA", conversions: 100 }).formatted, "$61.12");
  // CPA with no conversions has no value; the old CTR figure must not show under the CPA label.
  assert.equal(resolveKpiView({ ...line, kpi: "CPA" }).formatted, "—");
});
