// Each campaign's Salesforce opportunity, for a one-click link to it (and, one day, its IO). Opportunity IDs start
// with 006 and are 15 or 18 characters.

export const SALESFORCE_KEY = "northstar-salesforce";
const OPPORTUNITY = /(?<![A-Za-z0-9])006[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?(?![A-Za-z0-9])/;

export function readSalesforce(storage) {
  try {
    const value = JSON.parse(storage.getItem(SALESFORCE_KEY));
    return { ids: value?.ids && typeof value.ids === "object" ? value.ids : {}, domain: typeof value?.domain === "string" ? value.domain : "" };
  } catch {
    return { ids: {}, domain: "" };
  }
}

export function writeSalesforce(storage, value) {
  try { storage.setItem(SALESFORCE_KEY, JSON.stringify(value)); } catch { /* kept for this visit */ }
  return value;
}

export const isOpportunityId = value => /^006[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/.test(String(value ?? "").trim());
export const findOpportunityId = text => OPPORTUNITY.exec(String(text ?? ""))?.[0] || null;

/** "acme.lightning.force.com" or a pasted URL becomes the bare host; blank means "go through Salesforce's login". */
export function cleanDomain(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  try { return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`).host; } catch { return ""; }
}

export function opportunityUrl(id, domain = "") {
  if (!id) return null;
  return domain ? `https://${domain}/lightning/r/Opportunity/${encodeURIComponent(id)}/view` : `https://login.salesforce.com/?startURL=${encodeURIComponent(`/${id}`)}`;
}
