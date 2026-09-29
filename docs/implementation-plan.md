# Campaign Dashboard — Implementation Plan

This plan converts the discovery workbook into an actionable delivery sequence. It deliberately begins with representative source files and a manual-upload pilot; Outlook, SharePoint, Salesforce, and platform automation come only after the source mappings and calculations are trusted.

## Current status

- Discovery questions have initial answers.
- The initial KPI catalog and product scope are documented.
- A browser prototype now exercises manual CSV/XLSX validation, source-column mapping review, pre-import impact review and rollback, stable campaign-ID matching, source reconciliation, alerts, budget revisions, and import history.
- No source files, field mappings, or metric formulas have been validated yet.
- The next milestone is **Pilot intake and sample analysis**.

## Working principles

1. Preserve every source value before calculating or reconciling it.
2. Match campaigns, placements, and creatives by stable source IDs, not editable display names.
3. Keep first-party and third-party values separate and label the authoritative billing source.
4. Make imports repeatable, idempotent, and traceable to the original file.
5. Do not automate a report template until it succeeds through the manual workflow.
6. Treat KPI definitions and budget revisions as versioned business data.

## Milestone 1: Pilot intake and sample analysis

**Goal:** Confirm that representative reports contain enough consistent data to support the MVP.

### Inputs required from the team

- Two representative clients: ideally one display-led and one video-led.
- Three to five weekly Excel workbooks.
- Several daily DCM/CM360, Flashtalking, or first-party DSP reports.
- One current IO and one revised IO.
- Campaign flight dates and approved budgets.
- A known first-party versus third-party discrepancy, if available.
- Historical Excel files proposed for benchmarking.

Use the templates in `templates/discovery/` to inventory these items. Do not place client data or report files in the repository; store them in the approved secure location and record only a safe reference.

### Analysis tasks

1. Record each report in the report inventory.
2. Identify workbook sheets, header rows, date fields, identifiers, metrics, and totals.
3. Classify every report as daily, cumulative, or mixed.
4. Map source columns to canonical dimensions and measures.
5. Define formulas, units, null behavior, and rounding for each KPI.
6. Compare IDs across reports to determine reliable join keys.
7. Document gross/net spend handling and authoritative-source rules.
8. Test duplicate, corrected-file, and revised-template scenarios.
9. Select the two or three templates supported by the first pilot.

### Exit criteria

- Every pilot file has an owner, cadence, source system, and reporting grain.
- Required and optional columns are known for each supported template.
- CTR, VCR, ROAS, and CPA formulas are approved.
- Campaign, placement, and creative matching rules are documented.
- The authoritative spend source and gross/net basis are known for each pilot campaign.
- At least one valid, duplicate, malformed, and revised-template example is available for testing.
- No unresolved data issue prevents daily campaign totals from being reproduced.

## Milestone 2: Data contract and prototype design

**Goal:** Freeze the minimum data contract and user flow before production implementation.

### Deliverables

- Canonical schema for clients, campaigns, source identities, performance facts, budgets, IO revisions, source files, imports, KPI definitions, targets, and alerts.
- Versioned mapping specification for each pilot workbook template.
- Import-state model: uploaded, validating, awaiting mapping, imported, imported with warnings, rejected, duplicate, superseded, and reprocessed.
- Wireframes for executive, client, campaign, creative, upload-review, and alert views.
- Permission matrix for viewer, campaign manager, data steward, and administrator roles.
- Calculation specification for pacing, projected spend, source discrepancy, and KPI attainment.

### Exit criteria

- A stakeholder can trace each dashboard value to a canonical field and source column.
- Wireframes cover the happy path and failed-import recovery.
- Acceptance examples exist for all calculated metrics.
- Open decisions have named owners and target dates.

## Milestone 3: Manual-upload MVP

**Goal:** Deliver a secure pilot that proves ingestion, reconciliation, and dashboard value without external automation.

### Build sequence

1. Application shell, authentication, roles, and audit foundation.
2. Client and campaign setup, including editable display names and stable source IDs.
3. IO upload, campaign and line-item budget entry, single-flight line-item allocations, flight dates, and versioned budget revisions. *(Prototype supports manually managed single flights keyed by line-item ID, allocation reconciliation, and CSV handoff.)*
4. File storage, upload validation, template detection, and import history.
5. Versioned mappings and normalized daily performance records. *(Prototype now retains a bounded 90-report history per campaign/source with latest-versus-previous and 7-/30-day changes; daily-grain normalization remains pending pilot files.)*
6. Executive, client, campaign, placement, and creative views.
7. Configurable KPI cards, targets, and source views.
8. Spend pacing and first-party/third-party reconciliation.
9. In-dashboard alerts and data-health indicators.
10. Pilot hardening, accessibility review, security review, and user acceptance testing.

