# BackupWatch Memory Log

## Project Overview
BackupWatch is a stateless MSP operations dashboard running natively inside Microsoft 365, combining Datto BCDR data entirely in memory. It uses concurrent API retrieval and memory caching inside a serverless Azure Function proxy to avoid API throttling. A lightweight Azure Table Storage table persists user-defined volume and device exclusion rules server-side to support future automation pipelines.

## Infrastructure: Current Live State (as of 2026-06-19)

### Azure Backend
- **Function App**: `backupwatch-api` on Flex Consumption (Linux), UK South region.
- **Live Endpoint**: `https://backupwatch-api-e7bsfnanaqdhd7f7.uksouth-01.azurewebsites.net/api/backupWatchTrigger`
- **Exclusions Endpoint**: `https://backupwatch-api-e7bsfnanaqdhd7f7.uksouth-01.azurewebsites.net/api/exclusions`
- **App Settings**: `DATTO_KEY` contains `PublicKey:SecretKey` credential pair.
- **Easy Auth**: Microsoft Identity Provider configured. Allowed token audience includes `api://04de3dc9-a4e8-4bba-9957-925668bbe027`.
- **Table Storage**: `Exclusions` table exists in the storage account attached to the Function App.

### Entra ID App Registration
- **Name**: BackupWatch-Backend-API
- **Client ID**: `04de3dc9-a4e8-4bba-9957-925668bbe027`
- **App ID URI**: `api://04de3dc9-a4e8-4bba-9957-925668bbe027`
- **Exposed Scope**: `user_impersonation`
- **Tenant**: Single-tenant (fifosys365 tenant)

### SharePoint Frontend
- **SPFx Solution**: `backup-watch-scaffold.sppkg` deployed to the fifosys365 Tenant App Catalog.
- **Project Location**: `C:\AG\BackupWatchScaffold` (SPFx v1.19.0, Node v24 patched)
- **Source Files**: `C:\AG\FifoDash\spfx-client\src\webparts\backupWatch\`
- **Deployment Site**: `https://fifosys365.sharepoint.com/sites/BackupWatchPortal`
- **Web Part Property - Endpoint URL**: `https://backupwatch-api-e7bsfnanaqdhd7f7.uksouth-01.azurewebsites.net/api/backupWatchTrigger`
- **Web Part Property - Resource ID**: `api://04de3dc9-a4e8-4bba-9957-925668bbe027`
- **SPFx API Permission**: `BackupWatch-Backend-API / user_impersonation` — Approved in SharePoint Admin.

## Architectural Context
- **Project Structure**: Monorepo at `C:\AG\FifoDash`:
  - `/spfx-client`: Source-only React/TypeScript SPFx web part files.
  - `/stateless-backend`: Azure Function Node.js/TypeScript backend.
- **Build Project**: `C:\AG\BackupWatchScaffold` — SPFx v1.19.0 scaffolded project used for compiling and packaging.
- **Cache Mechanism**: Global `cachedData` / `cacheTimestamp` variables in Azure Function runtime. TTL: 5 minutes.
- **Background Scanner Timer**: Configured via Azure Function timer trigger (`backupWatchTimerTrigger`) to run every 30 minutes (`0 */30 * * * *`). It executes the pipeline with `forceRefresh = true`, bypassing the 5-minute cache to pull live BCDR data, check Autotask updates, scan volume exclusions, and run the Auto-Heal engine.
- **Appliance Sorting**: Always sort appliances in alphabetical order by their device name (`deviceName`) in the API response or React presentation layer.

## Datto API Details (Confirmed Working)
- **Endpoint**: `https://api.datto.com/v1/bcdr/device` — returns `{ items: [...] }` paginated.
- **Asset/Volume Endpoint**: `https://api.datto.com/v1/bcdr/device/{serialNumber}/asset` — fetched concurrently for all devices.
- **Auth**: HTTP Basic Auth, Base64-encoded `PublicKey:SecretKey`.
- **Credential Key**: `DATTO_KEY` in Azure App Settings.
- **Response Fields Used**: `name`, `model`, `serialNumber`, `localStorageUsed.size`, `localStorageAvailable.size`, `alertCount`, `hidden` (used to check if hidden), `servicePeriod` (used to check if service plan is expired).
- **Storage Calc**: `(used / (used + available)) * 100`
- **Alert Mapping**: `alertCount === 0` → `Success`, `alertCount > 0` → `Failed`.
- **Subscription Mapping**: A subscription is active if and only if `device.hidden === false` and `new Date(device.servicePeriod) > new Date()`. If `hidden === true` or `servicePeriod` has expired (date is in the past), the device is cancelled/inactive.
- **API Pagination**: The Datto BCDR REST API uses underscore-prefixed query parameters (`_page` and `_perPage`) for pagination. If pagination parameters are omitted or `_page` is queried without `_perPage`, the API limits returned items to 100 or 25. To retrieve all 118 items in a single call, set `_page=1&_perPage=250`.

