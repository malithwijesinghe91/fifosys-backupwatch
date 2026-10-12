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
   - **Dynamic Versioning**: The UI header does **NOT** hardcode its version; it binds dynamically to `resData.appVersion` returned by the Azure backend.
2. **Backend Serverless API (`stateless-backend/`)**:
   - Azure Function App (`backupwatch-api`, Node.js / TypeScript, Linux Flex Consumption).
   - Serves endpoints: `/api/backupWatchTrigger`, `/api/exclusions`, `/api/escalateTrigger`, `/api/auditlogs`, `/api/adminDiagnostics`, `/api/adminRouting`.
   - Single source of truth for version is `stateless-backend/shared/version.ts`.

### Release Rule:
- **Backend-Only Changes (Bugfixes, API logic, scanner)**: Bump `version.ts`, `package.json`, then from `stateless-backend/` run `npm run build` followed by `func azure functionapp publish backupwatch-api --build local` (remote build is not supported – see §4). **Do NOT rebuild or upload `.sppkg`.**
- **Frontend Changes (React components, UI styling, layouts)**: Rebuild package in `BackupWatchScaffold`, copy `backup-watch-scaffold.sppkg` to root, and upload to SharePoint App Catalog.

---

## 3. Directory Layout & Module Structure

```
c:/Projects/FifoDash/
├── .agents/
│   └── AGENTS.md                  # Workspace rules & production isolation protocol
├── REPO_MAP.md                    # Tree-Sitter & PageRank code architecture map
├── CHANGELOG.md                   # Semantic version changelog
├── BACKUPWATCH_OPERATIONAL_SPECIFICATION.md # Comprehensive 700-line operational spec
├── backup-watch-scaffold.sppkg    # Compiled production SPFx solution package
├── spfx-client/                   # SharePoint Framework client workspace
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

### Backend Build & Deploy:
```powershell
# From stateless-backend/
cd c:\Projects\FifoDash\stateless-backend
npm run build      # or: tsc
func start         # Local emulator (requires local.settings.json)

# Deploy to live Azure (always build locally first, then publish with --build local)
npm run build
func azure functionapp publish backupwatch-api --build local
```
> `--build local` is required: `.funcignore` excludes the TypeScript sources and `tsconfig.json`, so a remote build cannot compile the app. Remote build is not supported for this repo.

### Frontend Build & Bundle:
> **Note on Windows**: PowerShell execution policies may restrict `gulp.ps1`. Use direct `node` invocation via `BackupWatchScaffold`:

```powershell
# 0. Remove old build output (release\ and temp\) so stale bundles are not packed into the .sppkg
Remove-Item "c:\Projects\BackupWatchScaffold\release", "c:\Projects\BackupWatchScaffold\temp" -Recurse -Force -ErrorAction SilentlyContinue

# 1. Sync spfx-client/src to BackupWatchScaffold/src
robocopy "c:\Projects\FifoDash\spfx-client\src" "c:\Projects\BackupWatchScaffold\src" /E /NFL /NDL /NJH /NJS /NC /NS /NP

# 2. Bundle in Ship Mode (Production)
cd c:\Projects\BackupWatchScaffold
node node_modules\gulp\bin\gulp.js bundle --ship

# 3. Package Solution (.sppkg)
node node_modules\gulp\bin\gulp.js package-solution --ship

# 4. Copy to FifoDash root
copy-item "c:\Projects\BackupWatchScaffold\sharepoint\solution\backup-watch-scaffold.sppkg" "c:\Projects\FifoDash\backup-watch-scaffold.sppkg" -Force
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
3. **Autotask Concurrency Mutex**:
   - To respect Autotask PSA's 3-thread threshold, `getTicketEntityFields` uses an in-flight promise singleton to collapse parallel metadata calls into exactly 1 HTTP request.
4. **Active vs. Cancelled Appliances**:
   - Filtered dynamically based on `d.isActive !== false`. Cancelled appliances appear under the "Cancelled Appliances" secondary tab.
5. **Cache Engine**:
   - 5-minute in-memory caching in Azure host memory; merges live Azure Table Storage exclusion rules on every request so mutes/unmutes take effect instantly.
