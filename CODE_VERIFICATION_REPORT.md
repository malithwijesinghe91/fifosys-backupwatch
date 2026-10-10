# BackupWatch (FifoDash) — Read-Only Source Code Verification Report

**Date of Verification:** 2026-10-10  
**Inspection Scope:** Source code only across `stateless-backend/`, `spfx-client/`, and `BackupWatchScaffold/`  
**Execution Mode:** Strictly Read-Only (Zero modifications, zero live writes, zero API calls to Datto, Autotask, or Azure Table Storage)  
**Output Target:** `C:\Projects\FifoDash\CODE_VERIFICATION_REPORT.md`

---

## 1. Environment Variables

### Conclusion
`stateless-backend` reads 21 distinct `process.env.*` keys across its source files.  
**Datto Credentials Confirmation:** Datto credentials are read **exclusively from `DATTO_KEY`** in code. The variable `DATTO_CREDS` is **NEVER read anywhere in source code** (it only appears in documentation at `azure_setup_guide.md:92`, which is a direct doc vs code contradiction).  
**Autotask Credential Discrepancy:** `shared/autotask.ts` reads `AUTOTASK_USER` and `AUTOTASK_SECRET`, whereas `adminDiagnostics/index.ts` checks `AT_USER` and `AT_SECRET`. If standard `AUTOTASK_USER`/`AUTOTASK_SECRET` settings are used, `adminDiagnostics` incorrectly reports Autotask credentials as "Missing".

### Comprehensive Environment Variable Inventory

| # | Environment Variable Key | File & Line Number | Purpose | Default / Fallback in Code |
|---|--------------------------|--------------------|---------|----------------------------|
| 1 | `AzureWebJobsStorage` | `shared/tableService.ts:3` | Connection string for Azure Table Storage | `"UseDevelopmentStorage=true"` |
| 2 | `AzureWebJobsStorage` | `adminDiagnostics/index.ts:28` | Diagnostics probe checking if connection string is configured | None (reports `"Set"` or `"Missing"`) |
| 3 | `DATTO_KEY` | `backupWatchTrigger/index.ts:316` | Datto BCDR REST API Basic Auth token (`PublicKey:SecretKey`) | None (pipeline aborts with 500 error if missing) |
| 4 | `DATTO_KEY` | `backupWatchTrigger/index.ts:1225` | In-memory admin diagnostics status check | None (evaluates to `"Configured & Active"` or `"Not Configured"`) |
| 5 | `DATTO_KEY` | `adminDiagnostics/index.ts:25,36` | Diagnostics endpoint checking if Datto key is configured | None (reports `"Set"` / `"Configured"` or `"Missing"` / `"Not Configured"`) |
| 6 | `AUTOTASK_USER` | `shared/autotask.ts:14` | Autotask API tracking username / API user | None (throws Error `"Autotask API credentials missing from environment."`) |
| 7 | `AUTOTASK_SECRET` | `shared/autotask.ts:15` | Autotask API user secret / password | None (throws Error if missing) |
| 8 | `AUTOTASK_INTEGRATION_CODE` | `shared/autotask.ts:16` | Autotask API tracking integration code | None (throws Error if missing) |
| 9 | `AUTOTASK_CATCHALL_COMPANY_ID` | `shared/autotask.ts:749` | Fallback company ID for automated compliance tickets when CI / company resolution fails | None (`undefined`; if not set, CI fallback fails) |
| 10 | `AUTOTASK_CATCHALL_COMPANY_ID` | `escalateTrigger/index.ts:431` | Fallback company ID for manual escalation tickets when company resolution fails | None (`undefined`; if not set, escalation returns 400 error) |
| 11 | `AUTOTASK_QUEUE_ID` | `shared/configService.ts:27` | Default ticket dispatch queue ID fallback | `undefined` |
| 12 | `AUTOTASK_QUEUE_ID` | `shared/autotask.ts:785` | Queue ID fallback during compliance ticket generation | `undefined` |
| 13 | `AUTOTASK_QUEUE_ID` | `escalateTrigger/index.ts:487` | Queue ID fallback during manual escalation ticket creation | `undefined` |
| 14 | `AUTOTASK_CATEGORY_ID` | `shared/configService.ts:28` | Default ticket category ID fallback | `undefined` |
| 15 | `AUTOTASK_CATEGORY_ID` | `shared/autotask.ts:786` | Ticket category ID fallback during compliance ticket generation | `undefined` |
| 16 | `AUTOTASK_CATEGORY_ID` | `escalateTrigger/index.ts:488` | Ticket category ID fallback during manual escalation ticket creation | `undefined` |
| 17 | `AUTOTASK_TICKET_TYPE_ID` | `shared/autotask.ts:788` | Ticket type ID fallback for compliance tickets | `undefined` |
| 18 | `AUTOTASK_TICKET_TYPE_ID` | `escalateTrigger/index.ts:490` | Ticket type ID fallback for manual escalation tickets | `undefined` |
| 19 | `AUTOTASK_SOURCE_ID` | `shared/autotask.ts:789` | Ticket source ID fallback for compliance tickets | `undefined` |
| 20 | `AUTOTASK_SOURCE_ID` | `escalateTrigger/index.ts:491` | Ticket source ID fallback for manual escalation tickets | `undefined` |
| 21 | `AUTOTASK_WORK_TYPE_ID` | `shared/configService.ts:30` | Allocation code / Work type ID fallback | `undefined` |
| 22 | `AUTOTASK_WORK_TYPE_ID` | `shared/autotask.ts:790` | Allocation code ID fallback for compliance tickets | `undefined` |
| 23 | `AUTOTASK_WORK_TYPE_ID` | `escalateTrigger/index.ts:492` | Allocation code ID fallback for manual escalation tickets | `undefined` |
| 24 | `AUTOTASK_ISSUE_TYPE_ID` | `shared/configService.ts:31` | Issue type ID fallback | `undefined` |
| 25 | `AUTOTASK_ISSUE_TYPE_ID` | `shared/autotask.ts:791` | Issue type ID fallback for compliance tickets | `undefined` |
| 26 | `AUTOTASK_ISSUE_TYPE_ID` | `escalateTrigger/index.ts:493` | Issue type ID fallback for manual escalation tickets | `undefined` |
| 27 | `AUTOTASK_SUB_ISSUE_TYPE_ID` | `shared/configService.ts:32` | Sub-issue type ID fallback | `undefined` |
| 28 | `AUTOTASK_SUB_ISSUE_TYPE_ID` | `shared/autotask.ts:792` | Sub-issue type ID fallback for compliance tickets | `undefined` |
| 29 | `AUTOTASK_SUB_ISSUE_TYPE_ID` | `escalateTrigger/index.ts:494` | Sub-issue type ID fallback for manual escalation tickets | `undefined` |
| 30 | `AUTOTASK_ACTION_REQUIRED_STATUS_ID` | `backupWatchTrigger/index.ts:685` | Target Autotask status ID when a temporary exclusion expires with an open ticket | `8` |
| 31 | `AT_USER` | `adminDiagnostics/index.ts:26,52` | Legacy Autotask username check in standalone diagnostics endpoint | None (discrepancy with `AUTOTASK_USER`) |
| 32 | `AT_SECRET` | `adminDiagnostics/index.ts:27` | Legacy Autotask secret check in standalone diagnostics endpoint | None (discrepancy with `AUTOTASK_SECRET`) |
| 33 | `AZURE_FUNCTIONS_ENVIRONMENT` | `backupWatchTrigger/index.ts:1217` | Runtime environment name in diagnostics payload | `"Production"` |
| 34 | `AZURE_FUNCTIONS_ENVIRONMENT` | `adminDiagnostics/index.ts:23` | Runtime environment name in standalone diagnostics | `"Production"` |
| 35 | `RBAC_ADMIN_GROUP_ID` | `shared/auth.ts:19` | Entra ID Object ID for Administrator role | `"f146d61d-c629-4685-b757-5d560195a98a"` |
| 36 | `RBAC_SPECIALIST_GROUP_ID` | `shared/auth.ts:20` | Entra ID Object ID for Specialist role | `"ca9d0b2c-6f9f-4b94-864c-1cca786dc52d"` |
| 37 | `RBAC_CONTRIBUTOR_GROUP_ID` | `shared/auth.ts:21` | Entra ID Object ID for Contributor role | `"d19f391a-6aba-4a25-87b3-aff059c0ff40"` |
| 38 | `RBAC_VIEWER_GROUP_ID` | `shared/auth.ts:22` | Entra ID Object ID for Viewer role | `"f17fa29e-7ea8-405e-b04a-15a6a8fe2f60"` |

### Code Evidence
`c:\Projects\FifoDash\stateless-backend\backupWatchTrigger\index.ts:316`:
```typescript
const dattoKey = process.env.DATTO_KEY;
```
`c:\Projects\FifoDash\stateless-backend\shared\autotask.ts:14-16`:
```typescript
const user = process.env.AUTOTASK_USER;
const secret = process.env.AUTOTASK_SECRET;
const integrationCode = process.env.AUTOTASK_INTEGRATION_CODE;
```

