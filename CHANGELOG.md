# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.23.3] - 2026-10-11

### Fixed
- **Fixed (BW-022)**: Audit Trail button unresponsive since 1.23.2 (unbound click handler).

## [1.23.2] - 2026-10-10

### Refactored
- **Modular Component Decomposition of `BackupWatch.tsx`**:
  - Split the 5,462-line monolithic SPFx web part into modular, single-responsibility sub-components across dedicated directories:
    - **Types & Core Styles**:
      - `components/types/BackupWatchTypes.ts`: Centralized interfaces (`IAgentResult`, `IDattoDevice`, `IExclusion`, `IEscalatableIssue`, `IBackupWatchState`).
      - `components/styles/BackupWatchStyles.tsx`: Extracted theme stylesheet containing all Cyber Navy & Enterprise Clean CSS tokens and utility classes.
    - **Interactive Modals & Drawers**:
      - `components/modals/MutingModal.tsx`: 3-tier silence and volume exclusion modal.
      - `components/modals/EscalationModal.tsx`: Bulk Autotask ticket escalation checklist modal.
      - `components/modals/AuditLogsDrawer.tsx`: System audit log viewer with search and CSV export.
      - `components/modals/AdminModal.tsx`: Administrator configuration console (Diagnostics, Routing, Maintenance Blackout, Orphan Cleanup, Asset Tester).
    - **Appliance & Layout Sub-Components**:
      - `components/appliance/HeaderBar.tsx`: Brand hero card, mode switcher, governance controls, and operator badge.
      - `components/appliance/MetricCards.tsx`: 8-card responsive fleet KPI metrics grid with dynamic color glows.
      - `components/appliance/ExclusionsTable.tsx`: Dedicated exclusions list table and management view.
  - Reduced `BackupWatch.tsx` line count by ~50% (from 5,462 lines down to 2,772 lines), improving maintainability and component testability while maintaining 100% functional parity and build compatibility.

## [1.23.1] - 2026-10-09

### Changed
- **Header Controls Toolbar Redesign (Option 1 Segmented Ergonomic Layout)**:
  - Replaced the unsegmented flat button sequence with 4 distinct functional clusters:
    1. **View Mode Switcher**: Modern segmented pill control (`Fleet Desk` vs. `Exclusions`) with SVG vector icons and active state illumination.
    2. **Governance & Management Actions**: Clean vector SVG icons for `Audit Trail` and `Admin Console` (retaining admin security level gate and soft crimson alert glow).
    3. **Utility Dock**: Compact 32×32px icon buttons for `Theme Toggle` (`☀️` / `🌙`) and `Fullscreen` (`⛶`).
    4. **Operator Identity**: Sleek avatar pill featuring user initials (`MW`), user display name, and role badge.
  - Eliminated platform-dependent emojis (`📜`, `⚙️`, `🖥️`, `🌙`) from header buttons in favor of scalable, crisp vector SVGs conforming to UI/UX Pro Max heuristics.
  - Verified that the official Fifosys brand emblem and title section remained 100% untouched.

## [1.22.7] - 2026-10-09

