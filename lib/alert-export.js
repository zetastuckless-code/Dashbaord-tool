import { rowsToCsv } from "./workbook-import.js";

export function exportAlertsCsv(alerts, exportedAt = new Date().toISOString()) {
  const headers = ["exported_at", "alert_id", "severity", "alert_type", "detail", "client", "campaign", "campaign_id", "owner", "channel", "source", "data_as_of"];
  const rows = alerts.map(alert => {
    const campaign = alert.campaign || {};
    return [exportedAt, alert.id, alert.severity, alert.title, alert.detail, campaign.client, campaign.name, campaign.campaignId, campaign.owner, campaign.channel, (campaign.sources || [campaign.source]).filter(Boolean).join(" + "), campaign.dataAsOf];
  });
  return rowsToCsv([headers, ...rows]);
}
