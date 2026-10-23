# Northstar campaign dashboard

A responsive, dependency-free dashboard prototype for monitoring client campaign performance, spend pacing, data-source discrepancies, and import health.

![Northstar campaign overview](artifacts/dashboard-overview.png)

## Run locally

On Windows, run the same commands in PowerShell from the project folder (`npm install`, then `npm start`); `npm run verify` is cross-platform.

### Prerequisites

- Git
- Node.js with npm (use an employer-approved installation on managed devices)

Do not copy the Terminal prompt, Markdown link formatting, or angle brackets into these commands. On macOS, enter each command separately:

```bash
git clone https://github.com/zetastuckless-code/Dashbaord-tool.git
cd Dashbaord-tool
npm install
npm start
```

If the repository is already downloaded, start with `cd Dashbaord-tool`. If `node --version` or `npm --version` reports `command not found`, ask IT to install an approved Node.js release before continuing; the app depends on Vite and its Excel reader and cannot be run directly by double-clicking `index.html`.

If you downloaded a ZIP from GitHub, macOS normally extracts it under `~/Downloads` with a branch suffix. Locate and enter it with:

```bash
cd ~/Downloads
find . -maxdepth 1 -type d -iname 'Dashbaord-tool*' -print
cd Dashbaord-tool-main
```

Use the exact directory name printed by `find`; it may differ from `Dashbaord-tool-main`. Alternatively, type `cd ` (including the space), drag the extracted folder from Finder into Terminal, and press **Return**.

When the server starts, open <http://localhost:4173>. Stop it by returning to Terminal and pressing **Control-C**.

### Start an existing installation

```bash
npm start
```

Open <http://localhost:4173>.

## Functional alpha test pack

After the app starts, follow [`docs/alpha-test-guide.md`](docs/alpha-test-guide.md). The synthetic files in `templates/alpha/` exercise aliased first-party imports, third-party reconciliation, corrected reports, duplicate protection, rollback, invalid-data recovery, saved views, and workspace backup/restore without using client data.

Run the complete automated test and production-build check with:

```bash
npm run verify
```

## Test without installing software

The easiest managed-laptop option is GitHub Pages. A repository administrator enables **Settings → Pages → Source: GitHub Actions**, then runs the **Deploy dashboard to GitHub Pages** workflow (or merges to `main`). After deployment, testers only need a browser and can open:

<https://zetastuckless-code.github.io/Dashbaord-tool/>

The hosted alpha still stores campaigns and settings only in each tester's browser. Use the synthetic files under `templates/alpha/`; do not upload client data until the hosted location and browser-storage model are approved by your employer. GitHub Pages deployment runs the full verification command before publishing and includes the downloadable import and alpha templates.

### If the Pages workflow is not listed

GitHub only lists a manually runnable workflow after `.github/workflows/pages.yml` exists on the repository's default branch. First merge the pull request containing the Pages workflow into `main` (or otherwise add that file to the default branch). Then:

1. Open **Settings → Pages** and choose **GitHub Actions** as the source.
2. Open **Actions** and select **Deploy dashboard to GitHub Pages** in the workflow list.
3. Choose **Run workflow**, select `main`, and confirm **Run workflow**.

If the **Actions** tab, workflow, or **Run workflow** button is still unavailable, a repository or organization administrator must enable GitHub Actions and allow the Pages actions used by the workflow. The deployment also runs automatically on the next push to `main`, so the manual button is optional once the workflow is on that branch.

If the `main` branch contains only `.gitkeep`, the application has not been published to GitHub yet. A pull-request description by itself does not upload repository files. Do not enable Pages until the application files—including `package.json`, `index.html`, `app.js`, `lib/`, and `.github/workflows/pages.yml`—appear under **Code** on `main`. The project maintainer must first push this source branch to GitHub and merge it into `main`; after that merge, the Pages workflow will appear and run automatically. Creating another empty branch will not solve this condition.

### Publish the source for the first time

The build workflow does not push source code to GitHub. The order is **push source → GitHub runs the build → GitHub deploys the built site**. From a computer that has this complete project folder and Git installed, run these commands inside the project folder (Node.js is not required just to push):

