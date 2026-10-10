# Graph Report - FifoDash  (2026-10-01)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 351 nodes · 702 edges · 25 communities (19 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- backupWatchTrigger/index.ts
- BackupWatch
- test_rbac_authorization.js
- stateless-backend/package.json
- compilerOptions
- spfx-client/package.json
- BackupWatch.tsx
- BackupWatch
- BackupWatch.d.ts
- test_volume_mute_logic.js
- BackupWatchWebPart.manifest.json
- test_volume_dedup_prevention.js
- compilerOptions
- test_3tier_silence.js
- test_ticket_retention.js
- test_mandatory_ticket.js
- test_exclusion_lifecycle_sync.js
- BackupWatchWebPart.js
- BackupWatch.js
- dependencies
- BackupWatchWebPart
- BackupWatchWebPart
- BackupWatchWebPart
- devDependencies
- @microsoft/sp-http

## God Nodes (most connected - your core abstractions)
1. `BackupWatch` - 46 edges
2. `runPipeline()` - 24 edges
3. `getTableClient()` - 23 edges
4. `getAutoTaskBaseUrl()` - 20 edges
5. `httpTrigger()` - 19 edges
6. `httpTrigger()` - 16 edges
7. `getUserSecurityContext()` - 14 edges
8. `getAutoTaskHeaders()` - 14 edges
9. `httpTrigger()` - 13 edges
10. `createComplianceTicket()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `httpTrigger()` --calls--> `getUserSecurityContext()`  [EXTRACTED]
  stateless-backend/adminDiagnostics/index.ts → stateless-backend/shared/auth.ts
- `httpTrigger()` --calls--> `getTableClient()`  [EXTRACTED]
  stateless-backend/adminDiagnostics/index.ts → stateless-backend/shared/tableService.ts
- `httpTrigger()` --calls--> `getUserSecurityContext()`  [EXTRACTED]
  stateless-backend/adminRouting/index.ts → stateless-backend/shared/auth.ts
- `httpTrigger()` --calls--> `getAutoTaskConfig()`  [EXTRACTED]
  stateless-backend/adminRouting/index.ts → stateless-backend/shared/autotask.ts
- `httpTrigger()` --calls--> `getTicketFieldPicklistValues()`  [EXTRACTED]
  stateless-backend/adminRouting/index.ts → stateless-backend/shared/autotask.ts

## Import Cycles
- None detected.

## Communities (25 total, 6 thin omitted)

### Community 0 - "backupWatchTrigger/index.ts"
Cohesion: 0.10
Nodes (70): axios, @azure/data-tables, @azure/functions, httpTrigger(), httpTrigger(), httpTrigger(), timerTrigger(), applyExclusionsToDevices() (+62 more)

### Community 2 - "test_rbac_authorization.js"
Cohesion: 0.09
Nodes (19): adminClaims, adminCtx, adminHeader, adminReq, assert, contributorClaims, contributorCtx, contributorHeader (+11 more)

### Community 3 - "stateless-backend/package.json"
Cohesion: 0.09
Nodes (21): @types/node, typescript, dependencies, axios, @azure/data-tables, @azure/functions, description, devDependencies (+13 more)

### Community 4 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, declaration, experimentalDecorators, forceConsistentCasingInFileNames, jsx, lib, module, outDir (+5 more)

### Community 5 - "spfx-client/package.json"
Cohesion: 0.17
Nodes (11): @microsoft/sp-lodash-subset, @types/react, @types/react-dom, description, rimraf, main, name, scripts (+3 more)

### Community 6 - "BackupWatch.tsx"
Cohesion: 0.23
Nodes (8): react, IBackupWatchWebPartProps, IAgentResult, IBackupWatchState, IDattoDevice, IEscalatableIssue, IExclusion, IBackupWatchProps

### Community 8 - "BackupWatch.d.ts"
Cohesion: 0.17
Nodes (6): BackupWatch, IAgentResult, IBackupWatchState, IDattoDevice, IEscalatableIssue, IExclusion

### Community 9 - "test_volume_mute_logic.js"
Cohesion: 0.18
Nodes (9): assert, deviceMutedExclusions, devMute, exclusions, matchC, matchF, matchFSlash, { normalizeVolumeName, buildVolumeTargetKey, isVolumeExcluded, isDeviceMuted } (+1 more)

### Community 10 - "BackupWatchWebPart.manifest.json"
Cohesion: 0.18
Nodes (10): alias, componentType, id, manifestVersion, preconfiguredEntries, requiresCustomScript, $schema, supportedHosts (+2 more)

### Community 11 - "test_volume_dedup_prevention.js"
Cohesion: 0.18
Nodes (10): assert, createdTickets, deduplicated, dynamicExclusions, incomingAssetVolumes, mockExclusions, { normalizeVolumeName, buildVolumeTargetKey, isVolumeExcluded }, rawVariations (+2 more)

### Community 12 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, outDir, resolveJsonModule, rootDir, skipLibCheck, sourceMap (+2 more)

### Community 13 - "test_3tier_silence.js"
Cohesion: 0.22
Nodes (4): dc01VolC, dc01VolE, { 
    normalizeVolumeName, 
    buildVolumeTargetKey, 
    isVolumeExcluded, 
    isDeviceSilenced, 
    isAgentSilenced 
}, testExclusions

### Community 14 - "test_ticket_retention.js"
Cohesion: 0.29
Nodes (5): assert, mockPostExclusion(), mockTableStorage, { normalizeVolumeName, buildVolumeTargetKey, isVolumeExcluded }, runTests()

### Community 15 - "test_mandatory_ticket.js"
Cohesion: 0.25
Nodes (5): assert, res1, res2, res3, res4

### Community 16 - "test_exclusion_lifecycle_sync.js"
Cohesion: 0.29
Nodes (4): assert, mockAutotaskTickets, mockDevices, { normalizeVolumeName, isVolumeExcluded }

### Community 17 - "BackupWatchWebPart.js"
Cohesion: 0.40
Nodes (3): @microsoft/sp-webpart-base, react-dom, IBackupWatchWebPartProps

### Community 18 - "BackupWatch.js"
Cohesion: 0.60
Nodes (5): adopt(), fulfilled(), rejected(), step(), verb()

### Community 19 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, @microsoft/sp-http, @microsoft/sp-lodash-subset, @microsoft/sp-webpart-base, react, react-dom

### Community 23 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, rimraf, @types/react, @types/react-dom, typescript

## Knowledge Gaps
- **149 isolated node(s):** `IAgentResult`, `IExclusionEntity`, `ITrackedTicketEntity`, `ITrackedTicketEntity`, `IUserSecurityContext` (+144 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 179 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `typescript` connect `stateless-backend/package.json` to `spfx-client/package.json`?**
  _High betweenness centrality (0.226) - this node is a cross-community bridge._
- **Why does `BackupWatch` connect `BackupWatch` to `BackupWatch.tsx`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **Why does `react` connect `BackupWatch.tsx` to `BackupWatch.d.ts`, `BackupWatchWebPart.js`, `BackupWatch.js`, `spfx-client/package.json`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **What connects `IAgentResult`, `IExclusionEntity`, `ITrackedTicketEntity` to the rest of the system?**
  _149 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `backupWatchTrigger/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0957542908762421 - nodes in this community are weakly interconnected._
- **Should `BackupWatch` be split into smaller, more focused modules?**
  _Cohesion score 0.12367864693446089 - nodes in this community are weakly interconnected._
- **Should `test_rbac_authorization.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._