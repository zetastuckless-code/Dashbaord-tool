# Campaign Performance Dashboard — Discovery Workbook

- **Document status:** Initial discovery completed
- **Last updated:** September 24, 2026
- **Document owner:** _[Add owner]_
- **Project sponsor:** _[Add sponsor]_

## How to use this document

This workbook records the current product requirements and turns the discovery answers into decisions that can guide design and implementation. Complete the fields marked **To confirm** before development begins. Update the decision log whenever a requirement changes.

Continue with the phased delivery steps in the [implementation plan](implementation-plan.md). The fillable inventories and dictionaries for the next milestone are in `templates/discovery/`; store sensitive report files in an approved secure location rather than in this repository.

## 1. Product vision

Build an easy-to-reference source of truth for monitoring client campaign performance and spend. The product should ingest the team's recurring Excel reports, provide client and campaign views, support first-party and third-party comparisons, and highlight KPI, pacing, discrepancy, and data-quality issues.

### Desired outcomes

- Reduce the time required to review dense weekly reports.
- Give users a top-level view of active clients and campaigns.
- Make campaign-specific KPIs configurable rather than fixed globally.
- Improve spend tracking across first-party DSP and DCM/CM360 billing sources.
- Surface issues through actionable alerts.
- Retain the source and import history behind every dashboard figure.

## 2. Confirmed discovery requirements

### 2.1 Dashboard KPIs

The initial KPI catalog is:

- Click-through rate (CTR)
- Video completion rate (VCR)
- Impressions
- Spend
- Return on ad spend (ROAS)
- Cost per acquisition (CPA)
- Clicks

KPIs must be configurable by client and campaign. A user should be able to add, remove, and reorder the metrics displayed because, for example, display and video campaigns may require different primary KPIs.

**To confirm**

- [ ] Define the formula and rounding rule for each derived KPI.
- [ ] Define whether users can create entirely new KPIs or only select from an administrator-managed catalog.
- [ ] Define which KPI cards appear by default for display, video, and other campaign types.

### 2.2 Authoritative spend source

The billing source varies by client. Some clients use first-party DSP figures, while others use DCM/CM360.

The system should provide a campaign-level billing-source setting rather than only a temporary display toggle. Users may still switch between source views for comparison, but all totals and alerts must clearly label which configured source is authoritative.

**Proposed options**

- First-party DSP
- DCM/CM360
- Other approved source

**To confirm**

- [ ] Decide whether the billing source can vary within a campaign, such as by placement.
- [ ] Define who can change the authoritative source after data has been imported.
- [ ] Decide whether a source change should recalculate historical alerts.

### 2.3 Gross and net spend

The system must support both gross and net spend. Gross spend is the normal reporting basis for approximately 95% of campaigns and should be the default.

**To confirm**

- [ ] Define the fee or markup inputs used to derive gross spend when a source supplies only net spend.
- [ ] Decide whether both values should appear together or be controlled by a view setting.

### 2.4 Budgets and insertion orders

Insertion orders (IOs) currently live in Salesforce and SharePoint. For the first release, users should be able to upload an IO while creating a campaign and upload revised IOs when a budget changes mid-flight. SharePoint automation can be added after the manual workflow is proven.

Each revision should preserve:

- The original document
- Revision number or effective date
- Previous and revised budget
- Upload date and uploader
- Optional revision notes
- A clear current/approved version

**To confirm**

- [ ] Select the authoritative location for approved IOs: Salesforce or SharePoint.
- [ ] Identify the IO file formats and determine whether budgets can be extracted reliably.
- [ ] Define whether a revised budget changes pacing only from its effective date or recalculates the full campaign flight.

### 2.5 Campaign, placement, and creative identity

Campaign, placement, and creative IDs are typically available. The data model and ingestion templates should preserve all three identifiers. Creative performance should be available as a dashboard breakout and filter.

Users may edit a campaign's dashboard display name without changing its source identifiers. Imports should match on stable IDs wherever possible; editable names must not be used as the primary join key.

**To confirm**

- [ ] Provide representative IDs from each source and verify their uniqueness.
- [ ] Decide how users map records when a stable ID is absent.
- [ ] Define required creative dimensions, such as format, size, concept, or version.

### 2.6 Reporting grain

Most reports contain daily raw data. The preferred performance grain is:

> Date + client + campaign + placement + creative + source

The system should aggregate from this daily grain to client, campaign, placement, and creative views. Cumulative reports must be detected and handled separately so they are not summed as daily records.

### 2.7 First-party metrics

The expected first-party metric set is the same as the initial KPI catalog: CTR, VCR, impressions, spend, ROAS, CPA, and clicks. During sample-file analysis, the team should verify that the component measures required to calculate CTR, VCR, ROAS, and CPA are present and consistently defined.

### 2.8 Workbook template changes

Templates are generally established at campaign launch. They usually change only when a client requests a new breakout or a new campaign is added.

The importer should therefore support versioned mappings and provide a clear error when a required column or worksheet changes. A user should be able to review the issue and map a revised template without losing the prior mapping.

### 2.9 Failed imports

The uploading user owns resolution of failed imports. Error messages should be actionable and include:

- File and worksheet affected
- Row or column, when applicable
- Plain-language cause
- Suggested correction
- Whether any data was imported
- A link or action to retry after correction

Import statuses should include **Imported**, **Imported with warnings**, **Rejected**, **Awaiting mapping**, **Duplicate**, **Superseded**, and **Reprocessed**.

### 2.10 KPI targets and alerts

Users can configure KPI targets and alert rules. Rules should support campaign/client scope, metric, source, threshold, comparison operator, evaluation window, severity, recipients, and cooldown period.

Role-based access should still distinguish users who may only view a dashboard from users permitted to change targets or alerts.

### 2.11 Source discrepancy threshold

A difference greater than 10% between comparable first-party and third-party figures should be flagged by default.

**Recommended calculation**

> Percentage difference = absolute(first-party value − third-party value) ÷ authoritative-source value × 100

The dashboard should show both source values, the absolute difference, percentage difference, data freshness, and metric definition. The default threshold should be configurable because low-volume metrics and client agreements may require exceptions.

**To confirm**

- [ ] Approve the proposed percentage-difference denominator.
- [ ] Decide whether a minimum volume is required before an alert can fire.
- [ ] Define whether the alert uses daily values, period totals, or both.

### 2.12 Outlook delivery

Reports arrive in an individual inbox and an alias. Automated ingestion should use a dedicated Outlook folder or mailbox rule rather than scan the entire inbox. Intake rules can use approved senders, subject patterns, attachment names, and expected delivery schedules.

**To confirm**

- [ ] Determine whether the alias has its own mailbox or routes to the individual inbox.
- [ ] Create the dedicated intake folder and message-routing rules.
- [ ] Identify the Microsoft Entra and Graph permissions available for the integration.

### 2.13 SharePoint ingestion

A standardized SharePoint structure is feasible, although the current structure is not followed consistently. Users should be able to configure or select an approved SharePoint intake folder. Folder selection should be permission-controlled and validated to prevent importing unrelated files.

**Proposed structure**

```text
/Reporting Intake/
  /Client Name/
    /Daily/
    /Weekly/
    /Insertion Orders/
```

**To confirm**

- [ ] Identify the SharePoint site and initial pilot folders.
- [ ] Assign an owner for folder standards and cleanup.
- [ ] Define file naming and replacement conventions.

### 2.14 Historical benchmarking

Existing Excel reports are the preferred source for historical benchmarks. The pilot should establish how much history is both available and consistent before committing to a backfill period.

**To confirm**

- [ ] Choose the historical start date or number of prior campaigns to import.
- [ ] Identify known template or KPI-definition changes in the historical files.
- [ ] Define which dimensions should be available for benchmark comparison.

### 2.15 Currency

Only one currency is currently required. The campaign record should still store a currency code so values remain explicit and future expansion does not require reworking the data model.

**To confirm:** _[Enter the currency code, for example USD]_

### 2.16 Retention and client isolation

No contractual requirements for data retention or client isolation have been identified. The product should nevertheless apply baseline security controls, including authentication, role-based access, encryption, audit logs, backups, and a documented retention policy.

**To confirm**

- [ ] Confirm internal security and legal requirements.
- [ ] Select a default retention period for source files, imported data, and audit logs.
- [ ] Decide whether users should be restricted to assigned clients even though it is not contractually required.

## 3. MVP scope

### Included

