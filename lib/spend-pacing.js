const DAY_MS = 86_400_000;

function utcDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value ? null : timestamp;
}

export function campaignFlightStatus(campaign, asOf = new Date()) {
  const start = utcDay(campaign.startDate);
  const end = utcDay(campaign.endDate);
  if (start === null || end === null || end < start) return "unknown";
  const today = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  if (today < start) return "scheduled";
  if (today > end) return "completed";
  return "live";
}

export function calculateSpendPacing(campaign, asOf = new Date()) {
  const start = utcDay(campaign.startDate);
  const end = utcDay(campaign.endDate);
  const budget = Number(campaign.budget);
  const spend = Number(campaign.spend);
  if (start === null || end === null || end < start || !Number.isFinite(budget) || budget <= 0 || !Number.isFinite(spend) || spend < 0) return null;

  const today = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const totalDays = Math.floor((end - start) / DAY_MS) + 1;
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.floor((today - start) / DAY_MS) + 1));
  const timeElapsed = elapsedDays / totalDays;
  const expectedSpend = budget * timeElapsed;
  const pacing = expectedSpend > 0 ? spend / expectedSpend * 100 : null;
  const projectedSpend = elapsedDays === 0 ? null : today >= end ? spend : spend / elapsedDays * totalDays;

  return { totalDays, elapsedDays, timeElapsed, expectedSpend, pacing, projectedSpend, variance: spend - expectedSpend };
}

export function effectivePacing(campaign, asOf = new Date()) {
  const calculated = calculateSpendPacing(campaign, asOf);
  if (calculated) return calculated.pacing;
  if (campaign.pacing === null || campaign.pacing === undefined || String(campaign.pacing).trim() === "") return null;
  const reported = Number(campaign.pacing);
  return Number.isFinite(reported) && reported >= 0 ? reported : null;
}

export function calculatePortfolioPacing(campaigns, asOf = new Date()) {
  const totals = campaigns.reduce((result, campaign) => {
    const calculated = calculateSpendPacing(campaign, asOf);
    if (calculated?.expectedSpend > 0) {
      result.spend += Number(campaign.spend);
      result.expectedSpend += calculated.expectedSpend;
      result.campaignCount += 1;
      return result;
    }
    if (calculated) return result;
    const reported = Number(campaign.pacing);
    const spend = Number(campaign.spend);
    if (Number.isFinite(reported) && reported > 0 && Number.isFinite(spend) && spend >= 0) {
      result.spend += spend;
      result.expectedSpend += spend / (reported / 100);
      result.campaignCount += 1;
    }
    return result;
  }, { spend: 0, expectedSpend: 0, campaignCount: 0 });
  return { ...totals, pacing: totals.expectedSpend > 0 ? totals.spend / totals.expectedSpend * 100 : null };
}
