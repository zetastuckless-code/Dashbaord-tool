export const HEADER_ALIASES = Object.freeze({
  client: ["client", "client_name", "advertiser", "advertiser_name"],
  campaign: ["campaign", "campaign_name", "campaign_title", "order_name"],
  campaign_id: ["campaign_id", "campaign_identifier", "dcm_campaign_id", "cm360_campaign_id", "external_campaign_id"],
  owner: ["owner", "campaign_owner", "campaign_manager", "media_buyer"],
  channel: ["channel", "media_channel", "campaign_channel", "media_type", "format"],
  start_date: ["start_date", "campaign_start", "flight_start", "flight_start_date"],
  end_date: ["end_date", "campaign_end", "flight_end", "flight_end_date"],
  data_as_of: ["data_as_of", "data_date", "report_date", "through_date", "data_through"],
  spend: ["spend", "media_cost", "cost", "total_spend", "gross_spend"],
  budget: ["budget", "approved_budget", "campaign_budget", "total_budget"],
  pacing: ["pacing", "pacing_percent", "pacing_percentage", "delivery_pacing"],
  kpi: ["kpi", "primary_kpi", "goal_type"],
  kpi_value: ["kpi_value", "current_value", "actual", "kpi_actual"],
  kpi_target: ["kpi_target", "target", "goal", "target_value"],
  source: ["source", "data_source", "platform", "reporting_source"],
  updated: ["updated", "last_updated", "refresh_time"],
  billing_source: ["billing_source", "billing_platform", "authoritative_source"],
  first_party_spend: ["first_party_spend", "1st_party_spend", "dsp_spend"],
  third_party_spend: ["third_party_spend", "3rd_party_spend", "ad_server_spend"],
  impressions: ["impressions", "imps", "served_impressions"],
  clicks: ["clicks", "total_clicks"],
  conversions: ["conversions", "total_conversions", "actions"],
  revenue: ["revenue", "conversion_revenue", "sales_value"],
  video_starts: ["video_starts", "starts", "video_plays"],
  video_completions: ["video_completions", "completions", "completed_views"]
});

export function normalizeHeaderText(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
}

const ALIAS_LOOKUP = new Map(Object.entries(HEADER_ALIASES).flatMap(([canonical, aliases]) => aliases.map(alias => [alias, canonical])));

export function canonicalizeHeader(value) {
  const normalized = normalizeHeaderText(value);
  return ALIAS_LOOKUP.get(normalized) || normalized;
}

export function describeHeaderMappings(headers) {
  return headers.map(value => ({ source: String(value ?? "").trim(), normalized: normalizeHeaderText(value), canonical: canonicalizeHeader(value) }))
    .filter(mapping => mapping.normalized && mapping.normalized !== mapping.canonical);
}
