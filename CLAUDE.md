# CLAUDE.md - AI Coding Assistant & Developer Guide for BackupWatch

> **Repository:** Fifosys BackupWatch  
> **Architecture:** Decoupled Hybrid Platform — SPFx Frontend (`spfx-client/`) + Azure Serverless Backend (`stateless-backend/`)  
> **Primary Purpose:** Unified MSP Data Protection & BCDR Monitoring Dashboard integrating Datto BCDR and Datto Autotask PSA.

---

## 1. Safety & Production Guardrails (CRITICAL)

To protect live production systems and prevent accidental client/service desk disruptions:
- **No Live Modifying Operations During Inspection**: Never trigger live ticket creation, updates, deletes, or volume exclusion changes during analysis or troubleshooting.
- **Use Mock Clients or Sandboxes**: All local tests must use stubbed responses or isolated mock data.
- **Read-Only API Calls by Default**: When investigating API contracts, use strictly non-modifying `GET` queries.
- **Drive Letter Normalization**: Drive letters must ALWAYS be strictly normalized (uppercase letter with colon/backslash stripped, e.g. `D` instead of `D:\` or `d:`) before comparing or saving to Azure Table Storage row keys.

---

## 2. Decoupled Architecture & Versioning Rule

The frontend and backend are completely decoupled:
1. **Frontend SPFx Client (`spfx-client/`)**:
   - Built using SharePoint Framework (SPFx 1.19.0) with React 17 + TypeScript.
   - Hosted on SharePoint Online (`fifosys365.sharepoint.com/sites/BackupWatchPortal/SitePages/Home.aspx`).
   - **Versioning**: the header shows no version. The footer is the only place versions appear: `UI v… · Engine v…` – UI from the web part manifest (`this.context.manifest.version`), Engine from `resData.appVersion`.
2. **Backend Serverless API (`stateless-backend/`)**:
   - Azure Function App (`backupwatch-api`, Node.js / TypeScript, Linux Flex Consumption).
   - Serves endpoints: `/api/backupWatchTrigger`, `/api/exclusions`, `/api/escalateTrigger`, `/api/auditlogs`, `/api/adminDiagnostics`, `/api/adminRouting`.
   - Backend reports its version as `appVersion` from `stateless-backend/shared/version.ts` (written by the release script).

### Release Rule (separate versions – decision D-03, final 2026-10-12):
- **Backend and web part each have their own version**, held in the repo-root `versions.json` (`{ "backend": "x.y.z", "web": "x.y.z" }`). Only the half that changed gets a new number and is deployed.
- **Never edit version numbers by hand** – from the repo root run `npm run release -- backend|web|both patch|minor|major` (which half changed; fix = patch, something new = minor, changes how it all works = major). It writes that half's files – backend: `stateless-backend/shared/version.ts`, `package.json`, `package-lock.json`; web part: `spfx-client/package.json`, `package-lock.json`, `BackupWatchWebPart.manifest.json`, `spfx-client/config/package-solution.json` (solution + every feature version, `x.y.z.0`) – and adds a CHANGELOG stub labelled `Backend x.y.z`, `Web part x.y.z` or both.
- `npm run verify-versions` fails if any file disagrees with `versions.json`; it runs automatically before every backend build and at the start of `npm run build:web`.
- **Deploy only what changed** (§4): backend change → Azure only; web part change → `.sppkg` upload only; both → both.
- **Where versions show:** footer only – `UI v… · Engine v…`. The header shows no version. Different numbers are normal.
- Git tags per deployed half: `backend-x.y.z`, `frontend-x.y.z`.

---

## 3. Directory Layout & Module Structure

```
c:/Projects/FifoDash/
├── .agents/
│   └── AGENTS.md                  # Workspace rules & production isolation protocol
├── REPO_MAP.md                    # Tree-Sitter & PageRank code architecture map
├── CHANGELOG.md                   # Semantic version changelog
├── BACKUPWATCH_OPERATIONAL_SPECIFICATION.md # Comprehensive 700-line operational spec
├── backup-watch-scaffold.sppkg    # Compiled production SPFx solution package (git-ignored)
├── package.json                   # Release scripts (npm run release / verify-versions / build:web)
├── versions.json                  # Backend and web part versions (the only place versions are typed)
├── scripts/                       # release.mjs, verify-versions.mjs, build-web.mjs (+ tests)
├── spfx-client/                   # The complete SPFx project (config/, gulpfile.js, teams/ icons, package-lock.json); build tools in node_modules (git-ignored)
│   └── src/webparts/backupWatch/
│       ├── BackupWatchWebPart.ts  # SPFx web part entrypoint & props binder
│       ├── assets/fifosysLogo.ts  # Base64 embedded official Fifosys emblem
│       └── components/
│           ├── BackupWatch.tsx    # Root state container, data fetcher & coordinator
│           ├── types/
│           │   └── BackupWatchTypes.ts   # Core interfaces (IAgentResult, IDattoDevice, etc.)
│           ├── styles/
│           │   └── BackupWatchStyles.tsx # Cyber Navy & Enterprise Clean CSS stylesheet
│           ├── appliance/
│           │   ├── HeaderBar.tsx         # Hero toolbar, mode switcher & user badge
│           │   ├── MetricCards.tsx       # 8-Card responsive fleet KPI grid
│           │   └── ExclusionsTable.tsx   # Exclusions list view & management actions
│           └── modals/
│               ├── MutingModal.tsx       # 3-tier silence & volume exclusion modal
│               ├── EscalationModal.tsx   # Bulk Autotask escalation checklist modal
│               ├── AuditLogsDrawer.tsx   # System audit log viewer & CSV exporter
│               └── AdminModal.tsx        # 5-tab admin console (diagnostics, routing, blackout, cleanup, tester)
└── stateless-backend/             # Azure Functions Node.js/TypeScript backend
    ├── backupWatchTrigger/        # Primary dashboard data ingestion & cache endpoint
    ├── exclusions/                # Volume & device exclusion CRUD endpoint
    ├── escalateTrigger/           # Autotask ticket creation & escalation endpoint
    ├── auditLogs/                 # Audit trail retrieval endpoint
    ├── adminDiagnostics/          # Autotask / Datto connectivity diagnostic probes
    ├── adminRouting/              # Service desk queue, category & priority configuration
    └── shared/                    # Shared utilities (autotask.ts, volumeUtils.ts, version.ts)
```

---

## 4. Build, Test & Deployment Commands

### Release (version bump – only the half that changed):
```powershell
cd c:\Projects\FifoDash
npm run release -- web minor  # backend|web|both + patch|minor|major; fill in the CHANGELOG stub, commit
npm test                     # tests for the release tooling itself
```

### Backend Build & Deploy:
```powershell
# From stateless-backend/
cd c:\Projects\FifoDash\stateless-backend
npm run build      # checks versions, cleans dist/, then tsc
func start         # Local emulator (requires local.settings.json)

# Deploy to live Azure (always build locally first, then publish with --build local)
npm ci
npm test
npm run build
npm prune --omit=dev          # keep jest/ts-jest/typescript out of the deployed node_modules
func azure functionapp publish backupwatch-api --build local
npm install                   # restore dev dependencies afterwards
```
> `--build local` is required: `.funcignore` excludes the TypeScript sources and `tsconfig.json`, so a remote build cannot compile the app. Remote build is not supported for this repo.

### Frontend Build & Bundle:
> `spfx-client/` is the complete SPFx 1.19 project, tracked in this repo (moved in from the old external `C:\Projects\BackupWatchScaffold`, 2026-11-03). Edit its `config/`, `gulpfile.js` and `package.json` there.
> SPFx 1.19 supports Node 18 only. `build:web` runs gulp on Node 18.20.8 via `npx` whatever Node the machine has – never patch Microsoft's version check.

```powershell
# One-off (or after package.json / package-lock.json changes): install the build tools
cd c:\Projects\FifoDash\spfx-client
npm install

# Build: checks versions, removes old output, gulp bundle + package-solution --ship, copies the .sppkg to the repo root
cd c:\Projects\FifoDash
npm run build:web
```

### Architecture Map Generation:
Whenever significant code or structure changes occur:
```powershell
uv run --python 3.12 --with "tree-sitter,tree-sitter-language-pack,networkx" python "C:\Users\m.wijesinghe\.gemini\config\skills\repo-map\generate_repo_map.py" . "REPO_MAP.md"
```

---

## 5. Key Business Logic & Algorithms

1. **3-Tier Silence Hierarchy**:
   - `Appliance Level`: Silences all device alerts.
   - `Agent Level`: Silences specific VM or physical server alerts.
   - `Volume Level`: Silences specific drive letters (e.g., `D`) under an agent.
2. **Autotask DeepLinks**:
   - Tickets link directly to: `https://ww16.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc/Index?ticketId={ticketId}`.
3. **Autotask Gateway (BW-004) – the only way to call Autotask**:
   - Every Autotask HTTP request goes through `shared/autotaskGateway.ts`: 1 request at a time per instance (max instances is 1, but Flex runs the timer scan on its own instance, so at most 2 at once – Autotask allows 3), engineer actions (`runAsUserAction`) ahead of scanner calls, retries after 1 s / 2 s / 4 s when Autotask is busy, 60 s queue wait cap, safe logging. `tests/autotaskGuardRails.test.ts` fails the build if anything else calls Autotask or builds its credential headers.
   - `getTicketEntityFields` still collapses parallel metadata calls into 1 request (in-flight promise + 1-hour cache).
4. **Autotask Write Policy (BW-006 / BW-007, decisions D-01 / D-02)**:
   - Every write (`createTicketInAutoTask`, `createTicketNoteInAutoTask`, `updateTicketStatusInAutoTask`, `createComplianceTicket`) requires an `IAutotaskWriteContext` (`origin: "scanner" | "user"`, action, device/agent, user, override reason) and is checked by `shared/autotaskPolicy.ts`.
   - **Silence:** automatic writes for a silenced appliance/agent are held back (audited as "Suppressed Autotask Write"); scanner code checks `getScannerSuppression()` before changing table state so held-back items are retried on a later scan.
   - **Change freeze (global blackout):** all automatic writes stop; user changes (escalate, mute/exclude, unmute) are blocked server-side by `requireNoChangeFreeze` (`shared/changeFreeze.ts`) for everyone below Administrator. Administrators must send `overrideBlackout: true` + `overrideReason` (audited as "Change During Blackout"). Admin Console settings stay available to Administrators.
5. **Active vs. Cancelled Appliances**:
   - Filtered dynamically based on `d.isActive !== false`. Cancelled appliances appear under the "Cancelled Appliances" secondary tab.
6. **Cache Engine**:
   - 5-minute in-memory caching in Azure host memory; merges live Azure Table Storage exclusion rules on every request so mutes/unmutes take effect instantly.
7. **Read-only dashboard loads, scans write (BW-023, decisions D-07 / D-08)**:
   - `runPipeline(context, forceRefresh, isScan)`: `isScan` false (someone opening the dashboard) reads Datto and Autotask and shows **everything**, but writes nothing to Autotask or the Exclusions/TrackedTickets tables. Only a scan (`isScan` true) runs the exclusion sweep, compliance tickets, auto-heal notes and ticket pruning.
   - Scans: the 30-minute timer and **Force Scan** (`?refresh=true`, Specialist/Administrator only, audited). Both run inside `withScanLock` (`shared/scanLock.ts`, one Table Storage row, 15-minute expiry) so they never overlap – Flex runs the timer on its own instance. A test fails the build if `runPipeline(…, true)` is called outside the lock.
   - The dashboard must always show complete information (D-07): never remove information from it to make it faster.
