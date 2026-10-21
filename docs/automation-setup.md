# Automatic report intake (Outlook + SharePoint → dashboard)

The dashboard can watch a folder on your computer and import new reports on its own. Power Automate puts the reports in that folder; OneDrive syncs it down; the dashboard does the rest. No server or credentials live in the dashboard.

```
Outlook (CM360 / Flashtalking / analyst emails)
        │  Power Automate flow: save attachments
        ▼
OneDrive or SharePoint folder  "Northstar Inbox"
        │  OneDrive sync client (folder syncs to this computer)
        ▼
Dashboard → Import report → "Report folder (auto-pull)" → Connect folder
```

Requires Chrome or Edge (File System Access API). Manual upload still works everywhere.

## 1. Create the inbox folder

1. In OneDrive (or a SharePoint document library your team can access), create a folder named `Northstar Inbox`.
2. Optional: add subfolders per client (`Northstar Inbox/Highmark`). The dashboard scans up to two folders deep.
3. Use **Sync** (SharePoint) or **Always keep on this device** (OneDrive) so files are real local files, not cloud-only placeholders.

## 2. Save email attachments with Power Automate

Create an **Automated cloud flow** → trigger **When a new email arrives (V3)**:

| Setting | Suggested value |
|---|---|
| Folder | A dedicated Outlook folder or shared mailbox (see below) — not your whole inbox |
| Only with Attachments | Yes |
| Include Attachments | Yes |
| From / Subject filter | CM360 scheduler sender, Flashtalking sender, or a subject keyword |

Then add **Apply to each** over *Attachments* with these actions:

1. **Condition** — attachment name ends with `.csv` or `.xlsx` (`endswith(toLower(items('Apply_to_each')?['name']), '.csv')` or `.xlsx`).
2. **Create file** (OneDrive for Business or SharePoint) — folder `/Northstar Inbox`, file name `@{formatDateTime(utcNow(),'yyyyMMdd-HHmm')}-@{items('Apply_to_each')?['name']}`, content = attachment content.

The timestamp prefix keeps same-named daily files from overwriting each other. Re-delivered identical files are ignored automatically.

**Keep it scoped.** Create an Outlook rule that moves CM360/Flashtalking/analyst report emails into a `Reports` folder, and point the flow at that folder. Do not scan an unrestricted inbox.

## 3. Weekly analyst workbooks from SharePoint

For the weekly templates the analysts update in SharePoint, either:

- **Sync the document library** (or the client subfolder) with OneDrive and connect that synced folder directly, or
- Add a second flow: trigger **When a file is created or modified (properties only)** on the library → **Get file content** → **Create file** in `Northstar Inbox`.

Revised workbooks are imported as corrections: the latest file for a campaign replaces earlier values, and the audit history shows what changed.

## 4. Connect the dashboard

1. Open the dashboard in Chrome or Edge → **Import report**.
2. Under **Report folder (auto-pull)** choose **Connect folder** and select the synced `Northstar Inbox` folder. Browsers only grant read access to the folder you pick.
3. The dashboard imports immediately, then re-checks every 15 minutes while the tab is open and on **Sync now**.
4. After the browser restarts it may ask once to **Allow access & sync** again — that is a browser security rule.

## What happens to each file

| Result | When | What you see |
|---|---|---|
| Imported | Valid campaign summary, or a daily report where every campaign matched | Counted in the sync message and import history |
| Needs review | A daily report has campaigns the dashboard can't match, or none match | Listed under the folder section; **Review** opens the normal preview so you can link them |
| Skipped | Not a campaign report (site lists, device/time-of-day breakouts, IO files), over 25 MB, or an identical file already imported | Counted, with the reason kept in the sync ledger |

Each sync batch creates one restore point; **Undo last import** reverts the whole batch. Files are processed oldest-first so the newest report wins. Excel temporary files (`~$…`) and hidden files are ignored.

## Limits and next steps

- Everything is stored in the browser on that computer. Use **Backup** to export the workspace; the folder connection itself is not included in a backup.
- The sync runs only while the dashboard tab is open. For true unattended refresh, the next step is a small scheduled service writing to shared storage — see Milestone 4 in `implementation-plan.md`.
- Flashtalking column names are matched on a best-effort basis (`Date`, `Campaign`, `Impressions`, `Clicks`, `Media Cost` and common variants). If a real export is rejected, download the validation errors and send the header row so an alias can be added in `lib/daily-delivery-import.js`.
