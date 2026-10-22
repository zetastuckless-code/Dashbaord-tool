# Northstar functional alpha test guide

This test pack uses synthetic data only. Do not substitute client reports until local storage and data-handling are approved.

## Before testing

1. Run `npm install`, then `npm start`.
2. Open <http://localhost:4173>.
3. Select **Backup** and choose **Reset workspace** if an earlier session changed the workspace.

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
| 10 | Download a workspace backup, reset the workspace, and restore the backup. | Imported campaigns, audit history, preferences, acknowledgments, and saved views return. |
| 11 | With Alpha campaigns present, import `templates/alpha/05-cm360-daily.csv`. | Alpha Retargeting matches and receives three days of CM360 data; "Unknown Brand Display" is listed as unmatched with a link dropdown; confirming sets 3rd-party spend to $1,510. |
| 12 | Import `06-flashtalking-daily.csv`, then re-import `05-cm360-daily.csv`. | Flashtalking days are stored separately; the CM360 file is rejected as an exact duplicate. |
| 13 | Select a client card in the **Clients** section. | The dashboard filters to that client; selecting the card again clears the filter. |
| 15 | Import `07-dsp-line-items.csv`. | "Alpha Retargeting" matches and receives three line items (the two same-named "Dallas" lines are distinguished by ID); the unmatched campaign offers a link dropdown. |
| 16 | Expand the Alpha campaign in the **Campaigns** list and use the gear to pick different metrics for two campaigns. | Each campaign keeps its own metric set after a refresh; the line items show their individual values. |
| 17 | In a campaign's details choose **Upload IO (PDF)** with a real insertion order. | The review dialog lists placements, flight dates, rates, and budgets; applying saves line-item flights and offers to set the budget. Use a non-client IO unless your employer has approved local testing with client files. |
| 18 | Drag a metric on a campaign row to a new position, then open the gear and use the ↑↓ buttons. | The order changes on the row, persists after a refresh, and is independent for each campaign. |
| 19 | Import a canonical CSV containing a YouTube row for an existing client, assign it to that campaign, and skip a duplicate row. | The row joins the campaign as a line; the next import from the same source pre-selects your choices. |
| 20 | Upload an IO and choose **Campaign totals only**. | The campaign's budget and pacing use the order total; its report lines keep their own values and no flights are added. |
| 21 | Import a CSV report for a client that does not exist yet. | The row is labelled **New campaign**; **Review new campaign setup** is pre-filled from the report, accepts edits (an invalid budget disables the import), and the created campaign reflects them. |
| 22 | Open **Import report**, choose *A new campaign*, fill in the setup (manual budget) and press **Create campaign**. | The campaign is created, the dialog switches to *An existing campaign* with it selected, and a toast asks for its report. |
| 23 | Remove one line and one whole campaign, then press **Undo** twice. | Both removals are reversed in order; the Undo button shows how many steps remain. |
| 24 | Select a client card, then use browser Back. | The client page shows only that client's data; Back returns to the overview. |
| 25 | Expand a campaign, tick two lines, choose **Edit selected…** and set an owner; then select all and **Remove selected**. | Only the ticked lines change; the removal is reversed by two presses of **Undo**. |
| 26 | Open a client page and use **Upload / revise IO** with an order whose number was applied before. | The target campaign is pre-selected and the note calls it a revision; applying adds an Undo step. |
| 27 | Switch the spend chart to **Daily**. | Bars per day against a dashed baseline, with a note giving baseline, last-7-day average, and the daily spend needed from today. |
| 28 | Import a report that contains two or three campaigns (for example the Rent A Center workbook) and attach two IO PDFs at once with **Attach IOs (PDF)…**. | One block per campaign; each IO is matched to its campaign; confirming creates the campaigns with the orders applied, and one **Undo** reverses everything. |
| 29 | Choose **Upload / revise IO** and select two IO PDFs. | A dialog lists each order with its matched campaign; assigning both to one campaign is refused; applying adds a single Undo step. |
| 30 | Apply an IO as totals to a campaign whose report lines are named Flight 1, Flight 2, … | Each line shows its flight dates marked *from IO* and a Completed / Live / Scheduled status. |
| 31 | Press **Audit data**. | Each line gets a source/fields panel; missing fields are red and the campaign header counts lines with missing data. |
| 32 | With that campaign selected, choose a report and validate. | Every line is pre-assigned to it; importing keeps the budget you typed (single line), takes its dates, and removes the empty placeholder. |
| 33 | Validate a report with two lines for one campaign, untick one line, import, then import the next week's report. | Only the ticked line is added; the unticked line is remembered as skipped and starts unticked next time. |
| 34 | Open a line's **Details**, change **Flight end** and press **Save changes**; reopen it. | The new end date is shown, the status, top cards and pacing update, and **Undo** reverts it. For a campaign paced on insertion orders, the *Order flight* dates control the pacing flight. |
| 35 | Open a client page and scroll to **Uploads & documents**. | Each uploaded report, daily file, line-item file and IO is listed with its campaigns, data date, and a **Remove** button. |
| 36 | Remove the newest weekly report from that list, then **Undo**. | Its lines go back to the previous report's numbers (or disappear if it created them); the same file can be uploaded again; Undo brings everything back. |
| 14 | In Chrome or Edge, choose **Import report → Connect folder** and pick a folder holding the alpha CSVs. | Valid files import; daily files with unmatched campaigns appear under **Needs review**; **Undo last import** reverts the whole sync batch. |

## Feedback to capture

- Step number and expected versus actual behavior.
- Browser name and version.
- Screenshot of the problem, excluding confidential data.
- The validation-issue, mapping-review, or audit CSV when relevant.
- Whether refreshing the browser changes the result.

Do not send access tokens, client reports, or insertion orders through an unapproved channel.