If Terminal reports `fatal: not a git repository`, stop: the current folder is not a project checkout, and the commands below cannot retrieve files that have never been published. First download the complete source archive supplied by the project maintainer, unzip it, and enter the extracted folder. Confirm that `pwd` ends in that folder and that `git status` succeeds before continuing. A ZIP downloaded from the current `.gitkeep`-only GitHub `main` branch is not the application source.

A SHA-256 value shown beside a supplied download is only an optional integrity checksum—not a download key, password, command, or download location. A usable archive must be attached by the delivery system as an actual clickable file; displaying a filename or checksum in text does not transfer it. On macOS, a successfully downloaded archive can optionally be verified afterward with `shasum -a 256 <downloaded-file>`; the resulting value should match the published checksum exactly.

```bash
git remote add origin https://github.com/zetastuckless-code/Dashbaord-tool.git
git fetch origin
git merge origin/main --allow-unrelated-histories -m "Connect initial GitHub repository"
git push -u origin HEAD:main
```

If Git reports `remote origin already exists`, replace the first command with `git remote set-url origin https://github.com/zetastuckless-code/Dashbaord-tool.git`. The merge connects the local project history to the existing `.gitkeep` commit without deleting either history. Sign in through the browser or credential prompt using the GitHub account that owns the repository; never paste a password or access token into documentation or commit it to the project. If branch protection prevents a direct push, use a pull-request branch instead:

```bash
git push -u origin HEAD:dashboard-alpha
```

Then open the repository's **Pull requests** tab, create a pull request from `dashboard-alpha` into `main`, and merge it. Confirm the files are visible under **Code** on `main`; the Pages workflow should then start automatically under **Actions**.

## Prototype interactions