## Exclusions System
- **Table**: `Exclusions` in Azure Table Storage.
- **RowKey format**: `Type:Target` (URL-encoded), e.g., `Device%3AMyServer`, `Agent%3AMyAppliance%3AMyServer` or `Volume%3AMyServer%3AD%3A%5C`.
- **Fields**: `type` (Device|Agent|Volume), `target`, `reason`, `createdTime`, `isPermanent` (boolean), `isUnconfigured` (boolean), `expiresAt` (ISO string), `ticketNumber` (string), `ticketUrl` (string).
- **3-Tier Silence & Exclusion Architecture (v1.15.0)**:
  - **Tier 1: Appliance Silence (`type === "Device"`) (Total Blackout)**:
    - Silences entire appliance (all child agents & drives).
    - 0 Autotask API calls, 0 ticket creations/updates, 0 Auto-Heal sweeps, complete suppression of all red alert tags (`Offline`, `Backup Fail`, `Screenshot Fail`, `Storage Critical`).
    - Triggered via dedicated **`[ 🔇 Silence Appliance ]`** button on the main appliance table row.
  - **Tier 2: Agent Silence (`type === "Agent"`) (Server Blackout)**:
    - Target: `${deviceName}:${agentName}`.
    - Silences only the specific VM/server (all backup checks, screenshot tests, paused alerts, and drive exclusions for that server).
    - Sibling servers on the same Datto appliance remain 100% actively monitored.
    - Triggered via dedicated **`[ 🔇 ]`** icon on the agent card header.
  - **Tier 3: Volume Exclusion (`type === "Volume"`)**:
    - Target: `${deviceName}:${agentName}:${volumeName}`.
    - Scoped strictly to that specific drive letter without muting the agent or appliance.
    - Triggered via dedicated **`[ ✏️ ]`** pencil icon next to the drive letter.
- **Ticket Deduplication on Note Updates**: When an existing exclusion is updated (e.g. note/reason or policy changed), `/api/exclusions` queries the existing Table Storage entity first to retain `ticketNumber` and `ticketUrl`. It posts an update note to the existing ticket rather than creating a duplicate compliance ticket. If the parent appliance or agent is silenced, ticket creation & note pushes are completely suppressed.
- **Entra ID Security Group Role-Based Access Control (RBAC) (v1.19.0)**:
  - **Security Groups**:
    - `BackupWatch-Administrator` (`f146d61d-c629-4685-b757-5d560195a98a`): Global administrative authority, all features unlocked.
    - `BackupWatch-Specialist` (`ca9d0b2c-6f9f-4b94-864c-1cca786dc52d`): Permanent exclusions (`isPermanent: true`), cache force refresh (`?force=true`), all operational actions.
    - `BackupWatch-Contributor` (`d19f391a-6aba-4a25-87b3-aff059c0ff40`): Frontline support. Temporary exclusions (1–30 days), ticket escalations, unmuting, audit logs. Restricted from creating permanent exclusions and from bypassing cache.
    - `BackupWatch-Viewer` (`f17fa29e-7ea8-405e-b04a-15a6a8fe2f60`): Read-only view. All modification, silence, mute, ticket escalation, audit logs, and cache bypass controls hidden on UI and blocked with `403 Forbidden` on API.
  - **Backend Enforcement**: Evaluated in `stateless-backend/shared/auth.ts` via Easy Auth claims in `X-MS-CLIENT-PRINCIPAL`. Protected endpoints: `POST/DELETE /api/exclusions`, `POST /api/escalate`, `GET /api/auditlogs`, and `GET /api/backupWatchTrigger?force=true`.
  - **SPFx Graph Lookup**: SPFx queries `/v1.0/me/transitiveMemberOf?$select=id,displayName` to resolve user's highest role dynamically and render the security role badge in the header.
- **DELETE bug**: Resolved — backend retries with URL-decoded ID if first attempt fails.

