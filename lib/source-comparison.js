export function normalizeBillingSource(value) {
  const source = String(value || "").trim().toLowerCase();
  if (["first", "first party", "1st party", "dsp"].includes(source)) return "first";
  if (["third", "third party", "3rd party", "cm360", "dcm", "flashtalking"].includes(source)) return "third";
  return "reported";
}

export function resolveSpend(campaign, view = "billing") {
  const reported = Number(campaign.spend) || 0;
  const firstParty = Number.isFinite(campaign.firstPartySpend) ? campaign.firstPartySpend : reported;
  const thirdParty = Number.isFinite(campaign.thirdPartySpend) ? campaign.thirdPartySpend : reported;
  if (view === "first") return firstParty;
  if (view === "third") return thirdParty;
  const billingSource = normalizeBillingSource(campaign.billingSource || campaign.source);
  if (billingSource === "first") return firstParty;
  if (billingSource === "third") return thirdParty;
  return reported;
}

export function calculateDiscrepancy(campaign) {
  if (!Number.isFinite(campaign.firstPartySpend) || !Number.isFinite(campaign.thirdPartySpend)) return null;
  const authoritative = resolveSpend(campaign, "billing");
  if (authoritative === 0) return campaign.firstPartySpend === campaign.thirdPartySpend ? 0 : null;
  return Math.abs(campaign.firstPartySpend - campaign.thirdPartySpend) / Math.abs(authoritative) * 100;
}

export function discrepancyStatus(campaign, threshold = 10) {
  const percentage = calculateDiscrepancy(campaign);
  const absoluteDifference = Number.isFinite(campaign.firstPartySpend) && Number.isFinite(campaign.thirdPartySpend) ? Math.abs(campaign.firstPartySpend - campaign.thirdPartySpend) : null;
  if (percentage === null) return { percentage: null, absoluteDifference, flagged: false, label: "Comparison unavailable" };
  return { percentage, absoluteDifference, flagged: percentage > threshold, label: `${percentage.toFixed(1)}% source variance` };
}
