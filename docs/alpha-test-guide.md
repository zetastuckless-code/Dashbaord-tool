# Northstar functional alpha test guide

This test pack uses synthetic data only. Do not substitute client reports until local storage and data-handling are approved.

## Before testing

1. Run `npm install`, then `npm start`.
2. Open <http://localhost:4173>.
3. Select **Backup** and choose **Reset to demo data** if an earlier session changed the workspace.

## Test sequence

| Step | Action | Expected result |
|---|---|---|
| 1 | Import `templates/alpha/01-first-party-daily.csv`. | Validation succeeds, common platform headers appear as aliased, and two campaigns are previewed before confirmation. |
| 2 | Confirm the import in merge mode. | Two Alpha campaigns are added and an imported audit event appears. |
| 3 | Import `02-third-party-daily.csv`. | Both rows preview as updates, not additions; campaign details retain separate first- and third-party spend. |
| 4 | Review Alpha Retargeting. | Source comparison shows $42,000 first-party versus $45,500 third-party spend. |
| 5 | Import `01-first-party-daily.csv` again. | The exact duplicate is rejected without changing campaign data. |
| 6 | Import `03-corrected-first-party.csv`. | The two existing campaigns preview as updates and the earlier same-scope import becomes superseded after confirmation. |
| 7 | Choose **Undo last import**. | Campaign values and history return to the pre-correction state and a Reverted audit event is retained. |
| 8 | Import `04-invalid-negative-spend.csv`. | Validation rejects the negative spend and enables validation-error CSV download. |
| 9 | Save a named view, change filters, then reopen it. | The saved filters, spend source, KPI, period, search, and sort are restored. |
| 10 | Download a workspace backup, reset to demo data, and restore the backup. | Imported campaigns, audit history, preferences, acknowledgments, and saved views return. |
| 11 | With Alpha campaigns present, import `templates/alpha/05-cm360-daily.csv`. | Alpha Retargeting matches and receives three days of CM360 data; "Unknown Brand Display" is listed as unmatched with a link dropdown; confirming sets 3rd-party spend to $1,510. |
| 12 | Import `06-flashtalking-daily.csv`, then re-import `05-cm360-daily.csv`. | Flashtalking days are stored separately; the CM360 file is rejected as an exact duplicate. |
| 13 | Select a client card in the **Clients** section. | The dashboard filters to that client; selecting the card again clears the filter. |
| 15 | Import `07-dsp-line-items.csv`. | "Alpha Retargeting" matches and receives three line items (the two same-named "Dallas" lines are distinguished by ID); the unmatched campaign offers a link dropdown. |
| 16 | Expand the Alpha campaign in the **Campaigns** list and use the gear to pick different metrics for two campaigns. | Each campaign keeps its own metric set after a refresh; the line items show their individual values. |
| 17 | In a campaign's details choose **Upload IO (PDF)** with a real insertion order. | The review dialog lists placements, flight dates, rates, and budgets; applying saves line-item flights and offers to set the budget. Use a non-client IO unless your employer has approved local testing with client files. |
| 14 | In Chrome or Edge, choose **Import report → Connect folder** and pick a folder holding the alpha CSVs. | Valid files import; daily files with unmatched campaigns appear under **Needs review**; **Undo last import** reverts the whole sync batch. |

## Feedback to capture

- Step number and expected versus actual behavior.
- Browser name and version.
- Screenshot of the problem, excluding confidential data.
- The validation-issue, mapping-review, or audit CSV when relevant.
- Whether refreshing the browser changes the result.

Do not send access tokens, client reports, or insertion orders through an unapproved channel.