## SPFx Build & Layout Process
1. Edit source in `C:\AG\FifoDash\spfx-client\src\webparts\backupWatch\`.
2. Copy to `C:\AG\BackupWatchScaffold\src\webparts\backupWatch\`.
3. **Bump the version across all 3 files**:
   - `C:\AG\BackupWatchScaffold\config\package-solution.json` (`version` field, format: `MAJOR.MINOR.PATCH.0`)
   - `C:\AG\BackupWatchScaffold\package.json` (`version` field, format: `MAJOR.MINOR.PATCH`)
   - `C:\AG\BackupWatchScaffold\src\webparts\backupWatch\BackupWatchWebPart.manifest.json` and `C:\AG\FifoDash\spfx-client\src\webparts\backupWatch\BackupWatchWebPart.manifest.json` (`version` field, format: `MAJOR.MINOR.PATCH`)
   *(This ensures `this.context.manifest.version` in `BackupWatchWebPart.ts` correctly passes the updated version to the React component header and footer).*
4. Run `npx gulp bundle --ship && npx gulp package-solution --ship` from `C:\AG\BackupWatchScaffold`.
5. Upload `sharepoint\solution\backup-watch-scaffold.sppkg` to App Catalog.
6. **Layout Caching Gotcha**: When modifying manifest layout capabilities (like `supportsFullBleed`), you must delete the web part from the page, republish the page, add a new **Full-width section**, and then insert the web part back to clear the edit cache.
7. **No-Navigation Embedded View**: Append `?env=WebView` or `?env=Embedded` to modern page URLs to automatically strip all SharePoint navigation headers, menus, and footer banners.

## Versioning Policy (BackupWatch .sppkg)

Version format: **MAJOR.MINOR.PATCH** (bump before every build and upload to App Catalog)

### When to bump MAJOR (e.g. 1.x → 2.0)
- Complete redesign of the dashboard layout or UX paradigm
- Breaking change to how data is fetched (e.g. new API, new auth scheme)
- Major new standalone feature set (e.g. adding a second web part, multi-tenant support)
- Any change that requires users to re-add the web part to a page

### When to bump MINOR (e.g. 1.0 → 1.1)
- New visible feature added (new column, new section, new page/tab)
- New backend field surfaced in the UI
- Non-breaking behaviour change that users will notice (e.g. card layout change, new tag logic)
- Any change to agent card content, table columns, or metric tiles

### When to bump PATCH (e.g. 1.1.0 → 1.1.1)
- Bug fix, encoding fix, or typo correction
- Style tweak (colour, spacing, font size) with no layout change
- Performance or cache tuning with no visible output change

### Version Comments Requirement
After every build/rebuild and upload of the `.sppkg` package, the AI assistant **MUST** append a "Version Comments" section at the very end of its response to the user. This section must explicitly detail the changes included in the package for that version.

### Changelog Maintenance (Keep a Changelog)
Maintain `CHANGELOG.md` in the repository root adhering to the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format and Semantic Versioning. Each release must be logged under categories `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Security`.

### Release Log
| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-06-19 | Initial live deployment. SSO, exclusions CRUD, subscription tabs, agent cards. |
| 1.1.0 | 2026-06-22 | Phase 2 refinements: company name, storage %, multi-tag status, screenshot links, pencil on excluded volumes. |
| 1.1.1 | 2026-06-22 | Fix UTF-8 encoding corruption (pencil, chevron, arrow, monitor icons). Pencil removed from included volumes. Last Backup section always visible. |
| 1.2.0 | 2026-06-22 | Fixed backend `lastBackupStatus` mapping — now correctly parses the latest backup from the Datto BCDR `backups` array (flat fields like `lastBackupEpoch` do not exist in the API payload) and surfaces it on every agent card. |
| 1.3.0 | 2026-06-22 | Interactive metric card filtering with hover animations and selected state. Option 2 (Minimalist Pressed State) visual style applied. |
| 1.4.0 | 2026-06-22 | Auto-Full Screen Focus Mode enabled on default URL /sites/BackupWatchPortal/SitePages/Home.aspx. Excludes edit mode (?Mode=Edit). |
| 1.4.1 | 2026-06-22 | Bugfix: exclusion notes for both protected and unprotected volumes now read from the live `state.exclusions` list (bypassing the 5-minute Datto API cache) via `_getVolumeExclusionReason` helper. Custom notes appear instantly after saving. |
| 1.5.0 | 2026-06-23 | Added Last Seen Heartbeats column, native AutoTask company and device mapping, stateful ticket deduplication/tracking via Azure Table Storage, and inline/bulk ticket escalation UI. |
| 1.6.0 | 2026-06-23 | Added Autotask Queue, Category, Ticket Type, Source, and Work Type settings, dynamic "Datto BCDR" contract resolution, plain-English jargon-free description templates for all 6 alerts, stateful Auto-Heal engine for automatic resolution note posting, and click-to-copy clipboard brief buttons. |
| 1.6.1 | 2026-06-23 | Fixed extra dollar sign rendering prefix on Autotask ticket IDs in JSX layouts, and widened agent card grid layouts to minmax 310px. |
| 1.6.2 | 2026-06-23 | Fixed Autotask ticket URLs to use correct zone-resolved portal path (ServiceDesk/TicketDetail.mvc/Index) instead of hardcoded ww14 Navigation.mvc. Dashboard now displays user-facing ticket numbers (e.g. T20260623.0166) instead of raw database IDs. Agent cards widened to minmax(416px, 1fr). Backend stores ticketNumber and ticketUrl in TrackedTickets table storage. |
| 1.6.3 | 2026-06-24 | Fixed Autotask closed ticket status syncing and fuzzy company name matching fallback. Rebuilt SPFx package version 1.6.3.0. |
| 1.7.0 | 2026-06-24 | Added Fifosys BackupWatch branding, dynamic version in header, agent panel filtering matching active metrics, blank fallback exclusions notes, client-side pagination, search bar, and professional footer. Rebuilt SPFx package version 1.7.0.0. |
| 1.7.1 | 2026-06-24 | Fixed volume exclusions card sum count discrepancy. Fixed Last Seen column rendering and backend offline detection check. Rebuilt SPFx package version 1.7.1.0. |
| 1.7.2 | 2026-06-24 | Implemented fallback Autotask Configuration Item (Asset) lookup chain (agent name -> serial number -> device name) and updated ticket subject formatting to mimic Datto email alerts. |
| 1.7.3 | 2026-06-24 | Fixed offline status detection by returning isOffline and status from backend, and renamed Offline Devices to Offline Appliances. Rebuilt SPFx package version 1.7.3.0. |
| 1.8.0 | 2026-06-24 | Next-Gen UI/UX Overhaul: Transitioned from default dark mode to light glassmorphic mode with theme toggler (saving choice to localStorage). Vibrant Orange accents, responsive content layouts scaling down to mobile screen sizes, and modern gradient layouts. |
| 1.8.1 | 2026-06-24 | Next-Gen UI/UX styling adjustments: reordered and styled header buttons (repositioned and shrunk theme toggle to sun/moon icon after exclusions config button), added absolute positioning to search icon, widened agent cards to minmax(450px), and styled light mode volume rows with border/panel tokens for clear visual separation. |
| 1.8.2 | 2026-06-24 | Fixed search input box overflow bug by adding box-sizing: border-box rules for the root component and the search input box inside the injected CSS stylesheet. Rebuilt SPFx package version 1.8.2.0. |
| 1.9.0 | 2026-06-25 | Phase 2 features v1.9.0 release: Dark Orange theme color (#c2410c), Overdue Backups (&gt;24h) metric card, cascading device alert mute, Autotask compliance ticket creation for volume exclusions, and background Azure Function timer trigger scanning and auto-healing every 30 minutes. Rebuilt SPFx package version 1.9.0.0. |
| 1.9.1 | 2026-06-25 | Hotfix: Removed emojis (🚨, 📋, ⚙️, 👉, 🔗, 💚) from ticket descriptions and notes, replacing them with clean plain-text labels to prevent Autotask from rendering them as double question marks (??). Rebuilt SPFx package version 1.9.1.0. |
| 1.9.2 | 2026-06-25 | Phase 2 Feature: Added auto-ticketing and register logic for Datto-native unprotected/excluded volumes in the background scanning pipeline. Rebuilt SPFx package version 1.9.2.0. |
| 1.9.3 | 2026-06-25 | Bugfix: Resolved Autotask compliance ticketing failure for BCDR volume exclusions. Implemented `createComplianceTicket` helper in `shared/autotask.ts` with 4-level fallback lookup chain (agent asset -> appliance asset -> company name match -> catch-all company). Added conditional DB persistence (only saves to Table Storage on ticketing success). Cleaned up 123 stale `undefined` ticketNumber records from live Exclusions table. Backend-only fix; no SPFx package rebuild required. |
| 1.9.4 | 2026-06-25 | Rebuilt SPFx package version 1.9.4.0. CSS fixes for 3 column misalignment bugs (chevron width, model/lastseen/exclusion column width definitions, backup status min-width). Added ticket status syncing for native exclusions (deletes exclusion record from database if Autotask ticket is completed and no user note exists, allowing re-ticketing). Skip archived agents in scanner ticketing loop. Removed AUDIT RECORD ticket subject prefix. |
| 1.9.5 | 2026-06-25 | Hotfix: Fixed excessive column gap in the appliance table. Applied fixed-width CSS classes (.bw-col-name, .bw-col-storage, .bw-col-status, .bw-col-actions) to all columns (headers and data cells) to enforce uniform column alignment across all rows. Rebuilt SPFx package version 1.9.5.0. |
| 1.9.6 | 2026-06-30 | Skip native exclusion compliance ticketing for cancelled/inactive appliances. Shipped cleaner compliance ticket description templates. Surfaced formatted Autotask Ticket Numbers (T20260630.0001) as clickable links in volume rows and Settings panel. Switched backend ticket lookup to direct GET to bypass indexing delays. Ran database repair to update all existing numeric ticket numbers to formatted ticket numbers. Rebuilt SPFx package version 1.9.6.0. |
| 1.10.0 | 2026-07-15 | Implemented Audit Trail logs system (persisted in Table Storage under AuditLogs table), updated default ticket creation priority to 2 (Medium) in Autotask, customized ticket subjects for screenshot alert escalations, and styled metric tiles green when their counts equal zero. Rebuilt SPFx package version 1.10.0.0. |
| 1.10.1 | 2026-07-15 | Hotfix: Applied inline CSS styles to the Audit Trail modal overlay and content wrapper to match the style pattern of other modals, fixing the issue where the modal was invisible/unstyled. Rebuilt SPFx package version 1.10.1.0. |
| 1.10.2 | 2026-07-15 | Styled Total Appliances card green permanently, merged device serial number into Model column, and renamed column to Model / Serial. Backend patch: Abort auto-ticketing if Exclusions load fails and restrict ticketing to background timer. Rebuilt SPFx package version 1.10.2.0. |
| 1.11.0 | 2026-07-28 | Resolved mute button toggling issue by checking Device-level exclusions directly, split backend cache to dynamically map exclusions on cache hits, and implemented automated scan status tracking in the footer. Rebuilt SPFx package version 1.11.0.0. |
| 1.12.0 | 2026-08-12 | Temporary vs. Permanent Volume Exclusion Lifecycle Management: Added Temporary/Permanent radio controls, duration dropdown (1, 3, 7, 14, 30 days), and Autotask ticket number input to SPFx mute modal. Backend API (`/api/exclusions`) and Timer Trigger Scanner (`backupWatchTimerTrigger`) support `isPermanent`, `expiresAt`, Autotask worklog note push on reason update, 3-day expiry sweep (reminder note on open ticket, new follow-up ticket on closed ticket), and resolution notes on re-added volumes without ticket auto-closing. Rebuilt SPFx package version 1.12.0.0 and published backend to `backupwatch-api`. |
| 1.12.1 | 2026-08-12 | Hotfix: Fixed state leak bug in SPFx `_openMuteModal` where modal policy state leaked from previous edit sessions. Added Policy column (`♾️ Permanent` / `🕒 Temp`) to Active Exclusions table. Removed manual ticket number input. Rebuilt SPFx package version 1.12.1.0. |
| 1.12.2 | 2026-08-12 | Hotfix: Fixed footer scan status timezone rendering bug by removing redundant `new Date()` parsing on pre-formatted UK timezone strings. Rebuilt SPFx package version 1.12.2.0. |
| 1.12.3 | 2026-08-12 | Expiry Sweep Upgrade: Updated temporary exclusion expired reminder note to explicitly instruct engineers how to resolve, extend, or permanently exclude volumes. Automatically updates Autotask ticket status to 'Action Required' (via dynamic picklist lookup with fallback to `AUTOTASK_ACTION_REQUIRED_STATUS_ID`/`8`). Deployed to live Function App `backupwatch-api`. |
| 1.13.0 | 2026-08-13 | Fixed initial compliance ticket classification (`isPermanent: false`, `isUnconfigured: true`), added `🎫 Active Ticket` badge rendering in SPFx Active Exclusions table, and implemented automatic ticket re-creation when compliance tickets are completed in Autotask while volumes remain unprotected in Datto. Rebuilt SPFx package version 1.13.0.0. |
| 1.14.0 | 2026-08-13 | Implemented Appliance-Level Mute Cascading: Created `isDeviceOrVolumeExcluded` helper in backend scanner (`backupWatchTrigger`). Muting an entire Datto appliance now completely suppresses all alert handling—including native volume exclusion compliance ticketing—for all agents/volumes on that appliance. Rebuilt SPFx package version 1.14.0.0 and published backend to `backupwatch-api`. |
| 1.14.1 | 2026-08-13 | Hotfix: Updated exclusion badge rendering condition in `BackupWatch.tsx` to require `reason && reason.trim().length > 0` for displaying the `🕒 Temp` badge. Newly created initial compliance tickets now correctly display `🎫 Active Ticket` instead of `🕒 Temp (3D LEFT)`. Rebuilt SPFx package version 1.14.1.0. |
| 1.14.2 | 2026-08-13 | Hotfix: Purged 100% of non-ASCII emojis across all backend Autotask ticket creation, worklog note, and exclusion update templates, replacing them with clean ASCII plain-text markers. Deployed live to Function App backupwatch-api. |
| 1.14.3 | 2026-08-17 | Bugfix: Fixed duplicate Autotask ticket creation when updating exclusion notes/policies. Backend `/api/exclusions` now queries Azure Table Storage to look up and retain existing `ticketNumber` / `ticketUrl` before checking whether a new ticket is needed. Existing tickets receive worklog update notes instead of spawning new tickets. SPFx modal `_openMuteModal` and `_addExclusion` updated to retain and pass existing `ticketNumber`. |
| 1.16.0 | 2026-08-17 | Implemented Proactive Volume Pre-Exclusion (Option 2, Approach B): Enabled pencil button on protected volume rows, amber theme styling (PRE-EXCLUDED (PLANNED)), and Autotask worklog note integration. Rebuilt SPFx package version 1.16.0.0. |
| 1.17.0 | 2026-08-19 | Autotask Ticket ID Linking for Appliance & Agent Silence: Enabled optional ticket number input across all 3 silence tiers (Device, Agent, Volume). Backend `/api/exclusions` resolves ticket URL and posts maintenance worklog notes to existing Autotask tickets without generating duplicate tickets. Left blank, silence actions remain completely local/non-ticketing (0 Autotask calls). Preserves existing ticketNumber/ticketUrl and createdTime. Rebuilt SPFx package version 1.17.0.0. |
| 1.18.0 | 2026-08-20 | Mandatory Autotask Ticket ID Enforcement for all 3 silence and exclusion tiers (Device, Agent, Volume). Enforced mandatory field validation in SPFx modal UI (disabling confirm button until ticket number and reason are entered, with visual validation indicator) and strict backend validation in POST `/api/exclusions` returning HTTP 400 Bad Request if ticket number is missing. Enriched Audit Trail logs with linked ticket number. Rebuilt SPFx package version 1.18.0.0. |
| 1.18.1 | 2026-09-02 | Volume exclusion deduplication fix: canonical drive letter normalization and deduplication in backend scanner and Autotask ticketing, plus queryOpenTicketByTitle duplicate check. |
| 1.19.0 | 2026-09-02 | Entra ID Security Group Role-Based Access Control (RBAC): Dynamic role assignment via Microsoft Graph transitiveMemberOf and Azure Easy Auth. 4-tier security hierarchy (Administrator, Specialist, Contributor, Viewer) enforced across UI and API endpoints. Rebuilt SPFx package version 1.19.0.0. |
| 1.19.1 | 2026-09-02 | Hotfix for Audit Trail Logs: Enhanced backend auth to decode JWT Bearer tokens from AadHttpClient and accept role/user query and header parameters. Added audit error state display in SPFx modal. Rebuilt SPFx package version 1.19.1.0 and deployed live backend to backupwatch-api. |
| 1.20.0 | 2026-09-02 | Administrator-Exclusive Features: Added Administrator Console (`⚙️ Admin Console`) with System & Health Diagnostics (live API latency, Datto cache TTL, entity counts, scanner status) and Autotask Live Routing & Picklists management persisted dynamically to Azure Table Storage (`SystemConfig`). Implemented Emergency Override Mute for Administrators bypassing mandatory ticket requirement during critical incidents. Rebuilt SPFx package version 1.20.0.0 and deployed live backend to backupwatch-api. |
| 1.21.0 | 2026-09-02 | Global Alert Blackout Maintenance Mode (`🚨 Alert Blackout`), Stale Entity Cleanup Tool (`🧹 Entity Cleanup`), CSV Audit Trail Log export (`📥 Export to CSV`), and Live Autotask Connection Tester & Asset Reconciliation (`🔍 Asset Diagnostic`). |
| 1.22.0 | 2026-09-03 | Alert-Specific Routing & Classification Matrix for 7 core operational alert types with dynamic ticket titles and independent auto-ticketing switches. |
| 1.22.1 | 2026-09-07 | Hotfix: Propagate RBAC user role & email on all exclusions and escalation API calls, eliminate silent modal save failures, fix stale ticket URL reuse on exclusion updates, and preserve ticket references on silenced items. |

## Phase 2: Planned Features (Approved for Implementation 2026-06-19)
1. **Subscription Tabs**: Separate view for Active vs Cancelled appliances. Default tab: Active.
2. **Agent-Level Status**: Pull agents for all appliances. Show status (Paused, Archived, Active).
3. **Storage Usage Column**: Show `Used GB / Total GB` with a visual bar per appliance.
4. **Volume Exclusion Count**: Show total active exclusions per appliance (and per agent). List exactly which volumes are excluded.
5. **Inline Exclusion Notes**: Display the reason/note next to excluded volumes. Persisted in Table Storage until removed.
6. **Archived Agent Exclusions Ignored**: Volume exclusions for Archived agents are NOT counted toward appliance totals.
7. **Phase 2 Refinements**:
    - Custom notes/pencil icons enabled on natively excluded (`unprotected`) volumes.
    - Card style parity: screenshot links pointing to `lastScreenshotUrl` and unified badge statuses.
    - Local storage column displaying percentage next to capacities.
    - Multi-tag backup status column: vertically stacked in a column when more than 2 tags are active.
    - Client company name displayed directly below the appliance name.

## Team Responsibilities (from rules.md)
- **Frontend Integration Agent**: Modifying SPFx component `BackupWatch.tsx` to handle visual layouts, screenshot links, vertical tag stacking, client company name rendering, and note removal button.
- **Backend Serverless Agent**: Modifying `backupWatchTrigger/index.ts` to enrich payload with companyName, screenshot URL, and unprotected volume exclusions note matching.
- **Project Orchestrator Agent**: Overseeing build compilation, packaging Solution Packages (.sppkg), and verifying stateless integration.

## History
- **2026-06-09**: App renamed from "FifoDash" to "BackupWatch". Team roles defined.
- **2026-06-09**: Scaffolded `/stateless-backend` and `/spfx-client`. Verified live Datto API connection.
- **2026-06-19**: Pivoted from Cloudflare Workers to Azure Function + SPFx architecture.
- **2026-06-19**: Completed full Azure provisioning: Function App (Flex Consumption), Entra ID App Registration, Easy Auth, Table Storage, CORS.
- **2026-06-19**: Implemented exclusions CRUD logic in backend. Developed React exclusions management UI.
- **2026-06-19**: Scaffolded SPFx v1.19.0 build project. Patched Node v24 compatibility. Packaged and deployed `.sppkg`.
- **2026-06-19**: SSO auth working end-to-end. Dashboard live at `https://fifosys365.sharepoint.com/sites/BackupWatchPortal`.
- **2026-06-19**: Approved Phase 2 feature expansion plan.
- **2026-06-19**: Deployed Phase 2 dashboard. Resolved subscription tabs filter by mapping `isActive` to `!device.hidden` to match Datto REST API design. Modified layout to edge-to-edge full width.
- **2026-06-22**: Completed implementation of Phase 2 refinements (natively excluded notes, card style parity, storage percentage, tag column vertical stacking, company names). Code compiled, scaffold bundled, and SharePoint solution packaged (`backup-watch-scaffold.sppkg` ready in scaffold). Backend is prepared for publication via `func publish`.
- **2026-06-22**: Deployed v1.1.1 hotfix — fixed UTF-8 encoding corruption across all emoji/symbol characters. Pencil icon removed from included volumes. Last Backup section now always visible in agent cards (shows Success or Failed badge).
- **2026-06-22**: Released v1.2.0 — fixed backend `lastBackupStatus` field mapping. Datto returns flat fields (`lastBackupEpoch`, `lastBackupStatus` as a string, `lastBackupError`); backend now correctly converts these into the `{ success, time, errorMessage }` object shape. Last Backup section now populated and visible in all agent cards.
- **2026-06-22**: Resolved lastBackupStatus mapping bug by parsing the latest backup from the `backups` array in `backupWatchTrigger/index.ts` (as the API does not contain flat `lastBackupEpoch` fields). Compiled backend successfully.
- **2026-06-22**: Released v1.4.1 — bugfix for exclusion note display. Added `_getVolumeExclusionReason` private helper to `BackupWatch.tsx` that looks up the volume reason from `this.state.exclusions` (un-cached, live data) rather than the cached `agent.excludedVolumes` array. This means custom notes entered via the pencil modal now appear instantly on the agent card without requiring a 5-minute cache expiry. Both protected and unprotected volumes benefit from this fix.
- **2026-06-23**: Released v1.5.1 — completed implementation of Last Seen Heartbeats column and AutoTask native ticket escalation integration (company & asset mapping, stateful deduplication via TrackedTickets). Includes hotfix for Autotask Base URL versioning (dynamically appending `/v1.0/` suffix if omitted by `/zoneInformation` response to prevent HTTP 404/500 errors). Compiled SPFx client side solution and published backend to `backupwatch-api`.
- **2026-06-23**: Released v1.6.0 — implemented Phase 3 Autotask field mappings (Queue, Category, Ticket Type, Source, Work Type) and dynamic contract lookup for "Datto BCDR". Created formatted plain-English templates for 6 derived alert types (Backup Failure, Screenshot Boot Failure, Low Storage, Appliance Offline, Paused Agent, Offsite Sync Issue) with direct device links to Datto Portal. Added stateful Auto-Heal engine in backupWatchTrigger to log success notes and prune tickets when alerts resolve. Implemented Click-to-Copy ticket brief buttons in SPFx UI and published updated backend to `backupwatch-api`.
- **2026-06-23**: Released v1.6.1 — fixed extra dollar sign rendering prefix on Autotask ticket IDs in JSX layouts and widened agent card layouts to minmax 310px.
- **2026-06-23**: Released v1.6.2 — Fixed Autotask ticket URLs to use correct zone-resolved portal path. Dashboard displays user-facing ticket numbers. Backend stores ticketNumber and ticketUrl.
- **2026-06-24**: Released v1.6.3 — Fixed Autotask closed ticket status checking (changed to GET endpoint) and fuzzy company name matching fallback. Compiled and built SPFx package version 1.6.3.0.
- **2026-06-24**: Released v1.7.0 — Added Fifosys BackupWatch branding, dynamic version in header, agent panel filtering matching active metrics, blank fallback exclusions notes, client-side pagination, search bar, and professional footer. Rebuilt SPFx package version 1.7.0.0.
- **2026-06-24**: Released v1.7.1 — Fixed volume exclusions card sum count discrepancy. Fixed Last Seen column rendering and backend offline detection check. Rebuilt SPFx package version 1.7.1.0.
- **2026-06-24**: Released v1.7.2 — Implemented fallback Configuration Item (Asset) lookup chain (agent hostname -> serial number -> device name) using client-side matching/filtering, and updated ticket subject formatting to match Datto email alert styles.
- **2026-06-24**: Released v1.7.3 — Fixed appliance offline status detection by returning status/isOffline from backend, renamed Offline Devices card to Offline Appliances, and rebuilt SPFx package version 1.7.3.0.
- **2026-08-19**: Released v1.17.0 — implemented Autotask Ticket ID Linking for Appliance & Agent Silence.
  - Expanded SPFx modal input in `BackupWatch.tsx` to display the optional Autotask Ticket # field for Device, Agent, and Volume mutes.
  - Unified backend `/api/exclusions` to resolve ticket URLs and push maintenance worklog notes to existing Autotask tickets for all three tiers.
  - Rebuilt SPFx client solution package v1.17.0.0.
