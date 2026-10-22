const DEMO_CAMPAIGNS = new Set([
  "Apex Athletics|Always On · Retargeting|Jordan Davis",
  "Apex Athletics|Fall Video · Prospecting|Jordan Davis",
  "Lumon Home|Fall Product Launch|Morgan Lee",
  "Nova Finance|Q3 Brand Awareness|Taylor Kim"
]);
const PURGE_FLAG = "northstar-demo-purged";

export const isDemoCampaign = campaign => !campaign?.campaignId && DEMO_CAMPAIGNS.has(`${campaign?.client}|${campaign?.name}|${campaign?.owner}`);

// Earlier versions seeded these campaigns and saved them with the first import, so remove them once from stored data.
export function purgeDemoCampaigns(storage) {
  if (storage.getItem(PURGE_FLAG)) return 0;
  const stored = JSON.parse(storage.getItem("northstar-campaigns"));
  let removed = 0;
  if (Array.isArray(stored)) {
    const kept = stored.filter(campaign => !isDemoCampaign(campaign));
    removed = stored.length - kept.length;
    if (removed) storage.setItem("northstar-campaigns", JSON.stringify(kept));
  }
  storage.setItem(PURGE_FLAG, "1");
  return removed;
}