- Manual Excel/CSV performance-report upload
- Manual IO upload and versioned budget revisions
- Versioned mappings for representative report templates
- Client, campaign, placement, and creative identifiers
- Configurable campaign KPI cards
- Campaign-specific authoritative billing source
- Gross and net spend support, with gross as the default
- Executive, client, campaign, and creative-performance views
- Spend pacing based on budget and campaign flight dates
- First-party and third-party comparison
- Configurable KPI alerts and a default discrepancy flag above 10%
- Actionable upload validation and import history
- Daily source data with aggregate dashboard views

### Deferred until after the manual workflow is validated

- Automated SharePoint ingestion
- Automated Outlook attachment ingestion
- Salesforce integration
- Direct CM360/DCM, DSP, or Flashtalking APIs
- Microsoft Teams notifications
- Advanced planned spend curves and forecasting

## 4. Sample files needed for design and validation

Collect sanitized examples of the following before implementation:

- [ ] Two representative clients
- [ ] Three to five weekly workbooks
- [ ] Several daily DCM/CM360 or Flashtalking reports
- [ ] At least one first-party DSP report
- [ ] Current and revised IO examples
- [ ] Matching campaign, placement, and creative IDs
- [ ] Campaign flight dates and approved budgets
- [ ] One known first-party/third-party discrepancy example
- [ ] One workbook with a newer or changed template
- [ ] Historical Excel reports selected for benchmarking

## 5. Acceptance criteria for the first release

The MVP is ready for pilot use when:

1. A user can create a client and campaign, set flight dates, upload an IO, and record a budget.
2. A user can choose the campaign's authoritative billing source and gross or net reporting basis.
3. Supported Excel/CSV templates import daily data without manual spreadsheet restructuring.
4. Invalid uploads return a clear, actionable error and do not silently create partial totals.
5. Dashboard totals can be traced to their source file, worksheet, source system, and import run.
6. Users can configure the KPI cards, targets, and alerts shown for each campaign.
7. Users can filter and compare performance by client, campaign, placement, creative, source, and date.
8. The dashboard flags a comparable first-party/third-party discrepancy greater than the configured threshold, defaulting to 10%.
9. Budget revisions retain their history and update pacing according to the approved calculation rule.
10. Duplicate or superseded files do not double-count performance.

## 6. Remaining decisions and owners

| Decision | Owner | Due date | Status |
|---|---|---|---|
| KPI formulas, rounding, and default card sets | _[Add owner]_ | _[Add date]_ | Open |
| Billing-source change and historical recalculation rules | _[Add owner]_ | _[Add date]_ | Open |
| Gross/net fee calculation | _[Add owner]_ | _[Add date]_ | Open |
| Authoritative IO repository and revision behavior | _[Add owner]_ | _[Add date]_ | Open |
| Discrepancy denominator, windows, and minimum volume | _[Add owner]_ | _[Add date]_ | Open |
| Outlook alias and Microsoft Graph access | _[Add owner]_ | _[Add date]_ | Open |
| SharePoint pilot folders and naming convention | _[Add owner]_ | _[Add date]_ | Open |
| Historical backfill range | _[Add owner]_ | _[Add date]_ | Open |
| Currency code | _[Add owner]_ | _[Add date]_ | Open |
| Security and retention defaults | _[Add owner]_ | _[Add date]_ | Open |

## 7. Decision log

| Date | Decision | Rationale | Approved by |
|---|---|---|---|
| 2026-09-24 | KPI cards will be configurable by client and campaign. | Different campaign types require different measures. | _[Add approver]_ |
| 2026-09-24 | The authoritative spend source will be configurable by campaign. | Clients bill from different systems. | _[Add approver]_ |
| 2026-09-24 | Gross spend will be the default while both gross and net are supported. | Approximately 95% of current reporting uses gross spend. | _[Add approver]_ |
| 2026-09-24 | Manual IO upload and revision history will precede automated IO ingestion. | This validates the workflow before adding integration complexity. | _[Add approver]_ |
| 2026-09-24 | Campaign display names will be editable without replacing stable source IDs. | Friendly names should not make import matching unreliable. | _[Add approver]_ |
| 2026-09-24 | Source discrepancies above 10% will be flagged by default. | This is the initial acceptable variance threshold. | _[Add approver]_ |

## 8. Notes

Use this section for workshop notes, links to sample files, assumptions, and decisions awaiting review.

_[Add notes here]_