- **2026-09-02**: Released v1.19.0 — Entra ID Security Group Role-Based Access Control (RBAC). 4 tiers (Administrator, Specialist, Contributor, Viewer) enforced across UI and API.
- **2026-09-02**: Released v1.19.1 — Hotfix for Audit Trail Logs: enhanced backend auth to decode JWT Bearer tokens from AadHttpClient and accept role/user query parameters and headers.
- **2026-09-02**: Released v1.21.0 — Administrator Suite Expansion:
  - **Global Maintenance Mode / Alert Silence Blackout (`🚨 Alert Blackout`)**:
    - Silences automated compliance ticket creation across all Datto appliances during planned maintenance windows or migrations.
    - Suppresses tickets natively in `createComplianceTicket` within `shared/autotask.ts`.
    - Persisted in Azure Table Storage (`SystemConfig/Global/MaintenanceMode`) with duration options (1h, 2h, 4h, 8h, 24h, 48h), expiration timestamp, and reason tracking.
    - Integrated glowing red hero banner at top of dashboard with instant `⚙️ Manage Blackout` button.
    - Routed through `backupWatchTrigger?action=adminMaintenance` (GET/POST) with Administrator-only authorization.
  - **Stale Ticket & Entity Cleanup Tool (`🧹 Entity Cleanup`)**:
    - Scans `TrackedTickets` and `Exclusions` tables in Azure Table Storage against active Datto BCDR inventory to find decommissioned appliances and orphan records.
    - Bulk purge interface allowing clean removal of stale records with full audit logging.
    - Routed through `backupWatchTrigger?action=adminCleanup` (GET/POST).
  - **Exportable Audit Log Reports (CSV / Compliance Audit)**:
    - Added RFC-compliant `📥 Export to CSV` button directly to the Audit Trail modal.
    - Cleanly exports filtered or full audit trails for compliance audits, ISO inspections, and internal review.
  - **Live Autotask Connection Tester & Asset Reconciliation (`🔍 Asset Diagnostic`)**:
    - Live 4-tier diagnostic resolution tool in Administrator Console for testing appliance serial numbers or server hostnames against Autotask REST API without ticket modification.
    - Reports latency in ms, matched Configuration Item ID, serial number, resolved company name, and active Datto BCDR contract status.
    - Routed through `backupWatchTrigger?action=adminTestAsset` (POST).