---

## 2. Alert Thresholds (As Actually Evaluated)

### Conclusion
Every alert threshold evaluated in code is hardcoded. There is no dynamic threshold evaluation loaded from configuration tables or the alert routing matrix.

| Alert Type | Condition Evaluated in Code | Exact Constant | Where Evaluated (File & Line) | Auto-Heal Clearing Threshold | Routing Matrix Threshold Difference |
|---|---|---|---|---|---|
| **Storage Warning / Critical** | `storageUsedPercent > 85` (No distinct warning threshold exists; only `> 85` is checked) | `85` (%) | `backupWatchTrigger/index.ts:881, 894`<br>`spfx-client/.../BackupWatch.tsx:1482` | `storageUsedPercent <= 85` (`backupWatchTrigger/index.ts:894`) | Routing matrix defines no threshold; only defines title template & default priority 2. |
| **Appliance Offline** | `Date.now() / 1000 - lastCheckinVal > 3600` | `3600` (seconds, 1 hour) | `backupWatchTrigger/index.ts:915`<br>`spfx-client/.../BackupWatch.tsx:1486-1490` | `!isDeviceOffline` (`backupWatchTrigger/index.ts:916`) | Routing matrix defines no threshold; docs (e.g. `ROADMAP.md:19`) say ">48h", but code strictly enforces `3600s` (1 hour). |
| **Backup Failure** | `latest.backup.status === 'success'`<br>`device.alertCount === 0` | `'success'`<br>`0` | `backupWatchTrigger/index.ts:976, 1072`<br>`spfx-client/.../BackupWatch.tsx:1493-1495` | `latestBackupSuccess === true` (`backupWatchTrigger/index.ts:996`) | Routing matrix defines no threshold; title template only. |
| **Overdue Backup** | `ageSeconds > 24 * 3600` | `86400` (seconds, 24 hours) | `spfx-client/.../BackupWatch.tsx:200` | **None in backend** (Overdue is evaluated purely in frontend UI; backend has no auto-heal or overdue check) | Routing matrix defines no threshold; marked as `autoTicketEnabled: false`. |
| **Screenshot Failure** | `!screenshotVerification.success` (Derived from Datto `screenshotVerification`, `lastScreenshotAttemptStatus`, or `lastScreenshot.success`) | `false` | `backupWatchTrigger/index.ts:983-993`<br>`spfx-client/.../BackupWatch.tsx:1481` | `latestScreenshotSuccess === true` (`backupWatchTrigger/index.ts:1004`) | Routing matrix defines no threshold; title template only. |
| **Paused Agent** | `!!asset.isPaused` | `true` | `backupWatchTrigger/index.ts:929`<br>`backupWatchTrigger/index.ts:1012` | `!isPaused` (`backupWatchTrigger/index.ts:1012`) | Paused agent has no entry in `DEFAULT_ALERT_ROUTING_MATRIX`. |
| **Offsite Sync Issue** | `offsiteSyncFailed || offsiteStatus === 'Error' || offsiteSyncStatus === 'Critical' || offsiteSyncStatus === 'Warning'` | `'Error'`, `'Critical'`, `'Warning'` | `backupWatchTrigger/index.ts:1113`<br>`spfx-client/.../BackupWatch.tsx:1498-1504` | `!isOffsiteSyncFailed` (`backupWatchTrigger/index.ts:1114`) | Routing matrix defines no threshold; title template only. |

### Code Evidence
`c:\Projects\FifoDash\stateless-backend\backupWatchTrigger\index.ts:881, 894`:
```typescript
const storageUsedPercent = totalSize > 0 ? (usedSize / totalSize) * 100 : 0;
...
if (storageTicket && storageUsedPercent <= 85 && ticketsTableClient) {
    await handleAutoHeal(ticketsTableClient, serialNumber, "storage", storageTicket.ticketId, ...);
```
`c:\Projects\FifoDash\stateless-backend\backupWatchTrigger\index.ts:915-916`:
```typescript
const isDeviceOffline = lastCheckinVal ? (Date.now() / 1000 - lastCheckinVal > 3600) : false; // 1hr threshold
if (offlineTicket && !isDeviceOffline && ticketsTableClient) {
```
`c:\Projects\FifoDash\spfx-client\src\webparts\backupWatch\components\BackupWatch.tsx:199-200`:
```typescript
const ageSeconds = Math.floor(Date.now() / 1000) - epochSeconds;
return ageSeconds > 24 * 3600;
```

---

## 3. What Auto-Tickets Today

### Conclusion
In the background scanner path (`isBackground === true`), **ONLY native volume exclusions** (`VolumeExclusion`) can create Autotask tickets automatically.  
The scanner **NEVER** creates incident tickets for backup failures, screenshot failures, offline appliances, or storage alerts. Tickets for those incidents can **ONLY** be created manually by an engineer clicking the "Escalate to Autotask" button on the frontend (`escalateTrigger`).

### Routing Matrix "autoTicket" Flag Enforcement
The alert routing matrix (`IAlertRoutingConfig`) is defined in `stateless-backend/shared/configService.ts:177-262`.  
When `createComplianceTicket` is invoked, it retrieves the matrix via `getAlertRoutingMatrix()` and checks `volConfig.autoTicketEnabled`:

`c:\Projects\FifoDash\stateless-backend\shared\autotask.ts:673-679`:
```typescript
const alertMatrix = await getAlertRoutingMatrix();
const volConfig = alertMatrix.VolumeExclusion || DEFAULT_ALERT_ROUTING_MATRIX.VolumeExclusion;

if (!volConfig.autoTicketEnabled) {
    console.log(`[Auto-Ticket Disabled] Automatic ticketing for VolumeExclusion is currently disabled by Administrator. Skipping ticket creation for ${safeDevice}:${safeAgent}:${normVol}.`);
    return null;
}
```

### Default State Per Alert Type in Code (`shared/configService.ts:177-262`)
- **`VolumeExclusion`**: `autoTicketEnabled: true` (Queue: 29683488 Backup, Priority: 2 Medium, WorkType: 29682804, Issue: 30, SubIssue: 289)
- **`StorageAlert`**: `autoTicketEnabled: false`
- **`LocalBackupFailure`**: `autoTicketEnabled: false`
- **`OverdueBackup`**: `autoTicketEnabled: false`
- **`OffsiteSyncIssue`**: `autoTicketEnabled: false`
- **`ScreenshotFailure`**: `autoTicketEnabled: false`
- **`OfflineAppliance`**: `autoTicketEnabled: false`

Even if an administrator sets `autoTicketEnabled: true` for `StorageAlert` or `LocalBackupFailure` via the Admin Console, **the background scanner has NO code to create tickets for them**. Lines 771–867 of `backupWatchTrigger/index.ts` exclusively loop over `asset.unprotectedVolumeNames` and call `createComplianceTicket`. There is no background code calling ticket creation for any other alert type.

---

## 4. HTTP Routes Actually Called by the Frontend

### 4a. Every URL/Action Called by the SPFx Client

| HTTP Method | URL / Path Called | Purpose | Source File & Line |
|---|---|---|---|
| `GET` | `{backendApiUrl}?role={role}&user={user}` *(optional `&refresh=true` or `&force=true`)* | Main dashboard fleet data ingestion | `spfx-client/.../BackupWatch.tsx:1092` |
| `GET` | `{backendApiUrl}?action=adminDiagnostics&role={role}&user={user}` | Admin Console: Connectivity diagnostics probe | `spfx-client/.../BackupWatch.tsx:614, 900` |
| `GET` | `{backendApiUrl}?action=adminRouting&role={role}&user={user}` | Admin Console: Fetch Autotask routing queues and picklists | `spfx-client/.../BackupWatch.tsx:618, 942` |
| `POST` | `{backendApiUrl}?action=adminRouting&role={role}&user={user}` | Admin Console: Save updated queue/category/alert matrix | `spfx-client/.../BackupWatch.tsx:1018` |
| `GET` | `{backendApiUrl}?action=adminMaintenance&role={role}&user={user}` | Admin Console: Fetch Global Blackout status | `spfx-client/.../BackupWatch.tsx:641, 644` |
| `POST` | `{backendApiUrl}?action=adminMaintenance&role={role}&user={user}` | Admin Console: Activate/deactivate Global Blackout | `spfx-client/.../BackupWatch.tsx:664, 683` |
| `GET` | `{backendApiUrl}?action=adminCleanup&role={role}&user={user}` | Admin Console: Scan for orphaned tickets & twin exclusions | `spfx-client/.../BackupWatch.tsx:718, 730` |
| `POST` | `{backendApiUrl}?action=adminCleanup&role={role}&user={user}` | Admin Console: Execute bulk orphan / twin purge | `spfx-client/.../BackupWatch.tsx:766, 784` |
| `POST` | `{backendApiUrl}?action=adminTestAsset&role={role}&user={user}` | Admin Console: Live CI search probe | `spfx-client/.../BackupWatch.tsx:825, 834` |
| `GET` | `{baseUrl}/exclusions` | Fetch all exclusions | `spfx-client/.../BackupWatch.tsx:531, 1097` |
| `POST` | `{baseUrl}/exclusions` | Create or update device/agent silence or volume exclusion | `spfx-client/.../BackupWatch.tsx:1274, 1299` |
| `DELETE` | `{baseUrl}/exclusions?id={rowKey}` | Remove an exclusion / unmute | `spfx-client/.../BackupWatch.tsx:1341, 1362` |
| `GET` | `{baseUrl}/auditlogs?role={role}&user={user}` | Retrieve last 100 audit log records | `spfx-client/.../BackupWatch.tsx:541, 552` |
| `POST` | `{baseUrl}/escalate?role={role}&user={user}` | Escalate single or bulk issues to Autotask tickets | `spfx-client/.../BackupWatch.tsx:351, 387, 471` |