- Search campaigns by name, stable ID, owner, channel, or reporting source, then combine the search with client, owner, channel, and flight-status filters.
- Sort the filtered campaign list by pacing risk, selected-source spend, newest data, or campaign name without changing portfolio totals.
- Focus the portfolio on campaigns with unacknowledged alerts or campaigns that currently have no active exceptions; CSV exports use the same alert-status selection.
- Keep the active dashboard search, filters, sort, reporting period, and spend source across browser reloads, or restore the complete default portfolio with **Reset view**.
- Save up to ten named portfolio views, reopen their complete filter and KPI configuration, replace a view by saving the same name, or delete views that are no longer needed.
- Download a versioned JSON backup of the complete browser workspace—including campaigns, import history, alert settings, acknowledgments, columns, and dashboard filters—and restore it in another browser session only after validation succeeds.
- Reset only Northstar-owned browser data to an empty workspace after testing, with a confirmation warning and without clearing unrelated website storage.
- Switch the campaign views between each campaign's configured primary KPI and centrally calculated CTR, VCR, CPA, or ROAS; unavailable component-based KPIs display as unavailable instead of using unrelated reported values.
- Review a portfolio-level KPI card calculated from the filtered live campaigns, with explicit data-coverage counts and a non-combined summary when campaigns use incompatible primary KPIs.
- Plot actual cumulative spend from retained dated report snapshots against flight-aware planned spend; the chart carries campaign totals forward between report dates and shows an explicit empty state until enough history exists.
- Rebuild the spend trend from billing, first-party, or third-party snapshot history when the dashboard spend-source control changes, without combining multiple reporting sources for one campaign.
- Compare actual and planned chart values over the same source-covered campaign set, and display the number of filtered campaigns contributing history so partial trend coverage is never hidden.
- Export the active portfolio spend trend to CSV with its source view, actual and planned spend, dollar variance, pacing percentage, and campaign-coverage counts for each date.
- Export the filtered campaign view to CSV with the selected spend source, calculated pacing, KPI, flight, source, and component metrics.
- Distinguish scheduled, live, and completed campaign flights; portfolio totals and alerts focus on live campaigns.
- Archive obsolete or test campaigns without deleting their audit history, exclude archived campaigns from operational totals and alerts, and restore them from the archived flight-status view.
- Switch between billing, first-party, and third-party spend views; summary and campaign totals recalculate immediately.
- Open **Import report**, select an Excel (`.xlsx`) or CSV file, review validation results and warnings without changing dashboard data, and explicitly confirm the validated import when it is ready.
- Preview how many campaigns will be added, updated, or left unchanged before confirming an import.
- Undo the most recent confirmed import to restore campaign data and import history to their pre-import state; the reversal remains visible as a retained audit event and the reverted file can be corrected and imported again.
- Review every detected source column as directly supported, automatically aliased, or unmapped before import, and download the mapping review to CSV for template documentation and data-steward follow-up.
- Open the complete retained import audit, search by file, issue, status, or fingerprint, and filter successful, attention-required, and historical events without exporting to another tool.
- Select a campaign name to review imported components and every calculable KPI, or edit its dashboard display name, billing source, primary KPI, current value, and target.
- Add a versioned budget revision with an effective date, supporting document, and revision note.
- Review every budget revision newest-first and export the full audit—with previous and revised amounts, effective dates, supporting-document references, notes, and creation timestamps—to CSV.
- Review flight-aware campaign and portfolio pacing, expected spend, and projected final spend when start and end dates are available; reported pacing remains the fallback for reports without flight dates.
- Inspect imported impressions, clicks, conversions, revenue, and video metrics in campaign details, including calculated-versus-reported KPI traceability.
- Retain dated report snapshots during campaign merges and compare changes in spend, impressions, clicks, and conversions against the previous report or a selectable 7- or 30-day baseline from the same source; corrected same-date source reports replace their earlier snapshot.
- Review the ten newest dated snapshots for a campaign in its details and export the complete retained snapshot history—with campaign identity, source, spend, and component metrics—to CSV for audit or offline analysis.
- Bound browser snapshot retention to the latest 90 dated reports per source and campaign, preventing long-running imports from growing local storage indefinitely while preserving separate source histories.
- Switch the dashboard reporting period between current-flight totals and 7- or 30-day reported-source spend changes. Campaigns without enough dated history display an unavailable value instead of a misleading zero.
- Filter portfolio totals, campaign rows, alerts, and CSV exports by campaign owner and media channel; both values can be imported through common report headings or edited in campaign settings.
- Recalculate supported campaign-table KPIs from the selected period's component deltas so historical spend and KPI values use the same reporting window.
- Export the filtered dashboard with the active reporting period. Period exports identify reported-snapshot values explicitly, use period deltas for component metrics, recalculate supported KPIs from those deltas, and leave unavailable historical values blank.
- Configure underpacing, overpacing, first-party/third-party discrepancy, KPI-target tolerance, KPI deterioration, data-freshness, and minimum-impression thresholds. Deterioration compares the latest two same-source snapshots, while the minimum-volume rule suppresses noisy KPI and source alerts until a campaign has enough delivery.
- Opt campaigns into daily or weekly report monitoring from campaign settings. Missing or overdue expected reports appear in the operational alert queue; campaigns marked as not monitored remain unaffected.
- Flag imported campaigns that lack a stable source campaign ID and resolve them directly in campaign settings without changing the editable dashboard display name.
- Open an alert to jump directly to the affected campaign, its source comparison, pacing forecast, and KPI details.
- Export the current unacknowledged alert queue—with severity, rule detail, campaign identity, owner, channel, source, and freshness context—to CSV after applying dashboard filters.
- Acknowledge reviewed alerts from campaign details; acknowledgments persist in the browser and remove those items from the active exception count.
- Reopen acknowledged alerts automatically when their severity or evaluated condition changes, while retaining compatibility with acknowledgment data saved by earlier prototype versions.
- Reset all acknowledgments from alert settings whenever reviewed conditions need to return to the active queue.
- Review acknowledgment timestamps and restore one alert condition at a time without clearing the rest of the acknowledgment audit trail.
- Monitor live data health based on successful, rejected, duplicate, and stale imports.
- View responsive desktop and mobile layouts.
- Navigate directly to dashboard content with a keyboard skip link, use clearly visible focus states, and receive exposed dialog, table, toggle, navigation, validation, and toast context from assistive technology.

