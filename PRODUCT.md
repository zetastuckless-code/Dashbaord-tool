# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two groups use it equally.

- Account and campaign managers at Zeta Global who run client campaigns day to day. They open the dashboard each morning, check pacing and KPIs per client, work their to-do list, and flag issues to clients or traders.
- Their leads, who oversee many accounts and want a roll-up: which clients are off pace, which alerts need attention, and what's due.

Teammates beyond the original author will set it up and test it themselves, so every setup step must be self-explanatory.

## Product Purpose

Zeta Campaign Pacing (repo name Northstar) tracks spend pacing and KPI performance per client by matching insertion orders to delivery reports. It replaces manual spreadsheet checks and the morning scan of email, Jira and Slack.

Success right now means proving the tool's value to the team, so it gets adopted and IT grants Microsoft Graph access for deeper automation.

## Positioning

It reads the actual IO PDFs and the actual Zeta report workbooks the team already receives, matches IO line items to report lines (including flight packages, regional splits and mixed KPIs), and shows pacing against the contracted plan. It works with no IT integration: data stays in the browser, and automation runs through OneDrive-synced folders.

## Operating Context

- Reports arrive as xlsx/csv files, linked from Jira Cloud tickets (zetaglobal.atlassian.net) that point to SharePoint. IOs arrive as PDFs.
- Users are on Macs with OneDrive in Finder. SharePoint folders are added to OneDrive with "Add shortcut to My files".
- A scheduled ChatGPT (or Claude) morning scan reads Outlook, Jira and Slack and writes a markdown brief into a watched OneDrive folder. The dashboard picks it up as per-client to-dos on the Daily brief page.
- The dashboard watches a report folder and imports new reports on its own, with a review inbox for anything unclear.
- Daily ritual: open the dashboard, read the brief, check client cards and alerts, act.

## Capabilities and Constraints

- Static web app built with Vite. Hosted on GitHub Pages, also runnable locally with `npm start`.
- All data lives in browser localStorage. Folder handles live in IndexedDB. Workspace backup and restore exist.
- Folder watching uses the File System Access API, so automation works in Chrome and Edge only.
- No Microsoft Graph or IT-managed access until the tool proves itself.
- Raw report records are kept 180 days. Files in the shared folder are never deleted.
- Terminology: client, campaign (group name before " — "), line item, IO, flight (F1, F2), KPI (CPA, CTR, VCR, ROAS, CPC and others), pacing, data-through date, reporting period.
- Getting started: an empty workspace shows a welcome with three steps (upload an IO, import its report, open the client), then a short checklist that points to the automations.

## Brand Commitments

- Zeta Global branding, based on zetaglobal.com. Product name: Zeta Campaign Pacing.
- Copy voice: plain, direct, active voice, second person. Alerts read as clear sentences a manager can act on.
- Numbers are rounded for scanning: $300 rather than 0.3K, whole-dollar CPA, whole-percent VCR.

## Evidence on Hand

- Synthetic test data in `templates/alpha/` and `templates/import/`. Discovery worksheets in `templates/discovery/`.
- Screenshots in `artifacts/`.
- Setup guides in `docs/automation-setup.md` and `docs/alpha-test-guide.md`.
- Real client files (McMaster, Carter, RAC, Nature's Sunshine, Houston Methodist, Highmark, NPB) were used during development and must not be committed or shown publicly.
- No testimonials, adoption numbers or time-saved figures exist yet. Don't invent them.

## Product Principles

1. Match the documents the team already has. Adapt the importer to the files, and never make users reformat a report.
2. Every setup step must work for a teammate seeing it for the first time.
3. Show what needs action first. Off-pace lines, alerts and to-dos outrank finished or healthy work.
4. Keep data local and automation within what users already have access to.
5. Trust comes from accuracy: correct KPIs, correct data-through dates and a visible source for every number.