### 4b. Function Folders in stateless-backend

| Function Folder | `function.json` Route | HTTP Methods | authLevel | Script File |
|---|---|---|---|---|
| `adminDiagnostics` | `"adminDiagnostics"` (`/api/adminDiagnostics`) | `["get"]` | `"anonymous"` | `../dist/adminDiagnostics/index.js` |
| `adminRouting` | `"adminRouting"` (`/api/adminRouting`) | `["get", "post"]` | `"anonymous"` | `../dist/adminRouting/index.js` |
| `auditLogs` | *(default)* (`/api/auditLogs`) | `["get"]` | `"anonymous"` | `../dist/auditLogs/index.js` |
| `backupWatchTimerTrigger` | *(Timer trigger; no HTTP route)* | N/A | N/A (Schedule: `0 */30 * * * *`) | `../dist/backupWatchTimerTrigger/index.js` |
| `backupWatchTrigger` | *(default)* (`/api/backupWatchTrigger`) | `["get", "post"]` | `"anonymous"` | `../dist/backupWatchTrigger/index.js` |
| `escalateTrigger` | `"escalate"` (`/api/escalate`) | `["post"]` | `"anonymous"` | `../dist/escalateTrigger/index.js` |
| `exclusions` | *(default)* (`/api/exclusions`) | `["get", "post", "delete"]` | `"anonymous"` | `../dist/exclusions/index.js` |

### 4c. `?action=` Values Handled by backupWatchTrigger
`backupWatchTrigger/index.ts` explicitly checks for the following 5 actions:
1. `action === "adminDiagnostics"` (`line 1202`)
2. `action === "adminRouting"` (`line 1306`)
3. `action === "adminMaintenance"` (`line 1474`)
4. `action === "adminCleanup"` (`line 1544`)
5. `action === "adminTestAsset"` (`line 1710`)

**Are standalone `adminRouting` and `adminDiagnostics` used by frontend?**  
**NO. They are DEAD CODE.**  
In `BackupWatch.tsx:613-619`, the frontend routes all diagnostic and routing requests through `_getAdminActionUrl`:
```typescript
private _getAdminActionUrl(action: string): string {
    const url = this.props.backendApiUrl || '';
    return url.indexOf('?') > -1 ? `${url}&action=${encodeURIComponent(action)}` : `${url}?action=${encodeURIComponent(action)}`;
}
```
Because `backendApiUrl` points to `/api/backupWatchTrigger`, the frontend calls `/api/backupWatchTrigger?action=adminDiagnostics` and `/api/backupWatchTrigger?action=adminRouting`. The standalone `/api/adminDiagnostics` and `/api/adminRouting` endpoints are never called by SPFx.

### 4d. Exact Endpoint Names
- **Escalation:** The exact endpoint route is **`/api/escalate`**.  
  `escalateTrigger/function.json:11` explicitly defines `"route": "escalate"`. The endpoint `/api/escalateTrigger` does **NOT** exist in the Azure runtime.
- **Audit Logs:**  
  `auditLogs/function.json` defines no route override, making the Azure runtime route `/api/auditLogs`.  
  The frontend in `BackupWatch.tsx:541` calls lowercase **`/api/auditlogs`**. (Azure Functions on Linux/Windows matches this case-insensitively).

---

## 5. Cache Bypass

### Query Parameters
`backupWatchTrigger/index.ts:1802` evaluates:
```typescript
const requestedForce = req.query.refresh === 'true' || req.query.force === 'true';
```
- **`refresh=true`**: Supported.
- **`force=true`**: Supported.
- **`forceRefresh=true`**: **NOT SUPPORTED / IGNORED** (not checked in `req.query`).

### Role Check Applied
`backupWatchTrigger/index.ts:1804-1810`:
```typescript
let forceRefresh = false;
if (requestedForce) {
    const userSec = getUserSecurityContext(req);
    if (userSec.isAuthorizedForForceRefresh) {
        forceRefresh = true;
    } else {
        context.log.warn(`[RBAC] User ${userSec.email} with role ${userSec.role} requested force refresh without Specialist/Administrator permissions. Falling back to cached data.`);
    }
}
```
`shared/auth.ts:203`:
```typescript
isAuthorizedForForceRefresh: role === "Specialist" || role === "Administrator"
```
If a user with `Viewer` or `Contributor` role requests `?refresh=true` or `?force=true`, the request does not error with 403; instead, the backend logs a warning and silently falls back to serving cached data (`forceRefresh = false`).

---

## 6. RBAC / Identity Resolution (Security-Critical)

### Evaluation Precedence & Flow in `shared/auth.ts` (`getUserSecurityContext`)
1. **Easy Auth (`X-MS-CLIENT-PRINCIPAL`)**: Decodes base64 header into JSON; extracts user claims, `userDetails`, and pushes any claims with typ `"groups"` or `userRoles` into a local `groups: string[]` array (`lines 50–91`).
2. **Client-Supplied Header or Query Param (`x-user-role` / `?role=`)**: If present, pushes the corresponding role GUID into the `groups` array (`lines 93–105`).
3. **Bearer JWT (`Authorization: Bearer <token>`)**: Splits token on `.`, decodes payload base64 JSON, and pushes `jwtPayload.groups` and `jwtPayload.roles` into the `groups` array (`lines 114–155`).
4. **Mock Header (`x-mock-role`)**: If present, pushes corresponding role GUID into `groups` (`lines 157–169`).
5. **Highest Role Resolution**: Checks `groups` in strict descending order (`lines 176–186`):
   - If `groups.includes(adminId)` -> `Administrator`
   - Else if `groups.includes(specialistId)` -> `Specialist`
   - Else if `groups.includes(contributorId)` -> `Contributor`
   - Else -> `Viewer`

### Can a Client Header or Query Param RAISE a User's Role?
**YES. ABSOLUTELY.**  
Any unauthenticated HTTP request that appends `?role=administrator` or sends header `x-user-role: administrator` causes lines 96–97 to execute:
```typescript
if (clientRoleHeader === "administrator" || clientRoleHeader === "admin") {
    groups.push(RBAC_GROUP_IDS.ADMINISTRATOR.toLowerCase());
}
```
When lines 178–179 run:
```typescript
if (groups.includes(adminId)) {
    role = "Administrator";
}
```
The caller is elevated to full `Administrator`, completely overriding whatever permissions their Entra ID token or groups dictate.

### Is JWT Signature Verified?
**NO. IT IS ONLY DECODED.**  
`shared/auth.ts:118-122`:
```typescript
const parts = token.split(".");
if (parts.length >= 2) {
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decodedJson = Buffer.from(payloadBase64, "base64").toString("utf-8");
    const jwtPayload = JSON.parse(decodedJson);
```
There is zero signature verification, zero JWKS public-key lookup, and zero token expiration validation.

### Where Group IDs are Defined
`shared/auth.ts:18-23`: Read from environment variables with hardcoded GUID defaults:
```typescript
export const RBAC_GROUP_IDS = {
    ADMINISTRATOR: process.env.RBAC_ADMIN_GROUP_ID || "f146d61d-c629-4685-b757-5d560195a98a",
    SPECIALIST: process.env.RBAC_SPECIALIST_GROUP_ID || "ca9d0b2c-6f9f-4b94-864c-1cca786dc52d",
    CONTRIBUTOR: process.env.RBAC_CONTRIBUTOR_GROUP_ID || "d19f391a-6aba-4a25-87b3-aff059c0ff40",
    VIEWER: process.env.RBAC_VIEWER_GROUP_ID || "f17fa29e-7ea8-405e-b04a-15a6a8fe2f60"
};
```

---

## 7. Autotask Status IDs