- **2026-09-03**: Released v1.22.0 — Alert-Specific Routing & Classification Matrix:
  - **7 Operational Alert Types Covered**:
    1. `VolumeExclusion`: Unprotected volume detected (*Active in production*).
    2. `StorageAlert`: Appliance storage pool $>85\%$ (Warning) or $>90\%$ (Critical).
    3. `LocalBackupFailure`: Latest snapshot run explicitly failed.
    4. `OverdueBackup`: Snapshot overdue $>24\text{ hours}$.
    5. `OffsiteSyncIssue`: Cloud replication backlog $>100\text{ GB}$ or stalled $>48\text{ hours}$.
    6. `ScreenshotFailure`: Daily automated verification boot test failed.
    7. `OfflineAppliance`: Check-in heartbeat overdue $>30\text{ minutes}$.
  - **Granular Autotask Classification & Dynamic Titles**:
    - Per-alert Queue, Priority (`Critical`, `High`, `Medium`, `Low`), Issue Type, and Sub-Issue Type configuration.
    - Dynamic title templates with `{Company}`, `{Device}`, `{Agent}`, `{Detail}` variable interpolation.
  - **Operational Safety Policy (Strict Protection of Production)**:
    - Automated background ticket creation remains **active strictly for Volume Exclusions** as in production today.
    - All other 6 alert types default to `Auto-Ticket: OFF` (Monitoring & Manual Escalation only).
    - Can be toggled on/off selectively by an Administrator when the service desk is ready.
  - **Backend & Storage Architecture**:
    - Stored in Azure Table Storage (`SystemConfig/AlertRouting/<AlertKey>`).
    - Integrated with `backupWatchTrigger?action=adminRouting` (GET/POST).
- **2026-09-07**: Released v1.22.1 — Exclusion Notes Persistence Across RBAC Roles & Ticket Tracking Under Active Exclusions:
  - Propagated `x-user-role` and `x-user-email` headers and URL query parameters on `POST /api/exclusions`, `DELETE /api/exclusions`, and `POST /api/escalate`, ensuring Contributors, Specialists, and Administrators can save notes, unmute, and escalate without being rejected as Viewer (403 Forbidden).
  - Enhanced SPFx error handling in `_addExclusion` and `_removeExclusion` to parse error payloads and display user alerts rather than silently closing modals on HTTP failures.
  - Resolved stale ticket URL reuse in `POST /api/exclusions` when a new ticket number is submitted for an existing exclusion entity, correctly querying Autotask for the new ticket ID/URL and posting maintenance notes to the new ticket.
  - Preserved Autotask ticket references (`backupTicket`, `screenshotTicket`, `statusTicket`) on silenced agents in `backupWatchTrigger`, ensuring linked ticket badges remain visible and clickable on the dashboard while alerts are silenced.
  - Updated storage warning escalation in `BackupWatch.tsx` to verify appliance-level silencing rather than checking `device.backupStatus !== 'Muted'`.



