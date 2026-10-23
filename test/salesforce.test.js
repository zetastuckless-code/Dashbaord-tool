import test from "node:test";
import assert from "node:assert/strict";
import { cleanDomain, findOpportunityId, isOpportunityId, opportunityUrl } from "../lib/salesforce.js";

test("opportunity IDs are found in file names and checked when typed", () => {
  assert.equal(findOpportunityId("006PM00000VeE8s-2026-3-Natures_Sunshine_2026_September.xlsx"), "006PM00000VeE8s");
  assert.equal(findOpportunityId("006PM00000hfEsfYAEMcMaster-Billing.xlsx"), null);
  assert.equal(findOpportunityId("006PM00000hfEsfYAE_McMaster-Billing.xlsx"), "006PM00000hfEsfYAE");
  assert.equal(isOpportunityId("006PM00000jTyOfYAK"), true);
  assert.equal(isOpportunityId("006PM00000jTyOf"), true);
  assert.equal(isOpportunityId("ZIAO-91622"), false);
});

test("links go through Salesforce's login, or straight to your Salesforce address", () => {
  assert.equal(opportunityUrl("006PM00000VeE8s"), "https://login.salesforce.com/?startURL=%2F006PM00000VeE8s");
  assert.equal(cleanDomain("https://zeta.lightning.force.com/lightning/page/home"), "zeta.lightning.force.com");
  assert.equal(opportunityUrl("006PM00000VeE8s", "zeta.lightning.force.com"), "https://zeta.lightning.force.com/lightning/r/Opportunity/006PM00000VeE8s/view");
});