### Terminal / Closed Status IDs
**ONLY status ID `5` (`Completed`) is treated as closed in code.**  
Every check in code uses `status === 5` or `status !== 5`:
- `backupWatchTrigger/index.ts:420`: `if (atTicket.status === 5)`
- `backupWatchTrigger/index.ts:585`: `const isTicketClosed = (atTicket.status === 5); // 5 = Completed (Closed in Autotask)`
- `escalateTrigger/index.ts:368`: `if (atTicket && atTicket.status !== 5)`
- `escalateTrigger/index.ts:396`: `else if (atTicket && atTicket.status === 5)`
No other status IDs (e.g., Cancelled, Resolved, Waiting) are considered closed.

### Status Set When Temporary Exclusion Expires with Open Ticket
- **Status Label Searched:** Matches `"action required"` (case-insensitive substring: `p.label.toLowerCase().includes("action required")` — **NOT** "Attention Required").
- **Resolution Chain:**
  1. Picklist lookup via `getTicketStatusPicklistValues(autotaskConfig)`.
  2. If picklist lookup yields no match: reads `process.env.AUTOTASK_ACTION_REQUIRED_STATUS_ID`.
  3. If env var is missing or unparseable: hardcoded fallback to `8`.

`backupWatchTrigger/index.ts:683-685`:
```typescript
const statusPicklists = await getTicketStatusPicklistValues(autotaskConfig);
const actionReqField = statusPicklists.find(p => p.label && p.label.toLowerCase().includes("action required"));
const targetStatusId = actionReqField ? actionReqField.value : (process.env.AUTOTASK_ACTION_REQUIRED_STATUS_ID ? parseInt(process.env.AUTOTASK_ACTION_REQUIRED_STATUS_ID, 10) : 8);

const statusUpdated = await updateTicketStatusInAutoTask(ticketIdNum, targetStatusId, autotaskConfig);
```

---

## 8. Expiry Sweep and Reconciliation

Step-by-step code execution flow during `backupWatchTrigger/index.ts:482-765`:

### 1. Expired Temp Exclusion + Open Ticket (`atTicket.status !== 5`)
1. Evaluates `if (isVolumeStillUnprotected)` and `if (isExpired)` (`lines 590, 664`).
2. Generates reminder note titled `"[ACTION REQUIRED] TEMPORARY EXCLUSION EXPIRED"`.
3. Posts note to Autotask ticket via `createTicketNoteInAutoTask` (`lines 676-679`).
4. Resolves "Action Required" status ID (picklist -> `AUTOTASK_ACTION_REQUIRED_STATUS_ID` -> `8`) and updates Autotask ticket status via `updateTicketStatusInAutoTask` (`lines 683-690`).
5. Extends deadline by 24 hours: `newExpiresAt = new Date(nowMs + 24 * 3600 * 1000).toISOString()`.
6. Upserts updated entity to `Exclusions` Table Storage (`lines 696-700`).
7. **Deletion / Closure:** Exclusion is **NOT** deleted; ticket is **NOT** closed.

### 2. Expired Temp Exclusion + Closed Ticket (`atTicket.status === 5`)
1. Evaluates `if (isVolumeStillUnprotected)` and `if (isTicketClosed)` with `if (!isPerm)` (`lines 590-594`).
2. **Deletes** old exclusion entity from Table Storage: `await exclusionsTableClient.deleteEntity(e.partitionKey, e.rowKey)` (`line 598`).
3. **Creates** a brand new follow-up compliance ticket in Autotask: `const newTicket = await createComplianceTicket(...)` with re-opened notice (`lines 601-608`).
4. Upserts fresh exclusion entity in Table Storage with 3-day expiry (`Date.now() + 3 * 24 * 3600 * 1000`), new ticket number, and ticket URL (`lines 628-636`).
5. Updates in-memory array and writes audit log with action `"Re-raised Volume Exclusion Ticket"` (`lines 639-657`).
6. **Deletion / Closure:** Old exclusion record **IS deleted**; new ticket **IS created automatically**.

### 3. Volume Re-Protected in Datto (`!isVolumeStillUnprotected`)
1. Evaluates `if (!isVolumeStillUnprotected)` (`line 710`).
2. If ticket is still open (`!isTicketClosed`), posts auto-heal resolution note: `"[AUTO-HEAL] Volume Re-included in Backups - ${volName}"` via `createTicketNoteInAutoTask` (`lines 714-735`). Note explicitly informs engineers: *"This ticket remains OPEN per engineering policy. Engineer Next Steps: Verify... and close this ticket when satisfied."*
3. **Deletes** exclusion entity from Table Storage: `await exclusionsTableClient.deleteEntity(e.partitionKey, e.rowKey)` (`line 739`).
4. Removes exclusion from memory array (`line 743`).
5. Writes audit log with action `"Auto-Heal Volume Exclusion (Resolved in Datto)"` (`lines 748-756`).
6. **Deletion / Closure:** Exclusion record **IS deleted automatically** from Table Storage. Ticket is **NEVER closed automatically** by BackupWatch.

### 4. Permanent Exclusion with Closed Ticket (`isPerm === true` & `status === 5`)
1. Evaluates `if (isVolumeStillUnprotected)` and `if (isTicketClosed)`.
2. Encounters `if (!isPerm) { ... }` (`line 594`).
3. Because `isPerm` is `true`, the entire re-opening and deletion block is skipped.
4. **Deletion / Closure:** Nothing is deleted, no ticket is created, and no note is pushed. The exclusion remains permanently active.

### 5. Twin / Un-Normalised Record Cleanup
1. Evaluates temporary exclusions: `if (!isPerm)` (`line 510`).
2. Checks if a permanent exclusion exists for the same canonical target:
   `const hasPermTwin = exclusions.some(other => other.rowKey !== e.rowKey && other.type === "Volume" && Boolean(other.isPermanent) && isVolumeExcluded([other], devName, agentName, volName) !== undefined);` (`lines 511-516`).
