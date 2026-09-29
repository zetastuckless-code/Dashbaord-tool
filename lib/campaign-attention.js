export function filterCampaignsByAttention(campaigns, alerts, mode = "all") {
  if (!new Set(["attention", "clear"]).has(mode)) return [...campaigns];
  const affected = new Set(alerts.map(alert => alert.campaign).filter(Boolean));
  return campaigns.filter(campaign => mode === "attention" ? affected.has(campaign) : !affected.has(campaign));
}
