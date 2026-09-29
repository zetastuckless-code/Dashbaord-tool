import { resolveSpend } from "./source-comparison.js";
import { effectivePacing } from "./spend-pacing.js";

const SORT_MODES = new Set(["portfolio", "name", "spend", "pacing-risk", "freshness"]);

export function sortCampaigns(campaigns, { mode = "portfolio", spendView = "billing", asOf = new Date() } = {}) {
  const normalizedMode = SORT_MODES.has(mode) ? mode : "portfolio";
  const indexed = campaigns.map((campaign, index) => ({ campaign, index }));
  const compareText = (left, right) => String(left ?? "").localeCompare(String(right ?? ""), undefined, { sensitivity: "base" });
  const pacingRisk = campaign => {
    const pacing = effectivePacing({ ...campaign, spend: resolveSpend(campaign, "billing") }, asOf);
    return pacing === null ? -1 : Math.abs(pacing - 100);
  };

  indexed.sort((left, right) => {
    if (normalizedMode === "name") return compareText(left.campaign.name, right.campaign.name) || left.index - right.index;
    if (normalizedMode === "spend") return resolveSpend(right.campaign, spendView) - resolveSpend(left.campaign, spendView) || left.index - right.index;
    if (normalizedMode === "pacing-risk") return pacingRisk(right.campaign) - pacingRisk(left.campaign) || left.index - right.index;
    if (normalizedMode === "freshness") return String(right.campaign.dataAsOf ?? "").localeCompare(String(left.campaign.dataAsOf ?? "")) || left.index - right.index;
    return left.index - right.index;
  });
  return indexed.map(({ campaign }) => campaign);
}