3. If twin found: silently **deletes** redundant temporary record from Table Storage: `await exclusionsTableClient.deleteEntity(e.partitionKey, e.rowKey)` and splices memory array (`lines 520-522`).
4. Additionally, `exclusions/index.ts:161-182` tests candidate legacy un-normalized row keys (`D:\`, `D:/`, `D:`, `D\`, `D/`) upon upsert and deletes matching twin entities.

---

## 9. Volume Normalisation

### Current Code in `stateless-backend/shared/volumeUtils.ts:26-47`
```typescript
export function normalizeVolumeName(volumeName: string): string {
    if (!volumeName) return "";
    let clean = volumeName.trim().replace(/\\/g, "/");
    // Strip trailing slashes
    clean = clean.replace(/\/+$/, "");
    // If it's a single drive letter like "C:" or "F:", strip colon to normalize to "F"
    if (/^[a-zA-Z]:$/.test(clean)) {
        clean = clean.charAt(0);
    }
    return clean.toUpperCase();
}

export function buildVolumeTargetKey(deviceName: string, agentName: string, volumeName: string): string {
    const dev = (deviceName || "").trim().toLowerCase();
    const agt = (agentName || "").trim().toLowerCase();
    const vol = normalizeVolumeName(volumeName).toLowerCase();
    return `${dev}:${agt}:${vol}`;
}
```

### What `normalizeVolumeName("/")` Returns Today
When given `"/"`:
1. `clean = "/".trim().replace(/\\/g, "/")` -> `"/"`
2. `clean.replace(/\/+$/, "")` -> `""` (strips all slashes to an **EMPTY STRING**)
3. `clean.toUpperCase()` returns **`""`** (empty string).

### Is the Linux Root Bug Fixed?
**NO. THE BUG IS NOT FIXED.**  
Because `normalizeVolumeName("/")` returns `""`, any Linux root volume `'/'` is stripped to an empty string.  
In `backupWatchTrigger/index.ts:934-935`, `protectedVolumeNames` runs `.map(v => normalizeVolumeName(v)).filter(Boolean)`. Because it evaluates to `""`, `filter(Boolean)` **completely discards the Linux root volume**, making root filesystems invisible on the dashboard and in exclusion logic.

### Places Storing or Comparing Volumes WITHOUT `normalizeVolumeName`
1. `backupWatchTrigger/index.ts:1103-1107`: Populating `volumesList` for legacy forms:
   ```typescript
   for (const volName of agent.unprotectedVolumeNames || []) {
       volumesList.push({
           id: `${agent.name}:${volName}`,
           name: `${agent.name} - ${volName} (Datto Excluded)`
       });
   }
   ```
   Uses raw `volName` directly without calling `normalizeVolumeName(volName)`.
2. `shared/volumeUtils.ts:118`: Fallback target match when target string has fewer than 3 segments:
   ```typescript
   return (e.target || "").toLowerCase().replace(/\\/g, "/").replace(/\/+$/, "") === targetKey;
   ```
   Uses ad-hoc regex replaces instead of `normalizeVolumeName` or `buildVolumeTargetKey`.

---

## 10. Concurrency Against External APIs

### 10a. Datto BCDR API
- **Asset Fetching (`/device/{serial}/asset`):** Fetched with **UNBOUNDED `Promise.all`**.  
  `backupWatchTrigger/index.ts:460`:
  ```typescript
  const devices = await Promise.all(rawDevices.map(async (device: any) => {
      const assetResponse = await axios.get(`https://api.datto.com/v1/bcdr/device/${device.serialNumber}/asset`, {
          headers: { "Authorization": authHeader },
          timeout: 15000
      });
  ```
  If there are 120 appliances, all 120 requests fire concurrently in parallel.
- **Timeouts:**
  - Initial `/v1/bcdr/device?_page=1&_perPage=250` call: `30000` ms (30 seconds) (`line 454`).
  - Child `/device/{serialNumber}/asset` calls: `15000` ms (15 seconds) (`line 467`).

### 10b. Autotask PSA API
- **`getTicketEntityFields` In-Flight Mutex (`shared/autotask.ts:460-506`):**  
  **CONFIRMED.** Uses module-level singleton promise:
  ```typescript
  let ticketFieldsCache: IEntityFieldsCache | null = null;
  let inFlightTicketFieldsPromise: Promise<any[]> | null = null;
  ...
  if (inFlightTicketFieldsPromise) {
      return inFlightTicketFieldsPromise;
  }
  ```
  TTL is 1 hour (`60 * 60 * 1000` ms). Parallel invocations await the exact same promise.
- **Tracked Tickets Fetching:** Batched in chunks of 50 (`TICKET_CHUNK_SIZE = 50`) in a serial `for` loop with a 100ms pause between chunks (`backupWatchTrigger/index.ts:384-404`).
- **Exclusion Sweep:** Processed sequentially in a `for` loop with a 100ms pause between items (`backupWatchTrigger/index.ts:488, 763`).
- **Background Auto-Ticketing Loop:** Processed sequentially in nested `for` loops (`backupWatchTrigger/index.ts:772, 785, 801`).

### Could More Than 3 Concurrent Autotask Requests Occur?
**YES.**  
In `backupWatchTrigger/index.ts:877-920`, `handleAutoHeal` (which calls `createTicketNoteInAutoTask`) is invoked inside the device mapping loop:
```typescript
const processedData = await Promise.all(devices.map(async (device: any) => {
    ...
    if (storageTicket && storageUsedPercent <= 85 && ticketsTableClient) {
        await handleAutoHeal(...); // calls createTicketNoteInAutoTask
    }
    if (offlineTicket && !isDeviceOffline && ticketsTableClient) {
        await handleAutoHeal(...); // calls createTicketNoteInAutoTask
    }
}));
```
Because `Promise.all(devices.map(...))` runs all devices concurrently, if 4 or more appliances recover from offline or storage alerts during the same cycle, `handleAutoHeal` will fire Autotask ticket note requests simultaneously, **breaching Autotask's 3-thread ceiling**.

---

## 11. Silence Hierarchy in Code

### Code Definition (`stateless-backend/shared/volumeUtils.ts:52-120`)
```typescript
export function isDeviceSilenced<T extends IExclusionEntityLike>(
    exclusions: T[],
    deviceName: string
): boolean {
    if (!deviceName) return false;
    const dev = deviceName.trim().toLowerCase();
    return exclusions.some(
        e => e.type === "Device" && (e.target || "").trim().toLowerCase() === dev
    );
}

export function isDeviceMuted<T extends IExclusionEntityLike>(
    exclusions: T[],
    deviceName: string
): T | undefined {
    if (!deviceName) return undefined;
    const dev = deviceName.trim().toLowerCase();
    return exclusions.find(
        e => e.type === "Device" && (e.target || "").trim().toLowerCase() === dev
    );
}

export function isAgentSilenced<T extends IExclusionEntityLike>(
    exclusions: T[],
    deviceName: string,
    agentName: string
): boolean {
    if (!deviceName || !agentName) return false;
    if (isDeviceSilenced(exclusions, deviceName)) return true;

    const dev = deviceName.trim().toLowerCase();
    const agt = agentName.trim().toLowerCase();
    const targetKey = `${dev}:${agt}`;

    return exclusions.some(e => {
        if (e.type !== "Agent" || !e.target) return false;
        return e.target.trim().toLowerCase() === targetKey;
    });
}

export function isVolumeExcluded<T extends IExclusionEntityLike>(
    exclusions: T[],
    deviceName: string,
    agentName: string,
    volumeName: string
): T | undefined {
    const targetKey = buildVolumeTargetKey(deviceName, agentName, volumeName);
    return exclusions.find(e => {
        if (e.type !== "Volume" || !e.target) return false;
        const parts = e.target.split(":");
        if (parts.length >= 3) {
            const eDev = parts[0];
            const eAgent = parts[1];
            const eVol = parts.slice(2).join(":");
            return buildVolumeTargetKey(eDev, eAgent, eVol) === targetKey;
        }
        return (e.target || "").toLowerCase().replace(/\\/g, "/").replace(/\/+$/, "") === targetKey;
    });
}
```

### Difference Between `isDeviceSilenced` and `isDeviceMuted`
Only the return type differs:
- `isDeviceSilenced` returns a **boolean** (`true` or `false`).
- `isDeviceMuted` returns the **matching exclusion entity object** or `undefined`.

### Does Appliance Mute Fully Block Autotask Calls & Auto-Heal in Both Paths?
**NO.**
1. **In the Background Scanner Auto-Ticket Path (`backupWatchTrigger/index.ts:780`):** It blocks compliance ticket creation (`if (isDeviceSilenced(exclusions, devName)) continue;`).
2. **In the Auto-Heal Path (`backupWatchTrigger/index.ts:894, 916, 1114`):**
   - **Storage Auto-Heal** (`line 894`): Evaluated BEFORE `isDeviceSilenced` is checked; does **NOT** check appliance silence.
   - **Device Offline Auto-Heal** (`line 916`): Evaluated BEFORE `isDeviceSilenced` is checked; does **NOT** check appliance silence.
   - **Offsite Sync Auto-Heal** (`line 1114`): Does **NOT** check appliance silence.
   - Only agent-level backup failure, screenshot, and paused status (`lines 996, 1004, 1012`) check `!isApplianceSilenced`.
3. **In the Exclusion Sweep (`backupWatchTrigger/index.ts:482-764`):** The sweep never checks `isDeviceSilenced`. Autotask queries and notes for existing volume exclusions will still execute on a silenced appliance.

### Is Global Maintenance Mode Checked in All Ticket Paths?
**NO.**  
Global Maintenance Mode (`getGlobalMaintenanceMode()`) is checked **ONLY** in `createComplianceTicket` (`shared/autotask.ts:664-671`).  
It is **NEVER checked** in `escalateTrigger/index.ts` (manual escalations bypass maintenance blackout).

---

## 12. Active vs Cancelled

### Code Definition (`stateless-backend/backupWatchTrigger/index.ts:121-142`)
```typescript
function isApplianceActive(device: any): boolean {
    if (device.hidden) return false;
    const hasServicePeriod = device.servicePeriod && typeof device.servicePeriod === "string" && device.servicePeriod.trim() !== "";
    if (hasServicePeriod) {
        return new Date(device.servicePeriod).getTime() > Date.now();
    }
    // If servicePeriod is empty or missing (e.g. Infinite Cloud Retention), consider active if device checked in within 30 days
    const rawCheckin = device.lastCheckin ?? device.lastSeen ?? device.lastContact ?? device.lastSeenDate ?? null;
    if (rawCheckin) {
        let checkinMs: number | null = null;
        if (typeof rawCheckin === 'number') {
            checkinMs = rawCheckin > 1e11 ? rawCheckin : rawCheckin * 1000;
        } else {
            const parsed = Date.parse(rawCheckin);
            if (!isNaN(parsed)) checkinMs = parsed;
        }
        if (checkinMs) {
            return (Date.now() - checkinMs) < (30 * 24 * 3600 * 1000);
        }
    }
    return false;
}
```

### Datto Fields Used
1. `device.hidden` (boolean: if true, immediately false)
2. `device.servicePeriod` (string date: compared against `Date.now()`)
3. `device.lastCheckin` (number epoch or date string: checked if within 30 days)
4. `device.lastSeen` (fallback)
5. `device.lastContact` (fallback)
6. `device.lastSeenDate` (fallback)

---

## 13. Table Storage

### Complete Table Inventory in Code

| Table Name | PartitionKey Format | RowKey Format | Reading Functions | Writing Functions | Deleting Functions |
|---|---|---|---|---|---|
| **`Exclusions`** | `"Exclusion"` | `encodeURIComponent("${type}:${normalizedTarget}")`<br>*(Fallback: raw unencoded)* | `backupWatchTrigger`<br>`exclusions`<br>`adminDiagnostics` | `exclusions`<br>`backupWatchTrigger` | `exclusions` (DELETE route, twin cleanup)<br>`backupWatchTrigger` (sweep auto-heal, sweep ticket recreation, perm twin purge, adminCleanup) |
| **`TrackedTickets`** | `serialNumber` *(appliance serial)* | `issueKey` *(e.g. `"storage"`, `"offline"`, `"offsitesync"`, or `agent:${name}:${issueType}`)* | `backupWatchTrigger`<br>`escalateTrigger`<br>`adminDiagnostics` | `escalateTrigger` | `backupWatchTrigger` (`handleAutoHeal`, completed ticket prune, adminCleanup)<br>`escalateTrigger` (completed ticket prune) |
| **`AuditLogs`** | `"AuditLog"` | `${Date.now()}-${Math.random().toString(36).substring(2, 9)}` | `auditLogs`<br>`backupWatchTrigger`<br>`adminDiagnostics` | `exclusions`<br>`escalateTrigger`<br>`backupWatchTrigger`<br>`adminRouting` | *None* |
| **`ScanStatus`** | `"TimerTrigger"` | `"LastRun"` | `backupWatchTrigger`<br>`exclusions`<br>`auditLogs`<br>`adminDiagnostics` | `backupWatchTimerTrigger` | *None* |
| **`SystemConfig`** | `"Autotask"` | `"Routing"` | `shared/configService.ts`<br>(`getAutotaskRoutingConfig`) | `shared/configService.ts`<br>(`saveAutotaskRoutingConfig`) | *None* |
| **`SystemConfig`** | `"Global"` | `"MaintenanceMode"` | `shared/configService.ts`<br>(`getGlobalMaintenanceMode`) | `shared/configService.ts`<br>(`setGlobalMaintenanceMode`) | *None* |
| **`SystemConfig`** | `"AlertRouting"` | `${alertKey}` *(e.g. `"VolumeExclusion"`, `"StorageAlert"`, etc.)* | `shared/configService.ts`<br>(`getAlertRoutingMatrix`) | `shared/configService.ts`<br>(`saveAlertRoutingMatrix`) | *None* |

---

## 14. Versions

### Current Values Across Files
- **`stateless-backend/shared/version.ts:1`**: `"1.23.2"`
- **`stateless-backend/package.json:3`**: `"1.23.2"`
- **`spfx-client/package.json:3`**: `"1.23.1"`
- **`spfx-client/src/webparts/backupWatch/BackupWatchWebPart.manifest.json:6`**: `"1.23.1"`
- **`C:\Projects\BackupWatchScaffold\package.json:3`**: `"1.23.1"`
- **`C:\Projects\BackupWatchScaffold\config\package-solution.json:6`**: `"1.23.1.0"` (solution)
- **`C:\Projects\BackupWatchScaffold\config\package-solution.json:37`**: `"1.22.1.0"` (`features[0].version`)

### Mismatches Flagged
1. **Backend vs. Frontend Version Mismatch:** Backend is `1.23.2`, while SPFx client and scaffold package files are `1.23.1`.
2. **Scaffold Feature Version Staleness:** In `C:\Projects\BackupWatchScaffold\config\package-solution.json`, `solution.version` is `"1.23.1.0"`, but `features[0].version` is `"1.22.1.0"`.

---

## 15. Frontend Structure

### Directory Layout
Matches `CLAUDE.md:47-65`:
```
spfx-client/src/webparts/backupWatch/components/
├── BackupWatch.tsx
├── IBackupWatchProps.ts
├── appliance/
│   ├── ExclusionsTable.tsx
│   ├── HeaderBar.tsx
│   └── MetricCards.tsx
├── modals/
│   ├── AdminModal.tsx
│   ├── AuditLogsDrawer.tsx
│   ├── EscalationModal.tsx
│   └── MutingModal.tsx
├── styles/
│   └── BackupWatchStyles.tsx
└── types/
    └── BackupWatchTypes.ts
```

### Exact Component Line Counts
- `BackupWatch.tsx`: **2,618 lines** (146,740 bytes)
- `IBackupWatchProps.ts`: **13 lines**
- `appliance/ExclusionsTable.tsx`: **107 lines**
- `appliance/HeaderBar.tsx`: **208 lines**
- `appliance/MetricCards.tsx`: **131 lines**
- `modals/AdminModal.tsx`: **1,094 lines**
- `modals/AuditLogsDrawer.tsx`: **167 lines**
- `modals/EscalationModal.tsx`: **119 lines**
- `modals/MutingModal.tsx`: **304 lines**
- `styles/BackupWatchStyles.tsx`: **751 lines**
- `types/BackupWatchTypes.ts`: **139 lines**

### The 8 Metric Cards & What Each Counts
1. **Total Appliances:** Counts `tabDevices.length` (total appliances in current Active/Cancelled tab).
2. **Screenshot Failures:** Counts appliances where any unarchived agent has `screenshotVerification && !screenshotVerification.success`.
3. **Storage Critical (>85%):** Counts appliances where `storageUsedPercent > 85`.
4. **Volume Exclusions:** Sums `applianceExclusionsCount` across all tab devices.
5. **Offline Appliances:** Counts appliances where `status === 'offline'`, `isOffline === true`, or any unarchived agent status is `'Offline'`.
6. **Local Backup Failures:** Counts appliances where any unarchived agent has `lastBackupStatus && !lastBackupStatus.success`.
7. **Offsite Sync Issues:** Counts appliances where `offsiteSyncFailed`, `offsiteStatus === 'Error'`, `offsiteSyncStatus === 'Critical'`, `offsiteSyncStatus === 'Warning'`, or device `backupStatus === 'Failed'` with no local agent failures.
8. **Overdue Backups (>24h):** Sums all unarchived agents across tab devices where `_isBackupOverdue(a.lastBackupStatus)` evaluates to `true` (`ageSeconds > 86400`).

*(Note: The comment in `BackupWatch.tsx:1479` incorrectly states "Aggregations for the 7 top metrics cards", but the code renders exactly 8 cards).*

### Remaining Inline-Style Hover Handlers
1. `spfx-client/.../appliance/MetricCards.tsx:102-117`:
   - `onMouseEnter`: Sets `transform = 'translateY(-4px)'`, `boxShadow = ...`, `borderColor = ...`, `background = ...`
   - `onMouseLeave`: Sets `transform = 'none'`, `boxShadow = var(--shadow-sm)`, etc.
2. `spfx-client/.../BackupWatch.tsx:2124-2133`:
   - `onMouseEnter`: Sets `transform = 'translateY(-2px)'`, `boxShadow = var(--shadow-md)`
   - `onMouseLeave`: Sets `transform = 'none'`, `boxShadow = var(--shadow-sm)`
3. `spfx-client/.../BackupWatch.tsx:2525-2526`:
   - `onMouseEnter`: Sets `textDecoration = 'underline'`
   - `onMouseLeave`: Sets `textDecoration = 'none'`

### Dead / Unused Frontend Components
- **None.** All 7 decomposed sub-components in `appliance/` and `modals/` are actively imported and rendered by `BackupWatch.tsx`.

---

## 16. Tests and Tooling

### Script Inventory (`stateless-backend/scratch/`)

| Script Name | Purpose | Uses Mocks Only vs Touches Live Services | How to Run |
|---|---|---|---|
| `test_3tier_silence.js` | Verifies cascading silence logic across device, agent, and volume tiers | **Mocks only** (Simulated exclusions array) | `node stateless-backend/scratch/test_3tier_silence.js` |
| `test_autotask_concurrency.js` | Simulates Autotask request concurrency meter and batch chunking | **Mocks only** (Simulated timer latencies) | `node stateless-backend/scratch/test_autotask_concurrency.js` |
| `test_exclusion_lifecycle_sync.js` | Simulates sweep decision logic for open, closed, and re-protected volumes | **Mocks only** (In-memory ticket dictionary) | `node stateless-backend/scratch/test_exclusion_lifecycle_sync.js` |
| `test_mandatory_ticket.js` | Verifies requirement that ticketNumber must be provided for exclusions | **Mocks only** | `node stateless-backend/scratch/test_mandatory_ticket.js` |
| `test_rbac_authorization.js` | Verifies `getUserSecurityContext` role assignments and claims mapping | **Mocks only** (Constructed base64 headers) | `node stateless-backend/scratch/test_rbac_authorization.js` |
| `test_ticket_retention.js` | Verifies exclusion update retains existing ticket number and URL | **Mocks only** (In-memory Map) | `node stateless-backend/scratch/test_ticket_retention.js` |
| `test_volume_dedup_prevention.js` | Verifies volume drive letter regex normalization (`D:\` -> `D`) | **Mocks only** | `node stateless-backend/scratch/test_volume_dedup_prevention.js` |
| `test_volume_mute_logic.js` | Verifies `normalizeVolumeName` and target key building | **Mocks only** | `node stateless-backend/scratch/test_volume_mute_logic.js` |
| `check_live_status.js` | Reads `ScanStatus` and `Exclusions` tables | **TOUCHES LIVE SERVICES** (Reads Azure Table Storage via `local.settings.json`) | `node stateless-backend/scratch/check_live_status.js` |
| `inspect_specific_entities.js` | Inspects specific exclusion and tracked ticket rows | **TOUCHES LIVE SERVICES** (Reads Azure Table Storage via `local.settings.json`) | `node stateless-backend/scratch/inspect_specific_entities.js` |
| `delete_ghost_entity.js` | Deletes ghost entity `Volume:PEN-DATTO-01:WS-CZC1119JX4:D:\` and writes audit log | **TOUCHES LIVE SERVICES & WRITES DATA** (Deletes Table Storage row key and creates audit entity) | `node stateless-backend/scratch/delete_ghost_entity.js` |

### Automated Test Runner
**NONE EXISTS.**  
In `stateless-backend/package.json:11`:
```json
"test": "echo \"No tests specified\" && exit 0"
```
There is no Jest, Mocha, or Vitest harness configured.

---

## 17. Known Issues and TODOs

### Grep Audit Results
- `TODO`: **0 occurrences** across all `.ts`, `.tsx`, and `.js` source files.
- `FIXME`: **0 occurrences**.
- `HACK`: **0 occurrences**.
- `XXX`: **0 occurrences**.
- **Empty / Silent Catch Blocks:**
  - `backupWatchTrigger/index.ts:300`: `catch { }` (Swallows Global Maintenance Mode read failure during cache hit)
  - `backupWatchTrigger/index.ts:1178`: `catch { }` (Swallows Global Maintenance Mode read failure during fresh load)
  - `backupWatchTrigger/index.ts:1668, 1678, 1693`: `catch { }` (Swallows entity delete errors during bulk admin cleanup)
  - `backupWatchTrigger/index.ts:1772`: `catch { }` (Swallows Autotask company / contract lookup failures in asset tester)
  - `exclusions/index.ts:38`: `catch (eErr: any) {}` (Swallows ScanStatus fetch failure)
  - `exclusions/index.ts:180`: `catch (tErr) { }` (Swallows twin entity delete error)
  - `exclusions/index.ts:227`: `catch (e) { }` (Swallows ticket fetch error)
  - `shared/auth.ts:41`: `catch (e) { return null; }` (Swallows client principal parse error)
  - `shared/auth.ts:152`: `catch (e) { }` (Swallows unverified JWT parse error)
  - `shared/configService.ts:131, 300`: `catch { }` (Swallows Table Storage 404/read errors for SystemConfig)

### Top 10 Code Risks Ranked by Impact

| Rank | Risk Title | Severity | Impact Description | Relevant File & Line |
|---|---|---|---|---|
| **1** | **RBAC Privilege Escalation via Client Param/Header** | **CRITICAL** | Supplying `?role=administrator` or `x-user-role: administrator` elevates any unauthenticated caller to full `Administrator` role without group verification. | `shared/auth.ts:93-105, 178-186` |
| **2** | **Unverified JWT Signature** | **HIGH** | The backend decodes JWT tokens by raw base64 string splitting without cryptographic signature verification against Microsoft Entra ID JWKS. | `shared/auth.ts:114-155` |
| **3** | **Linux Root Volume Normalisation Bug** | **HIGH** | `normalizeVolumeName("/")` strips root `/` to `""`. Filter drops it, completely hiding Linux root volumes from monitoring, alerts, and exclusions. | `shared/volumeUtils.ts:26-36`<br>`backupWatchTrigger/index.ts:934-935` |
| **4** | **Autotask Concurrency Surge on Multi-Appliance Auto-Heal** | **HIGH** | `handleAutoHeal` calls `createTicketNoteInAutoTask` inside unbounded `Promise.all(devices.map(...))`. If >3 appliances auto-heal simultaneously, it breaches Autotask's 3-thread ceiling. | `backupWatchTrigger/index.ts:877-920` |
| **5** | **Datto Asset Query Unbounded Concurrency** | **MEDIUM** | Concurrently queries `/device/{serialNumber}/asset` for all 120+ appliances via unbounded `Promise.all`. Risks rate-limiting or socket pool exhaustion. | `backupWatchTrigger/index.ts:460-477` |
| **6** | **adminDiagnostics Environment Variable Name Mismatch** | **MEDIUM** | `adminDiagnostics` checks `AT_USER` and `AT_SECRET`, whereas `shared/autotask.ts` uses `AUTOTASK_USER` and `AUTOTASK_SECRET`. Causes diagnostics to report credentials as "Missing". | `adminDiagnostics/index.ts:26-27` |
| **7** | **Global Maintenance Mode Incomplete Coverage** | **MEDIUM** | Global Maintenance Blackout suppresses `createComplianceTicket`, but manual escalation endpoint (`escalateTrigger`) never checks it, allowing tickets during planned outages. | `escalateTrigger/index.ts:335-575` |
| **8** | **Appliance Silence Does Not Block Storage/Offline Auto-Heal** | **MEDIUM** | Muting an appliance does not suppress storage, offline, or offsite sync auto-heal actions, nor does it suppress the exclusion reconciliation sweep. | `backupWatchTrigger/index.ts:894, 916, 1114` |
| **9** | **Ghost Twin Exclusion Memory Residue** | **LOW** | When twin exclusions are deleted from Table Storage in `exclusions/index.ts:177`, they are not purged from the runtime cache until next full cycle. | `exclusions/index.ts:177` |
| **10** | **Unprotected Volume Raw Mapping in VolumesList** | **LOW** | `volumesList` maps raw unnormalized volume names from `asset.unprotectedVolumeNames`, creating UI dropdown duplicates like `D:\` alongside `D`. | `backupWatchTrigger/index.ts:1103-1107` |

---

## 18. Docs That Are Now Wrong

### Detailed Discrepancies by Document

#### 1. `CLAUDE.md`
- **Line 28:** Lists backend endpoint `/api/escalateTrigger`.  
  *Code Reality:* Route is `/api/escalate` (`escalateTrigger/function.json:11`).
- **Line 28 & Line 62:** Lists `/api/adminDiagnostics` and `/api/adminRouting` as active backend endpoints for the frontend.  
  *Code Reality:* They are dead code; the frontend routes through `/api/backupWatchTrigger?action=adminDiagnostics` and `?action=adminRouting`.

#### 2. `BACKUPWATCH_OPERATIONAL_SPECIFICATION.md`
- **Lines 61, 87:** Lists `/api/escalateTrigger` as the escalation API URL.  
  *Code Reality:* Route is `/api/escalate`.
- **Lines 75–80:** Lists only 4 Azure Table Storage tables (`Exclusions`, `TrackedTickets`, `ScanStatus`, `AuditLogs`).  
  *Code Reality:* A 5th critical table, `SystemConfig`, stores Autotask routing, maintenance mode, and alert matrix records.
- **Section 2.2 / Rule 2:** Claims Appliance Silence (Tier 1) produces "0 Autotask API calls, 0 Auto-Heal sweeps".  
  *Code Reality:* Storage, device offline, and offsite sync auto-heals do NOT check appliance silence; exclusion sweep does NOT check appliance silence.

#### 3. `.antigravity/rules.md`
- **Line 7:** Claims frontend styling uses "Tailwind CSS (used inside SPFx layout framework)".  
  *Code Reality:* SPFx client uses vanilla CSS / TypeScript CSS classes in `BackupWatchStyles.tsx`. Tailwind is not installed in `spfx-client`.
- **Line 9:** Claims architecture is "STRICTLY STATELESS. Absolutely no databases, tables, or file system storage."  
  *Code Reality:* The backend uses 5 persistent Azure Table Storage tables (`Exclusions`, `TrackedTickets`, `AuditLogs`, `ScanStatus`, `SystemConfig`).
- **Line 13:** Claims authentication checks "security groups in Entra ID via Microsoft Graph".  
  *Code Reality:* The backend never calls Microsoft Graph; it parses claims in `X-MS-CLIENT-PRINCIPAL`, client headers, and unverified Bearer JWT tokens.
- **Line 14:** Claims secrets are fetched "via Azure Key Vault using Managed Identity".  
  *Code Reality:* Credentials are read directly from environment variables (`process.env.DATTO_KEY`, etc.).
- **Line 17:** States "Always use concurrent calls (Promise.all) when querying third-party systems (Datto and Autotask)".  
  *Code Reality:* Autotask API calls are strictly serialized and paced with 100ms intervals to prevent breaching the 3-thread limit.
- **Line 23:** States project path is `C:\AG\BackupWatchScaffold`.  
  *Code Reality:* Project path is `C:\Projects\BackupWatchScaffold`.
- **Line 43:** Claims version is `v1.9.2`.  
  *Code Reality:* Version is `1.23.2` / `1.23.1`.

#### 4. `.antigravity/memory.md`
- **Line 33:** References monorepo at `C:\AG\FifoDash`.  
  *Code Reality:* Workspace is `C:\Projects\FifoDash`.
- **Line 49:** Claims appliance active status is determined purely by `hidden === false` and `new Date(servicePeriod) > new Date()`.  
  *Code Reality:* `isApplianceActive` has a fallback checking whether `lastCheckin` was within the last 30 days when `servicePeriod` is empty/missing.
- **Line 54:** Gives RowKey example as `Volume%3AMyServer%3AD%3A%5C`.  
  *Code Reality:* Drive letters are strictly normalized to single uppercase characters (`D`), so RowKey is `Volume%3AMyServer%3AD`.
- **Line 59:** Claims appliance silence suppresses all Auto-Heal sweeps and Autotask calls.  
  *Code Reality:* As detailed in Question 11, storage and offline auto-heal and sweep runs do not check appliance silence.

#### 5. `ROADMAP.md`
- **Lines 15–23:** Lists "Dynamic Priority Matrix by Alert Severity" as "Queued / Planned for Future Release".  
  *Code Reality:* **ALREADY IMPLEMENTED** in `shared/configService.ts:162-262` (`DEFAULT_ALERT_ROUTING_MATRIX`, `getAlertRoutingMatrix`, `saveAlertRoutingMatrix`) and rendered in `AdminModal.tsx`.
- **Lines 24–27:** Lists "Issue Type & Sub-Issue Type Granular Classification" as "Under Active Investigation".  
  *Code Reality:* **ALREADY IMPLEMENTED** in `shared/configService.ts` and `shared/autotask.ts:791-792`.
- **Lines 28–31:** Lists "Customizable Ticket Title & Description Template Prefixes" as "Under Discussion".  
  *Code Reality:* **ALREADY IMPLEMENTED** via `titleTemplate` with `{Company}`, `{Device}`, `{Agent}`, `{Detail}` tokens in `shared/autotask.ts:681-689`.

#### 6. `azure_setup_guide.md`
- **Line 92:** Documents Datto credential key as `DATTO_CREDS`.  
  *Code Reality:* Backend reads `DATTO_KEY` exclusively (`backupWatchTrigger/index.ts:316`).

---

## Summary of Discrepancies

| Topic | Docs Say | Code Says | File & Line |
|---|---|---|---|
| **Datto Environment Variable** | `azure_setup_guide.md:92` states key is `DATTO_CREDS`. | Code strictly reads `process.env.DATTO_KEY`. `DATTO_CREDS` is not in code. | `backupWatchTrigger/index.ts:316` |
| **Autotask Diagnostics Credentials** | Docs assume single set of Autotask credentials in app settings. | `adminDiagnostics` reads `AT_USER` & `AT_SECRET`, while `shared/autotask.ts` reads `AUTOTASK_USER` & `AUTOTASK_SECRET`. | `adminDiagnostics/index.ts:26-27`<br>`shared/autotask.ts:14-16` |
| **Escalation Endpoint Route** | `CLAUDE.md:28` & `BACKUPWATCH_OPERATIONAL_SPECIFICATION.md:61,87` list `/api/escalateTrigger`. | Route is explicitly defined as `/api/escalate`. Frontend calls `/api/escalate`. | `escalateTrigger/function.json:11`<br>`spfx-client/.../BackupWatch.tsx:351` |
| **Admin Endpoints Architecture** | `CLAUDE.md:28` states `/api/adminDiagnostics` and `/api/adminRouting` serve frontend requests. | Frontend routes via `?action=adminDiagnostics` and `?action=adminRouting` on `backupWatchTrigger`. Standalone endpoints are dead code. | `spfx-client/.../BackupWatch.tsx:608-619`<br>`backupWatchTrigger/index.ts:1202, 1306` |
| **Table Storage Tables** | Spec lines 75–80 list 4 tables (`Exclusions`, `TrackedTickets`, `ScanStatus`, `AuditLogs`). | Code uses a 5th persistent table: `SystemConfig` (partitions: `Autotask`, `Global`, `AlertRouting`). | `shared/configService.ts:36, 113, 277` |
| **Database Statelessness** | `.antigravity/rules.md:9` states: "STRICTLY STATELESS. Absolutely no databases, tables, or file system storage." | Code utilizes 5 Azure Table Storage tables to persist rules, tickets, configs, and audit logs. | `shared/tableService.ts:8-30`<br>`shared/configService.ts:36` |
| **Frontend Styling Framework** | `.antigravity/rules.md:7` states styling is "Tailwind CSS". | Vanilla CSS / CSS-in-JS inside `BackupWatchStyles.tsx`. Tailwind is not present in `package.json`. | `spfx-client/.../styles/BackupWatchStyles.tsx:1-751` |
| **Entra ID Group Check** | `.antigravity/rules.md:13` states group checks happen "in Entra ID via Microsoft Graph". | Backend never calls Microsoft Graph; it decodes unverified JWT Bearer tokens or `X-MS-CLIENT-PRINCIPAL`. | `shared/auth.ts:114-155` |
| **Key Vault Secrets** | `.antigravity/rules.md:14` states secrets are fetched "via Azure Key Vault using Managed Identity". | Third-party credentials are read directly from `process.env`. | `backupWatchTrigger/index.ts:316`<br>`shared/autotask.ts:14-16` |
| **Autotask Concurrency Principle** | `.antigravity/rules.md:17` states "Always use concurrent calls (Promise.all)". | Autotask queries are serialized and paced with 100ms intervals to prevent breaching 3-thread limit. | `backupWatchTrigger/index.ts:402, 763` |
| **Scaffold Project Path** | `.antigravity/rules.md:23` & `memory.md:25` cite `C:\AG\BackupWatchScaffold`. | Project directory is `C:\Projects\BackupWatchScaffold`. | `C:\Projects\BackupWatchScaffold\package.json` |
| **Active Appliance Check** | `memory.md:49` states status is based purely on `servicePeriod > now`. | `isApplianceActive` includes 30-day fallback check on `lastCheckin` for empty/missing `servicePeriod`. | `backupWatchTrigger/index.ts:127-140` |
| **Appliance Silence Blackout** | Spec & `memory.md:59` claim Tier 1 Appliance Silence ensures "0 Autotask API calls, 0 Auto-Heal sweeps". | Storage, device offline, and offsite sync auto-heals do not check appliance silence; sweep does not check appliance silence. | `backupWatchTrigger/index.ts:894, 916, 1114` |
| **RowKey Format** | `memory.md:54` gives example `Volume%3AMyServer%3AD%3A%5C`. | Normalization strips colons and backslashes, producing `Volume%3AMyServer%3AD`. | `shared/volumeUtils.ts:26-36` |
| **Priority Routing Matrix** | `ROADMAP.md:15-23` lists Dynamic Priority Matrix as "Queued / Planned for Future Release". | **Already implemented and active in code** under `DEFAULT_ALERT_ROUTING_MATRIX` and `AdminModal.tsx`. | `shared/configService.ts:177-262` |
| **Granular Issue Classification** | `ROADMAP.md:24-27` lists Issue/Sub-Issue Classification as "Under Active Investigation". | **Already implemented and active in code** with picklist mapping and table persistence. | `shared/configService.ts:178-261`<br>`shared/autotask.ts:791-792` |
| **Custom Ticket Title Templates** | `ROADMAP.md:28-30` lists Customizable Title Templates as "Under Discussion". | **Already implemented and active in code** via `titleTemplate` token replacement (`{Company}`, etc.). | `shared/autotask.ts:681-689` |
| **Offline Appliance Threshold** | `ROADMAP.md:19` cites "Appliance Offline >48h". | Backend evaluates `lastCheckinVal > 3600` seconds (1 hour). | `backupWatchTrigger/index.ts:915` |
| **Cache Bypass Query Param** | Spec states `?forceRefresh=true` or `?refresh=true`. | Code strictly evaluates `req.query.refresh === 'true' \|\| req.query.force === 'true'`. `forceRefresh` is ignored. | `backupWatchTrigger/index.ts:1802` |
| **Metric Cards Count** | `BackupWatch.tsx:1479` comment states "Aggregations for the 7 top metrics cards". | Code computes and renders exactly 8 metric cards. | `spfx-client/.../BackupWatch.tsx:1479-1511`<br>`MetricCards.tsx:38-47` |
| **Backend vs Client Versions** | Docs assume frontend and backend are released in lockstep at `1.23.2`. | `stateless-backend` is `1.23.2`, while `spfx-client` package and manifest are `1.23.1`. | `shared/version.ts:1`<br>`spfx-client/package.json:3` |
| **Scaffold Feature Version** | Scaffold solution version is `1.23.1.0`. | `features[0].version` in `package-solution.json` is `1.22.1.0`. | `BackupWatchScaffold/config/package-solution.json:37` |