### Definition of done

- The ten acceptance criteria in the discovery workbook pass with pilot data.
- Re-importing the same file does not double-count data.
- A corrected file can supersede an earlier file with an audit trail.
- A user can understand and resolve a rejected import without developer assistance.
- Totals reconcile to the approved source examples.
- KPI and discrepancy alerts explain the source data, rule, and evaluation period.

## Milestone 4: Microsoft 365 automation

**Goal:** Remove repetitive file handling after the manual pipeline is stable.

### Sequence

1. Establish the standardized SharePoint intake structure.
2. Configure a dedicated Outlook folder or shared-mailbox flow.
3. Register the integration in Microsoft Entra and approve least-privilege Graph permissions.
4. Add scheduled discovery of new or modified files.
5. Reuse the same validation and import pipeline as manual uploads.
6. Add delivery expectations, missing-report alerts, retry behavior, and operational dashboards.
7. Pilot with one SharePoint folder and one Outlook report type before expanding.

### Guardrails

- Do not scan an unrestricted personal inbox.
- Store Microsoft credentials outside source code.
- Record Graph item/message IDs to prevent duplicate processing.
- Quarantine unexpected file types or sender patterns.
- Preserve manual upload as a recovery path.

## Milestone 5: Reconciliation and advanced alerting

**Goal:** Turn the dashboard into an operational exception-management tool.

- Add configurable discrepancy thresholds and minimum-volume rules. *(Prototype complete: KPI and source-discrepancy alerts can now require a configurable impression floor.)*
- Support daily and period-total comparisons.
- Add pacing, KPI deterioration, stale data, missing report, and unmapped campaign rules. *(Prototype complete: imports without stable IDs enter the alert queue and can be mapped in campaign settings.)*
- Add email and optional Teams notifications with cooldown and acknowledgment behavior.
- Add historical benchmarks after validating the selected backfill range.
- Refine projected spend for planned curves, pauses, weekends, and budget revisions.

## Milestone 6: Direct integrations

**Goal:** Reduce spreadsheet dependence where platform access and business value justify it.

Evaluate DCM/CM360, DSP, Flashtalking, and Salesforce independently. Each connector must meet the same canonical contract, traceability, reconciliation, and monitoring requirements as file imports.

## Initial implementation backlog

| Priority | Work item | Dependency | Completion evidence |
|---|---|---|---|
| P0 | Collect and register pilot files | Secure sample access | Sample register is complete |
| P0 | Approve KPI formulas and units | Pilot reports | Metric dictionary is approved |
| P0 | Select stable identity keys | Pilot reports | Join tests succeed across sources |
| P0 | Approve spend and budget rules | IO and finance input | Reconciliation examples are signed off |
| P0 | Define canonical data contract | Field mappings | Schema and examples are reviewed |
| P1 | Design import and error-recovery flow | Data contract | Wireframes cover all import states |
| P1 | Design dashboard views and filters | KPI definitions | Stakeholders approve wireframes |
| P1 | Choose application stack and hosting | Security and team constraints | Architecture decision record is approved |
| P1 | Implement manual-upload pilot | Designs and architecture | MVP acceptance criteria pass |
| P2 | Add SharePoint and Outlook automation | Stable manual pipeline | Automated pilot meets delivery SLO |
| P3 | Evaluate direct platform connectors | Stable reconciliation | Connector business case is approved |

## Decisions required before selecting the application stack

- Approved cloud and hosting environment.
- Microsoft Entra tenant and single-sign-on requirements.
- Expected user count and client-access model.
- Data residency, retention, backup, and disaster-recovery requirements.
- Expected daily file count, file size, row volume, and history.
- Preferred languages/frameworks and the team's support capabilities.
- Existing database, object storage, job queue, and monitoring standards.
- Budget and delivery-date constraints.

## Immediate next session

The next working session should review two representative workbooks and one IO. By the end of that session, the team should have completed the report inventory, started the metric dictionary, identified stable IDs, and selected the first templates for the manual-upload pilot.