### Fixed
- **Autotask PSA `getFieldInfo` Concurrency & Thread Threshold Remediation**:
  - Eliminated the `Thread Threshold Exceeded` alert triggered by concurrent requests to Autotask REST API (`Method: getFieldInfo`, `Entity: Ticket`).
  - Replaced redundant, un-cached parallel `Promise.all` downloads of `/Tickets/entityInformation/fields` across 6 picklist fields with a unified single-fetch in-memory caching engine (`getTicketEntityFields`).
  - Implemented an **In-Flight Singleton Promise Mutex** to collapse concurrent admin requests into strictly 1 active HTTP connection, guaranteeing active threads remain $\le 1$ (well below Autotask's 3-thread ceiling).
  - Added 1-hour TTL in-memory caching for entity schema metadata with support for instant cache-busting via `force=true` or `forceRefresh=true`.

## [1.23.0] - 2026-10-08

### Added
- **Official Fifosys Brand Icon Integration**:
  - Embedded the official cropped Fifosys brand mark (`fifosys-icon.png`) directly into the SharePoint SPFx client as a self-contained base64 asset (`FIFOSYS_ICON_BASE64`), eliminating external CDN dependencies.
  - Integrated the brand emblem into the header hero card with responsive glow, rounded corners, and branded divider lines.
- **Unified Multi-Platform Scope (Vendor-Agnostic Header)**:
  - Replaced restrictive legacy "BCDR" subtitle with **"Unified Data Protection Desk"**, establishing future-ready support for Veeam, Cloud Ally, and Datto SaaS alongside on-premise Datto appliances.

### Changed
- **Cyber Navy & Enterprise Clean Design System**:
  - Upgraded live dashboard CSS variable tokens to the approved palette: Cyber Navy (`#081621` / `#0F2535` / `#143144`) for Dark Mode and Enterprise Clean (`#F4F6F9` / `#FFFFFF`) for Light Mode.
  - **Light Mode by Default**: Configured Enterprise Clean as the default startup theme on first load, with seamless local storage persistence when operators toggle to Dark Mode (`🌙` / `☀️`).
  - Aligned table headers, agent cards, status pills, and KPI metric card glows to theme design tokens.
  - Added `.bw-badge-pill.orange` styled with Fifosys brand orange (`#EE6823`).

### Deployment
- **SPFx Package Synchronized**:
  - Bumped version to `1.23.0.0` in `package-solution.json`, `package.json`, and `BackupWatchWebPart.manifest.json`.
  - Packaged and deployed production `.sppkg` to the SharePoint App Catalog.

## [1.22.6] - 2026-10-08

### Fixed
- **Autotask PSA Thread Threshold & Concurrency Remediation**:
  - Eliminated the `Thread Threshold Exceeded` alert triggered by concurrent requests to Autotask REST API (`Method: query`, `Entity: Ticket`).
  - Replaced unbounded parallel `Promise.all` in the Volume Exclusions Reconciliation Sweep with a sequential, single-file loop with 100ms inter-request pacing, guaranteeing that active concurrent Autotask threads remain strictly at 1 (well below Autotask's 3-thread ceiling).
  - Replaced unthrottled parallel `getSingleTicketFromAutoTask` calls during `TrackedTickets` sync with batched `queryTicketsInAutoTask` calls (chunks of up to 20 ticket IDs per single request).
  - Implemented automatic database entity self-healing: once an exclusion's numeric Autotask ticket ID is resolved, it is merged into the Azure Table Storage entity (`ticketUrl`), allowing all subsequent 30-minute scans to bypass the `queryTicketByNumber` API call entirely.

## [1.22.5] - 2026-10-01

### Added
- **Dynamic Backend-Driven Engine Versioning**:
  - Eliminated the requirement to manually rebuild and redeploy SharePoint `.sppkg` packages whenever updating backend-only services.
  - Enriched the primary data API response (`backupWatchTrigger`) with dynamic `appVersion` telemetry sourced from a centralized shared configuration (`shared/version.ts`).
  - Updated the SPFx client (`BackupWatch.tsx`) to dynamically bind the control desk hero badge and footer engine string to `this.state.backendVersion || this.props.version`. Going forward, backend code releases deployed to Azure automatically update the dashboard version immediately upon page load without touching SharePoint.

### Fixed
- **Volume Exclusion Normalization & Ghost Twin Entity Prevention**:
  - Resolved an issue where a Windows volume exclusion saved via the dashboard as a canonical drive letter (e.g. `D`) failed to overwrite or absorb an earlier automated un-normalized database record (e.g. `D:\`), leaving a "ghost" twin record in Azure Table Storage.
  - Implemented automatic twin cleanup in `POST /api/exclusions` (`stateless-backend/exclusions/index.ts`): saving an exclusion for any volume now proactively scans and purges legacy un-normalized variant keys (`D:\`, `D:`, `d`, `D:/`) from the `Exclusions` table.
- **Reconciliation Sweep Suppression for Permanent Exclusions**:
  - Fixed an edge case in `backupWatchTrigger/index.ts` where closing an Autotask ticket linked to a Permanent Exclusion could trigger the background reconciliation sweep to re-open a new compliance ticket if an un-normalized temporary record for the same volume still lingered.
  - Added permanent twin detection in the reconciliation sweep: if a canonical Permanent Exclusion already exists for a drive, any redundant temporary record is silently purged, and follow-up ticket creation is strictly suppressed.

## [1.22.4] - 2026-09-18

### Fixed
- **Appliance Active vs. Cancelled Classification (`isActive`)**:
  - Resolved an issue where active appliances on Datto's **Infinite Cloud Retention** or unmetered service plans (such as `PMG-Datto-02`) were mistakenly marked as inactive/cancelled (`isActive: false`) and filtered out of the Active Appliances tab into the Cancelled Appliances tab.
  - Implemented `isApplianceActive` helper in `backupWatchTrigger/index.ts` ensuring that:
    1. Appliances explicitly marked as hidden in the Datto portal (`device.hidden === true`) remain classified as cancelled.
    2. Appliances with populated service period dates (`servicePeriod`) must have a valid future expiration timestamp.
    3. Appliances with empty or unmetered service periods (`servicePeriod: ""` or missing) remain classified as **Active** if they have an active check-in heartbeat (`lastSeenDate` / `lastCheckin`) within the last 30 days.
  - Ensures compliance monitoring and automated ticketing loops do not prematurely skip active devices.


### Changed & Fixed
- **Conditional Exclusion Justification Policy (Temporary vs. Permanent)**:
  - **Temporary Exclusions**: "Reason / Business Justification" is now explicitly optional. Engineers (including Contributors) can save temporary troubleshooting silences and volume notes by providing solely the required Autotask Ticket #.
  - **Permanent Exclusions**: Strictly enforces mandatory detailed business justification / reason (restricted to Specialists and Administrators).
  - **Frontend UI & Validation**:
    - Updated modal labels dynamically: displays `(Optional for Temporary)` vs. `* (Required for Permanent)`.
    - Updated textarea placeholders dynamically to guide engineers.
    - Updated "Save Volume Note" / "Confirm Silence" button disabled condition: button immediately enables as soon as a valid Autotask Ticket # is provided for temporary exclusions, without requiring a reason.
  - **Backend API Validation (`POST /api/exclusions`)**:
    - Updated payload validation so that `reason` is only validated as mandatory when `isPermanent: true`.
    - Generates clean default text (`"None provided (Temporary exclusion)"`) for Autotask ticket worklog notes, Azure Table Storage entities, and audit logs when reason is omitted on temporary exclusions.

## [1.22.2] - 2026-09-07

### Added & Fixed
- **Live Autotask Issue & Sub-Issue Types Integration**:
  - Removed all mock and hardcoded fallback picklist options from the SPFx Administrator Console and backend routing configurations.
  - Dynamically retrieves real-time active Issue and Sub-Issue types from Autotask REST API (`/Tickets/entityInformation/fields`) preserving parent-child dependency mapping (`parentValue`).
  - Dropdown dynamically filters Sub-Issue types to strictly those permitted under the selected parent Issue Type (e.g. `Backup (ID: 30)` displays strictly `Warning (ID: 289)`, `Failure (ID: 290)`, `Other (ID: 333)`, and `Report (ID: 586)`).
  - Updating Issue Type automatically re-aligns Sub-Issue selection to a valid child option.
- **Admin Routing Matrix Persistence & Synchronization**:
  - Updated `adminRouting` endpoint to return live `alertMatrix` and Autotask picklists (`issueTypes`, `subIssueTypes`, `queues`, `categories`, `priorities`, `workTypes`) and support matrix save operations directly from the Admin console.
  - Sanitized Azure Table Storage `SystemConfig` `AlertRouting` table to ensure existing rows utilize genuine Autotask IDs across all 7 alert types.
- **Volume Exclusion Lifecycle Sync & Auto-Heal**:
  - Automatically re-opens a fresh Autotask compliance ticket if an exclusion ticket was closed while an unprotected volume is still live in Datto BCDR.
  - Updates open tickets to `Attention Required` and extends temporary silence windows by 24 hours.
  - Adds closure notes to tickets when exclusions are resolved in Datto BCDR without prematurely closing engineer tickets.

## [1.22.1] - 2026-09-07

### Fixed
- **Exclusion Notes & Silencing Persistence Across All RBAC Roles**:
  - Resolved `HTTP 403 Forbidden` failures on `POST/DELETE /api/exclusions` and `POST /api/escalate` by passing `'x-user-role'` and `'x-user-email'` headers and URL query parameters from the SPFx React client (`BackupWatch.tsx`).
  - Enables Contributors, Specialists, and Administrators to successfully save temporary/permanent notes, unmute exclusions, and manually escalate tickets according to their defined Entra ID role permissions in `security_group_rbac_proposal.md`.
  - Replaced silent error swallowing in SPFx `_addExclusion` and `_removeExclusion` with clear user-facing error notifications when requests fail or return non-2xx status codes.
- **Ticket Tracking & Autotask Linkage for Active Exclusions**:
  - Fixed stale ticket URL retention in `POST /api/exclusions`: when an engineer provides a new ticket number for an existing exclusion, the old ticket URL is cleared so that Autotask is queried for the new ticket's numeric ID and portal link, ensuring worklog notes are posted to the new ticket.
  - Preserved active Autotask ticket references (`backupTicket`, `screenshotTicket`, `statusTicket`) on silenced agents in `backupWatchTrigger/index.ts`, ensuring linked ticket badges remain visible and clickable on the dashboard while alerts are silenced.
  - Updated storage warning escalation in `BackupWatch.tsx` to verify appliance-level silencing rather than checking `device.backupStatus !== 'Muted'`, preventing volume exclusions from masking storage escalations.

## [1.22.0] - 2026-09-03

### Added
- **Alert-Specific Routing & Classification Matrix (7 Operational Alert Types)**:
  - Added dedicated per-alert routing matrix to the Administrator Console (`🔀 Alert Routing & Picklists Matrix`) covering all 7 core operational BCDR alert conditions:
    1. **Volume Exclusions**: Unprotected volume detected (*Active in production*).
    2. **Storage Alerts**: Appliance storage pool $>85\%$ (Warning) or $>90\%$ (Critical).
    3. **Local Backup Failures**: Latest snapshot run explicitly failed.
    4. **Overdue Backups**: Snapshot overdue $>24\text{ hours}$.
    5. **Offsite Sync Issues**: Cloud replication backlog $>100\text{ GB}$ or stalled $>48\text{ hours}$.
    6. **Screenshot Failures**: Daily automated verification boot test failed.
    7. **Offline Appliances**: Check-in heartbeat overdue $>30\text{ minutes}$.
  - **Granular Autotask Classification**: Each alert can be independently routed to a designated Autotask Queue, Assigned Priority (`Critical`, `High`, `Medium`, `Low`), Issue Type, and Sub-Issue Type.
  - **Customizable Ticket Title Templates**: Flexible title template inputs with dynamic placeholder tokens (`{Company}`, `{Device}`, `{Agent}`, `{Detail}`).
  - **Independent Auto-Ticket Toggle Switches**: Allows administrators to toggle automated ticket creation on or off per alert type.
  - **Operational Safety Policy**: Backwards-compatible by design. Automated background ticketing remains strictly active for Volume Exclusions only; the remaining 6 alert types default to `Auto-Ticket: OFF` (Monitoring & Manual Escalation only) to prevent service desk ticket noise.
  - **Azure Table Storage Persistence**: Matrix configurations saved to `SystemConfig` table under `PartitionKey: 'AlertRouting'`, hot-reloaded across Azure Functions without restarts.

## [1.21.0] - 2026-09-02

### Added
- **Global Maintenance Mode / Alert Silence Blackout (`🚨 Alert Blackout`)**:
  - Global suppression system in `shared/autotask.ts` and `shared/configService.ts` that silences automated compliance ticket creation across all Datto appliances during planned maintenance windows, migrations, or SAN reboots.
  - Persistent state in Azure Table Storage (`SystemConfig/Global/MaintenanceMode`) with configurable duration (1h, 2h, 4h, 8h, 24h, 48h) and reason logging.
  - Glowing red top hero banner displayed across the dashboard when active, detailing expiration timestamp, reason, and dedicated `⚙️ Manage Blackout` shortcut button for Administrators.
  - Immediate manual deactivation control for rapid resumption of ticketing operations.
- **Stale Ticket & Entity Cleanup Tool (`🧹 Entity Cleanup`)**:
  - Scans `TrackedTickets` and `Exclusions` tables in Azure Table Storage against active Datto BCDR inventory to identify decommissioned appliances and orphaned records.
  - Bulk purge tool allowing Administrators to cleanly delete stale tracking records, preventing database bloat and ghost ticket tracking.
  - All purge operations recorded to `AuditLogs` for full accountability.
- **Exportable Audit Log Reports (CSV / Compliance Audit)**:
  - RFC-compliant CSV export button (`📥 Export to CSV`) added directly to the Audit Trail modal.
  - Exports filtered or full audit trails with timestamp, user email, action, target, and details for regulatory compliance, ISO audits, and internal service reviews.
- **Live Autotask Connection Tester & Asset Reconciliation (`🔍 Asset Diagnostic`)**:
  - Live 4-tier diagnostic tab in the Administrator Console allowing instant resolution testing for any appliance serial number or server hostname.
  - Reports API latency, matched Configuration Item ID, resolved Autotask Company name and ID, and active Datto BCDR contract status without creating or modifying tickets.

## [1.20.0] - 2026-09-02

### Added
- **Administrator Console (`⚙️ Admin Console`)**:
  - Exclusive admin button in dashboard header with distinct amber/red accent and glowing border, rendered strictly when `userSecurityLevel === 'Administrator'`.
  - **System & Health Diagnostics**: Live inspection tab displaying Autotask REST API latency and zone endpoint, Datto BCDR API status and cache TTL headroom, Azure Table Storage entity counts (`Exclusions`, `TrackedTickets`, `AuditLogs`), and 30-minute Auto-Heal background scanner heartbeat.
  - **Autotask Live Routing & Picklists**: Live management tab permitting Administrators to inspect and change default escalation Queues, Ticket Priorities, Categories, and Work Types directly through the dashboard UI. Persisted to Azure Table Storage under `SystemConfig/Autotask/Routing` without modifying Azure App Settings or restarting instances.
  - Protected administrative actions integrated natively into `backupWatchTrigger` via `?action=adminDiagnostics` and `?action=adminRouting` (supporting GET and POST), strictly enforcing `userSec.role === 'Administrator'` (returning `403 Forbidden` for non-admin callers) while accessing true live in-memory cache statistics and avoiding routing/warm-up latency.
- **Emergency Override Mute (Administrator Privilege)**:
  - Added `🚨 Emergency Override (Bypass Mandatory Ticket #)` checkbox to Mute/Silence modals, visible exclusively to Administrators.
  - Allows immediate silencing of appliances, agents, or volumes during critical P1 incidents before a Service Desk ticket is logged.
  - Automatically sets ticket reference to `[OVERRIDE: EMERGENCY OUTAGE]` and stamps dedicated `Emergency Override Mute` action into the Audit Trail for governance and tracking.
  - Backend `POST /api/exclusions` validates caller's Administrator role before bypassing the mandatory ticket constraint.

## [1.19.1] - 2026-09-02

### Fixed
- **Audit Trail Log Role & Claims Authentication**:
  - Enhanced backend `getUserSecurityContext` in `shared/auth.ts` to decode JWT Bearer tokens passed by `AadHttpClient` (`Authorization: Bearer <token>`), extracting user identity, email, and group claims.
  - Added support for client-provided role and identity headers (`x-user-role`, `x-user-email`) and query parameters (`?role=...&user=...`) to ensure seamless identity propagation from SPFx.
  - Fixed Audit Trail modal in `BackupWatch.tsx` to pass authenticated role headers and query parameters when calling `GET /api/auditlogs`.
  - Added distinct error messaging in the Audit Trail modal when log retrieval fails or encounters access restrictions, preventing empty table masking.

## [1.19.0] - 2026-09-02

### Added
- **Entra ID Security Group Role-Based Access Control (RBAC)**:
  - Dynamic user role evaluation using Microsoft Graph (`/v1.0/me/transitiveMemberOf`) and Azure Easy Auth token claims (`X-MS-CLIENT-PRINCIPAL`).
  - Support for 4 distinct security tiers:
    - `BackupWatch-Administrator` (`f146d61d-c629-4685-b757-5d560195a98a`): Global administrative authority, all features unlocked.
    - `BackupWatch-Specialist` (`ca9d0b2c-6f9f-4b94-864c-1cca786dc52d`): Senior infrastructure engineers. Unlocks permanent exclusions (`isPermanent: true`), cache force refresh (`?force=true`), and all operational actions.
    - `BackupWatch-Contributor` (`d19f391a-6aba-4a25-87b3-aff059c0ff40`): Frontline support. Temporary exclusions (1–30 days), ticket escalations, unmuting, and audit logs. Restricted from creating permanent exclusions and from bypassing cache.
    - `BackupWatch-Viewer` (`f17fa29e-7ea8-405e-b04a-15a6a8fe2f60`): Read-only view. All modification, silence, mute, ticket escalation, audit logs, and cache bypass controls hidden on UI and blocked with `403 Forbidden` on API.
  - Active security role badge in the dashboard header next to the operator name (`[ Administrator ]`, `[ Specialist ]`, `[ Contributor ]`, `[ Viewer ]`).
  - Graph API permission requests (`User.Read`, `GroupMember.Read.All`) added to `package-solution.json`.
  - Offline RBAC authorization test suite (`test_rbac_authorization.js`).

### Changed
- **Exclusion & Silence Modal**:
  - Disabled the `♾️ Permanent` radio button with a tooltip indicator (`(Specialist Only)`) when accessed by `Contributor` roles.
- **Audit Logs**:
  - Enriched audit log entries to record the caller's verified email and security role alongside ticket details.

### Security
- Implemented backend RBAC authorization middleware in `shared/auth.ts`:
  - `POST /api/exclusions`: Blocks `Viewer` (403); blocks `Contributor` from creating permanent exclusions (403).
  - `DELETE /api/exclusions`: Blocks `Viewer` from unmuting or removing exclusions (403).
  - `POST /api/escalate`: Blocks `Viewer` from escalating Autotask tickets (403).
  - `GET /api/auditlogs`: Blocks `Viewer` from viewing operational audit trail logs (403).
  - `GET /api/backupWatchTrigger?force=true`: Restricts cache bypass to `Specialist` and `Administrator` roles; downgrades unauthorized calls to serve cached data.

---

## [1.18.1] - 2026-09-02

### Fixed
- **Volume Exclusion Deduplication**:
  - Pre-deduplicated incoming Datto `unprotectedVolumeNames` arrays into a unique Set of canonical drive names (`["D", "D:\"]` $\rightarrow$ `["D"]`), preventing duplicate sequential Autotask compliance tickets.
  - Enforced internal canonical normalization in `createComplianceTicket` so ticket titles and descriptions are consistently formatted (e.g. `... - D`, never `... - D:\`).
  - Added `queryOpenTicketByTitle` in `shared/autotask.ts` to check for existing open compliance tickets before creating a new ticket.
  - Resolved UI duplicate drive badge rendering by wrapping volume rendering in canonical array deduplication.

---

## [1.18.0] - 2026-08-20

### Added
- **Mandatory Autotask Ticket ID Enforcement**:
  - Enforced mandatory ticket number validation across all three silence and exclusion tiers (Device, Agent, Volume).
  - Added visual validation states in the SPFx modal, disabling the confirm button until valid ticket numbers and reasons are provided.
  - Enriched `AuditLogs` entities with linked ticket numbers.

### Security
- Strict backend validation in `POST /api/exclusions` returning `400 Bad Request` if a ticket number is missing.

---

## [1.17.0] - 2026-08-19

### Added
- **Ticket Linking for Appliance & Agent Silence**:
  - Expanded SPFx modal input to accept Autotask Ticket numbers for Device and Agent mutes.
  - Unified `/api/exclusions` to resolve ticket URLs and post maintenance worklog notes to existing Autotask tickets.

---

## [1.16.0] - 2026-08-17

### Added
- **Proactive Volume Pre-Exclusion**:
  - Enabled pencil button on protected volume rows for planned maintenance.
  - Amber badge styling (`PRE-EXCLUDED (PLANNED)`) for proactive exclusions.
  - Automatic Autotask worklog note integration on pre-exclusions.

---

## [1.14.3] - 2026-08-17

### Fixed
- **Ticket Deduplication on Note Updates**:
  - `/api/exclusions` queries Azure Table Storage to look up and retain existing `ticketNumber`/`ticketUrl` before ticketing.
  - Existing tickets receive worklog update notes instead of generating duplicate tickets.

---

## [1.14.0] - 2026-08-13

### Added
- **Appliance-Level Silence Cascading**:
  - Created `isDeviceOrVolumeExcluded` and `isDeviceSilenced` helpers in `shared/volumeUtils.ts`.
  - Muting an entire Datto appliance suppresses all alert handling and compliance ticketing for child agents and volumes.

---

## [1.12.0] - 2026-08-12

### Added
- **Temporary vs. Permanent Volume Exclusion Lifecycle**:
  - Added Duration Policy controls (Temporary vs. Permanent) with duration options (1, 3, 7, 14, 30 days).
  - Background 3-day expiry sweep in `backupWatchTimerTrigger` to append reminder notes on open tickets and spawn follow-ups on closed tickets.
  - Automatic Autotask ticket status update to `Action Required` upon exclusion expiration.

---

## [1.10.0] - 2026-07-15

### Added
- **Audit Trail System**:
  - Persisted user actions in Table Storage under the `AuditLogs` table.
  - Added `📜 Audit Trail` modal in SPFx dashboard header.

---

## [1.9.0] - 2026-06-25

### Added
- **Phase 2 Compliance Engine & Background Scanner**:
  - Automatic Autotask compliance ticket creation for BCDR volume exclusions.
  - Background Azure Function timer trigger (`backupWatchTimerTrigger`) running every 30 minutes for scanning and Auto-Heal sweeps.
  - Overdue Backups (>24h) metric card.

---

## [1.8.0] - 2026-06-24

### Changed
- **Next-Gen UI/UX Overhaul**:
  - Light glassmorphic mode with theme toggler saved to `localStorage`.
  - Responsive layouts scaling across mobile and desktop viewports.

---

## [1.6.0] - 2026-06-23

### Added
- **Autotask Integration & Auto-Heal Engine**:
  - Configured Autotask Queue, Category, Ticket Type, Source, and Work Type settings.
  - Plain-English templates for 6 core alert types (Backup Failure, Screenshot Failure, Low Storage, Offline, Paused Agent, Offsite Sync).
  - Stateful Auto-Heal engine to post resolution notes and resolve tracked tickets when alerts clear.
  - Click-to-copy diagnostic brief buttons.

---

## [1.0.0] - 2026-06-19

### Added
- Initial live production deployment of BackupWatch.
- Microsoft Entra ID Single Sign-On (SSO) with Azure Easy Auth.
- Exclusions CRUD API in Azure Table Storage.
- Active vs. Cancelled subscription tabs.
- Real-time Datto BCDR status monitoring and agent cards.