The importer scans each `.xlsx` worksheet and the first 20 rows to find a supported campaign header, or accepts CSV directly with the same header detection. It validates required columns and numeric values, reports the selected worksheet and header row, provides actionable row errors and non-blocking warnings, lets users download those issues as a file-specific CSV for correction or handoff, updates the dashboard after a successful import, and persists imported data in browser storage. Imports missing optional identity, flight, freshness, or comparison fields are recorded as **Imported with warnings** and remain visible in the data-health card until a complete report succeeds. It fingerprints the original file bytes to prevent an exact report from being imported twice and retains the ten most recent attempts for traceability and exports that complete retained audit trail—with fingerprints, campaign scope, warnings, errors, and supersession links—to CSV. When a corrected report covers the same campaign/source scope, the earlier successful import is marked as superseded and linked to its replacement. Start with `templates/import/campaign-performance.csv`.

Imports always merge: new campaigns are appended, while matching rows are updated without deleting unrelated dashboard data. The optional `campaign_id` column is the preferred stable match key; client and campaign name provide a backward-compatible fallback. Separate first-party and third-party reports for the same campaign are consolidated into one comparison record so budgets are not double-counted. Users can explicitly choose replacement mode when loading a complete portfolio snapshot.

Common source headings are mapped automatically—for example, `Advertiser Name` to `client`, `CM360 Campaign ID` to `campaign_id`, `Campaign Name` to `campaign`, `Media Cost` to `spend`, and `Platform` to `source`. Validation reports how many aliases were applied, while unknown columns remain available for future template mappings.

When component metrics are available, the importer calculates primary KPI values centrally: CTR is clicks ÷ impressions, VCR is video completions ÷ video starts, CPA is spend ÷ conversions, and ROAS is revenue ÷ spend. The source-provided KPI value is retained as `reportedValue` for traceability and remains the fallback when the required components are absent.

The optional `billing_source`, `first_party_spend`, and `third_party_spend` columns power source-specific totals. When both source spend values are available, differences over 10% are flagged on the campaign; campaign details and exports show both the absolute and percentage variance. Reports without those optional columns continue to use the required `spend` value in every view.

## How insertion orders and reports fit together

The dashboard has two ways in, and they never overlap:

