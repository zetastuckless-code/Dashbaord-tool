import { normalizeBillingSource } from "./source-comparison.js";
import { mergePerformanceSnapshots } from "./performance-snapshots.js";

function nameIdentity(campaign) {
  return [campaign.client, campaign.name].map(value => String(value ?? "").trim().toLowerCase()).join("::");
}

function stableIdentity(campaign) {
  const campaignId = String(campaign.campaignId ?? "").trim().toLowerCase();
  if (!campaignId) return null;
  return `${String(campaign.client ?? "").trim().toLowerCase()}::${campaignId}`;
}

function sourceSpend(campaign, party) {
  const explicit = party === "first" ? campaign.firstPartySpend : campaign.thirdPartySpend;
  if (Number.isFinite(explicit)) return explicit;
  return normalizeBillingSource(campaign.source) === party ? Number(campaign.spend) : null;
}

function sourcesFor(campaign) {
  return [...new Set([...(campaign.sources || []), campaign.source].filter(Boolean))];
}

export function mergeCampaignImports(existingCampaigns, importedCampaigns) {
  const merged = existingCampaigns.map(campaign => ({ ...campaign }));
  const stableIndexes = new Map(merged.map((campaign, index) => [stableIdentity(campaign), index]).filter(([key]) => key));
  const nameIndexes = new Map(merged.map((campaign, index) => [nameIdentity(campaign), index]));
  let added = 0;
  let updated = 0;
  const actions = [];
  for (const imported of importedCampaigns) {
    const stableKey = stableIdentity(imported);
    const nameKey = nameIdentity(imported);
    const nameMatch = nameIndexes.get(nameKey);
    const existingIndex = stableIndexes.get(stableKey) ?? (nameMatch !== undefined && (!stableKey || !stableIdentity(merged[nameMatch])) ? nameMatch : undefined);
    if (existingIndex === undefined) {
      const newIndex = merged.length;
      merged.push({ ...imported, firstPartySpend: sourceSpend(imported, "first"), thirdPartySpend: sourceSpend(imported, "third"), sources: sourcesFor(imported), ...(imported.dataAsOf ? { performanceSnapshots: mergePerformanceSnapshots({}, imported) } : {}) });
      if (stableKey) stableIndexes.set(stableKey, newIndex);
      nameIndexes.set(nameKey, newIndex);
      added += 1;
      actions.push({ action: "add", client: imported.client, campaign: imported.name, campaignId: imported.campaignId || "", source: imported.source });
      continue;
    }
    const existing = merged[existingIndex];
    merged[existingIndex] = {
      ...existing, ...imported, name: existing.name,
      budget: existing.ioFileName ? existing.budget : imported.budget,
      billingSource: existing.billingSource || imported.billingSource,
      firstPartySpend: sourceSpend(imported, "first") ?? sourceSpend(existing, "first"),
      thirdPartySpend: sourceSpend(imported, "third") ?? sourceSpend(existing, "third"),
      sources: [...new Set([...sourcesFor(existing), ...sourcesFor(imported)])],
      source: existing.source,
      owner: imported.owner || existing.owner,
      channel: imported.channel || existing.channel,
      budgetRevisions: existing.budgetRevisions || imported.budgetRevisions,
      ioFileName: existing.ioFileName || imported.ioFileName,
      createdAt: existing.createdAt || imported.createdAt,
      performanceSnapshots: mergePerformanceSnapshots(existing, imported)
    };
    const mergedStableKey = stableIdentity(merged[existingIndex]);
    if (mergedStableKey) stableIndexes.set(mergedStableKey, existingIndex);
    nameIndexes.set(nameIdentity(merged[existingIndex]), existingIndex);
    updated += 1;
    actions.push({ action: "update", client: existing.client, campaign: existing.name, campaignId: merged[existingIndex].campaignId || "", source: imported.source });
  }
  return { campaigns: merged, added, updated, unchanged: existingCampaigns.length - updated, actions };
}