- **Upload / revise IO** (top bar, client pages, and campaign details) reads an insertion order PDF in your browser and does one of two things: **creates a campaign** from it (client and name are pre-filled and editable), or **revises a campaign you track** (pre-selected by order number, then by name and client). Several PDFs can be chosen at once; they are reviewed one after another. The IO becomes the campaign's plan: its budget, its flight dates, and its lines. Placements with the same name are **one line**: an extension or a later monthly flight of the same placement adds its budget and stretches the line's dates (McMaster's Rev2 extension turns 18 placements into 9 DMA lines). A new revision of an order already applied replaces that order; a different order number adds to the campaign. Supported layouts: Zeta advertising IOs (including the package layout with written-out dates, such as Carter BloodCare), agency orders with placement IDs (Anchor Trading / Rent A Center), and Slingshot internet orders.
- **Import report** only imports performance reports and matches them to campaigns. Each campaign in the report is matched to one you track: by the same client and name, by what you chose last time, or by the campaign whose IO fits (same client, shared name words, delivery dates inside the IO flight, and report budgets that agree with the IO). Anything unmatched becomes a new campaign, or you can choose a campaign or skip it.
- **Report lines are matched to IO lines** inside the campaign: by placement ID, by *Flight N* (the N-th IO placement by start date), by the IO line's distinctive words ("Chicago", "AA"), by an exact budget match, or, when one line of each is left and the report line started delivering inside that IO line's dates, by elimination. Each campaign with an IO lists its IO lines with the matched report lines' spend, impressions, clicks, KPI and pacing against that line's budget and dates; report lines the IO does not plan are listed after them, marked *not on the IO* (or *outside the IO flight*).
- **The IO decides dates and status.** Every line of a campaign with an IO takes its dates from the IO line it matches (or the IO flight), so status, filters, alerts, the top cards and pacing all agree with the IO even when a report's summary tab shows an older end date.
- **Per-line breakdowns are read from raw tabs.** When a report's summary tab only totals the campaign (McMaster's single "Display" line), the raw delivery tab is read instead, one line per line or placement value with weekly cumulative history, as long as its total matches the summary. A tab that holds several campaigns, each titled above its table (Rent A Center's OLA Q2, Q3, and Q4), imports them as separate campaigns. Flight blocks where some flights only report ad-server (DCM) spend are billed on DCM.
- **Removed** to keep one path for everything: the IO step inside the report import, the new-campaign form in the import dialog, the "totals vs. flights" choice for IOs, the multi-IO dialog, manual line-item flights and their CSV import, daily delivery and DSP line-item file imports, the report folder auto-pull, and the merge/replace choice (imports always merge).

- **Clients** cards sit under the headline KPIs: each live client shows spend vs. budget (using the selected billing / 1st-party / 3rd-party view and reporting period), pacing against plan, primary KPI, open alerts, data freshness, and its live campaigns. Select a card to open that client's page.
- **Campaign list.** Under the client cards, every tracked campaign is one expandable row (status, flight dates, alerts) with its own metrics. Campaigns group the report lines that share a name (`Campaign — Line`) and roll totals up from components (clicks ÷ impressions, not an average of CTRs). Select a row to see its lines with their individual spend, impressions, clicks, pacing, and flight dates; **Details** opens the full campaign settings. Drag a metric on a campaign row to reorder it, or use the gear, which picks up to eight metrics from a catalog (with drag handles and ↑↓ buttons to set their order) (spend, budget, remaining, pacing, impressions, clicks, CTR, CPM, CPC, video starts/completes, VCR, conversions, CPA, revenue, ROAS, primary KPI), so one campaign can show spend, impressions, clicks, and ROAS while another shows impressions, VCR, and spend. **Metrics for all** applies one set everywhere. Choices persist, travel with workspace backups, and follow the spend-source and reporting-period controls.
- **Audit data.** The **Audit data** button above the campaign list adds a panel under every line: where its numbers came from (sheet, row, and file for report rows), the fields it carries (spend, first/third-party spend, budget, impressions, DSP impressions, clicks, CTR, conversions, revenue, video, flight dates) with missing ones in red, and notes such as "Impressions are missing, so CTR cannot be calculated", "Report budget differs from the order's", or "No flight dates on this line". Each campaign header says how many lines are missing data. Reports imported before row sources were tracked show "source not recorded" until re-imported.
- **Impressions on report lines.** Where a report has both an ad-server *Impressions* column and a *DSP Impression* column (as the Rent A Center workbook does), the ad-server value is used because it matches the Clicks and CTR columns; the DSP value is kept separately and only fills gaps.
- **Choose what each imported row becomes.** After validating a workbook, every row is labelled **New campaign** or **Updates existing**, with a choice to *add it to a campaign you already track*, *skip it*, or keep it as its own campaign, plus an *All rows* shortcut. A new campaign opens **Review new campaign setup**: client, name, campaign ID, owner, channel, dates, budget, KPI and target, billing source, and expected-report cadence are pulled from the report and can be corrected before importing (a budget you type over the report's becomes a manual budget that later reports will not overwrite). A campaign created from an IO is an empty placeholder until its first report: the report's lines join it and the placeholder disappears. Flight dates are optional when the report has none. If a file is wrongly refused as already imported, **Import it again anyway** appears under the message; importing again is safe. Rows added to a campaign become lines of it (so a YouTube report joins the campaign's Display lines), and the choice is remembered for the next report from the same source. Each campaign block lists its lines with a checkbox: untick a line (for example a stale month on a summary tab) to leave just that line out; the choice is remembered too.
- **YouTube / monthly tabs.** A monthly performance tab (Month, Media Format, Line, Impressions, Spend, such as the Nature's *YouTube Performance* sheet) is imported for the whole flight, one row per line: spend, budget to date, impressions, clicks, and conversions. A campaign's standard line and its `(Video Views)` line stay separate (`Campaign — YouTube` and `Campaign — YouTube (Video Views)`), so each can line up with its own insertion order budget. The tab replaces the stale single-month row on the summary tab. When the workbook has a monthly tab, summary-tab rows for a media format that tab does not cover (for example a Display row beside a YouTube tab) are skipped, with a warning that says so, because that row is only a snapshot. The tab's date range is the reporting period, not the flight, so the line gets no flight dates of its own (it is paced by the campaign's insertion order) and its data-as-of date is the end of that range. Each line also keeps its cumulative total at every month end, which feeds the daily spend chart in **Pacing details**; a month with no row counts as no delivery. Video view/VCR columns on those tabs are not mapped yet.
- **Client accounts.** Select a client card, or a client in the sidebar, to open that client's own page (`?client=Name`, so it can be bookmarked and the browser's back button works). It shows only that client's budget, pacing, KPI, alerts, spend trend, campaign list, and upload history, ignores the saved dashboard filters. *Insertion orders* lists each campaign's IO budget, flight, and lines, and *Uploads & documents* at the bottom lists every report and insertion order uploaded for the client, newest first; **Remove** takes out an upload and what it added (lines it brought in, or, where later reports updated them, just that report's numbers; or an insertion order's budget and lines). Removal can be undone from **Undo**, and a removed report can be uploaded again. *All clients* returns to the overview.
- **Bulk edit and remove.** Every line (and line item) in an expanded campaign has a checkbox, and the header checkbox selects them all. A bar appears with **Edit selected…** and **Remove selected**: edit owner, channel, KPI and target, billing source, and expected-report cadence on report lines. Blank fields keep their current values, and both actions take a restore point so **Undo** reverses them.
- **Pacing colours.** Every pacing number — campaign rows, lines, client cards, and the portfolio card — is coloured by status using the alert thresholds: red above the overpacing limit, amber below the underpacing limit, green in between.
- **Daily spend vs. baseline.** The spend chart has a **Cumulative / Daily** toggle. Daily shows spend per day (spend between two reports is averaged over the days between them and drawn lighter) as bars coloured by pacing, against a dashed **baseline daily budget**: each campaign's budget — or its insertion-order total when one is applied — divided by its flight days, summed across campaigns live that day. A note under the chart gives the baseline, the last seven days' average and its percentage of baseline, and the daily spend still needed from today to use the remaining budget by the end dates. Campaigns without a budget or flight dates are left out and counted. Exports follow the selected view.
- **Undo and removals.** The **Undo** button in the top bar steps back through your last eight imports and removals (a count shows how many are available). Every campaign row has **Remove campaign…** and every line has **✕**; campaign details can remove an individual dated report (the campaign falls back to the previous report's numbers when it was the newest). Each removal asks for confirmation and takes a restore point first. Older imports cannot be reversed one by one because later reports overwrite their values; removing the line or the report entry is the way to take their data out.
- Worksheets named raw data, pixel data, or mapping are never scanned, so very large analyst workbooks import quickly.

## Test

```bash
npm test
```

The test suite covers quoted CSV fields, line endings, malformed quoting, missing or duplicate columns, invalid numeric data, duplicate campaign rows, atomic rejection, HTML escaping, file fingerprints, duplicate-file detection, and bounded import history.

## Automations

Open **Automation** in the sidebar for a step-by-step setup. Both automations use Chrome or Edge, which can read a folder on your computer once you allow it.

- **Morning brief.** A scheduled ChatGPT task reads Outlook, Jira, and Slack and saves a brief in a OneDrive folder. The dashboard reads that folder and shows the brief on the Overview and the Daily brief page, with each client's to-dos. The Automation page builds the ChatGPT prompt from your details and the clients on the dashboard.
- **Report uploads.** Add your SharePoint report folders to OneDrive with "Add shortcut to My files", then connect that folder. New or changed reports import on their own when every campaign in them matches one on the dashboard (upload each client's IO first). Reports that need a decision wait under "Review anything it couldn't place". The dashboard only reads the folder; it never moves or deletes files. It remembers which files it has seen for 180 days by default.

## Design skills

`.claude/skills` holds two design skill packs that Claude Code loads in this project: [Impeccable](https://github.com/pbakaus/impeccable) (Apache 2.0) and [Emil Kowalski's skills](https://github.com/emilkowalski/skills) (MIT). Their licenses sit next to each skill. Run `/impeccable audit` or `/impeccable polish` on a page, or `sh .claude/skills/impeccable/scripts/impeccable detect index.html styles.css app.js` for the rule-based checks. The detector downloads its engine on first run and verifies its checksum; turn usage reporting off with `impeccable telemetry off`.
