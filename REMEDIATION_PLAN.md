# BackupWatch Remediation Plan & Progress Tracker

> **Owner:** Malith Wijesinghe
> **Created:** 2026-10-10
> **Last updated:** 2026-10-12
> **Baseline:** Backend v1.23.2 / Frontend v1.23.1
> **Source of findings:** `CODE_VERIFICATION_REPORT.md` (read-only code audit, 2026-10-10)

This is the single source of truth for every defect found in the October 2026 code audit, how each one will be fixed, and where it is up to. If it isn't in this file, it isn't tracked.

---

## How to use this file

**Status values** (use exactly these words so the file stays searchable):

| Status | Meaning |
|---|---|
| `TODO` | Not started |
| `DECISION` | Waiting for a decision from the owner before work can start |
| `IN PROGRESS` | Being worked on |
| `TESTING` | Code done, being verified (tests / staging) |
| `DONE` | Released, verified, changelog entry written |
| `BLOCKED` | Cannot proceed; reason in the progress log |
| `WONTFIX` | Deliberately not fixing; reason in the progress log |

**Rules for anyone (human or AI assistant) working an item:**

1. Read the item's *Fix* and *Acceptance criteria* before starting. Do not widen the scope silently; add a new item instead.
2. Production safety rules from `CLAUDE.md` and `.agents/AGENTS.md` apply in full: no live writes to Autotask, Datto or Table Storage during development or testing. Mocks only.
3. When starting: set status to `IN PROGRESS` in **both** the summary table and the item, and add a dated line to the item's *Progress log*.
4. Tick each checkbox as the step is completed.
5. When released: set `DONE`, record the release version, and make sure `CHANGELOG.md` references the item ID (e.g. `Fixed (BW-001): ...`).
6. Update *Last updated* at the top of this file.
7. One item (or one tightly related group) per release where possible, so any regression can be traced and rolled back.

---

## Summary

| ID | Title | Severity | Phase | Release type | Status | Released in |
|---|---|---|---|---|---|---|
| BW-020 | No source control | High | 0 | Tooling | `DONE` | baseline-2026-10-10 |
| BW-022 | Audit Trail button unresponsive since 1.23.2 (unbound click handler) | High | 0 | Frontend | `DONE` | Frontend 1.23.3 |
| BW-023 | Dashboard request runs the full scan (slow loads; Autotask writes on page load) | Medium | 3 | Backend + small web part | `DONE` | Backend 1.26.0 + Web part 1.28.1 |
| BW-024 | Appliance storage shown in the wrong unit (TB labelled as GB) | Medium | 3 | Backend | `DONE` | |
| BW-025 | Exclusions on archived agents never cleaned up; duplicate agent names | Medium | 3 | Backend | `DONE` | Backend 1.26.1 |
| BW-026 | Automatic handling of backup and screenshot failures (smart ticketing) | Medium | 5 | Backend + web part | `BACKLOG` | |
| BW-001 | Backend trusts client-supplied role (privilege escalation) | Critical | 1 | Backend + Entra config (+ small frontend) | `DONE` | Backend 1.24.0 + Frontend 1.23.4 |
| BW-002 | JWT decoded but not verified; all functions `anonymous` | High | 1 | Backend | `TODO` | |
| BW-003 | Confirm Easy Auth / Entra configuration | High | 1 | Azure config (no code) | `DONE` | n/a (config check) |
| BW-004 | Autotask concurrency can exceed 3-thread limit | High | 2 | Backend | `TESTING` | |
| BW-005 | Datto asset fetch is unbounded `Promise.all` | Medium | 2 | Backend | `TODO` | |
| BW-006 | Appliance silence does not block all Autotask writes | Medium | 2 | Backend | `TESTING` | |
| BW-007 | Global blackout (change freeze) not enforced on manual changes | Medium | 2 | Backend + frontend | `TESTING` | |
| BW-008 | Expired exclusion deleted before follow-up ticket is confirmed | Medium (to verify) | 3 | Backend | `TODO` | |
| BW-009 | Linux root volume `/` normalised to empty string | High (if Linux agents exist) | 3 | Backend | `TODO` | |
| BW-010 | Settings handling: dead admin functions, `AT_USER` mismatch, no start-up validation | Medium | 3 | Backend | `TODO` | |
| BW-011 | Versions drift between backend, frontend and scaffold | Medium | 0 | Tooling | `DONE` | Backend 1.24.1 + Web part 1.25.1 |
| BW-012 | Is the v1.23.2 frontend refactor actually deployed? | Medium | 0 | Verification only | `DONE` | n/a (Frontend 1.23.4 confirmed live) |
| BW-013 | Only Autotask status 5 treated as closed | Low/Medium | 3 | Backend | `DECISION` | |
| BW-014 | Silent `catch {}` blocks hide failures | Low | 4 | Backend | `TODO` | |
| BW-015 | Raw volume names in `volumesList` | Low | 3 | Backend | `TODO` | |
| BW-016 | Documentation out of date / contradictory | Low | 4 | Docs | `TODO` | |
| BW-017 | No automated test runner | Medium | 0 | Tooling | `DONE` | |
| BW-018 | Auto-ticket toggles for 6 alert types do nothing | Medium | 4 | Backend + frontend | `DECISION` | |
| BW-019 | Scratch scripts can write to live Table Storage | Medium | 0 | Tooling | `DONE` | |

### Phases

| Phase | Goal | Items |
|---|---|---|
| **0 – Foundations** | Make every later fix testable, safely releasable and correctly versioned | BW-020, BW-022, BW-017, BW-011, BW-012, BW-019 |
| **1 – Security** | Roles enforced server-side from Entra; no client trust | BW-003, BW-001, BW-002 |
| **2 – Autotask gateway & suppression** | One choke point for all Autotask traffic that enforces rate limits, silence and blackout | BW-004, BW-006, BW-007, BW-005 |
| **3 – Correctness** | Fix data-handling bugs | BW-009, BW-008, BW-013, BW-015, BW-010, BW-023, BW-024, BW-025 |
| **4 – Hygiene** | Clean-up, docs, misleading UI | BW-014, BW-016, BW-018 |

> Status 2026-10-18: Phase 0 complete; BW-001/003/024 done (BW-002 has only an optional step left); BW-004/006/007 live and in their 30-day check. Max instances now 1 (D-04). BW-023 done (backend 1.26.0 + web part 1.28.1). Next: D-05 / BW-018 (priority raised by D-07), then scanner reliability (BW-008, BW-005, BW-014). On hold by owner: BW-009, BW-013 (D-06). Parked: moving the web part to Azure Static Web Apps (feasible; reviewed 2026-10-18, not pursued now).

---

## Decisions log

| ID | Question | Proposed answer | Decision | Date |
|---|---|---|---|---|
| D-01 (BW-006) | When an appliance/agent is silenced and a tracked issue clears, should the auto-heal note still be posted to Autotask? | **No.** No Autotask writes of any kind while silenced. The first scan after un-muting posts the auto-heal note. Suppressed actions are written to the audit log. | **No** (as proposed). Nothing is sent to Autotask while an appliance/agent is silenced; held-back actions are audit-logged; the first scan after un-muting posts any auto-heal note. | 2026-10-12 |
| D-02 (BW-007) | During a global blackout, can engineers still escalate manually? | **Soft block.** Warning shown; Specialist/Administrator may override with a mandatory reason (audited); Contributor blocked. | **A blackout (change freeze) is a blackout.** While it is active, **every change** is blocked for Specialist, Contributor and Viewer – escalations, exclusions (add/edit/remove), mutes/unmutes and any other write. Only the **Administrator** role may still act, with a mandatory reason that is audited. Automatic Autotask writes by the scanner are also suppressed (see D-01 / BW-006). | 2026-10-12 |
| D-03 (BW-011) | Lockstep versioning, or separate backend/frontend versions? | **Separate versions** (matches the existing release rule that backend-only changes don't rebuild the `.sppkg`), managed by one script and shown side by side in the UI. | **Separate versions** (final). Briefly decided as shared (1.24.1 was cut that way), then changed after reviewing the display: each half has its own number in `versions.json`, only the half that changed is bumped and deployed; versions shown in the footer only (`UI v… · Engine v…`), none in the header. | 2026-10-12 |
| D-04 (BW-004) | Multi-instance protection: cap Function App instances, or queue all Autotask writes? | **Now:** cap max instances (1–2) + in-process gateway. **Later, if volume grows:** Azure Storage Queue with a single consumer for all Autotask writes. | **Leave as is for now; review later.** Max instances stays at 2 (set 2026-10-11) and the in-process gateway is built in BW-004; the Storage Queue option is not pursued now. **Review again** after BW-004 is live (e.g. if "Thread Threshold Exceeded" alerts return or ticket volume grows). **Updated 2026-10-18 (Malith): max instances set to 1.** Usage is low (153 dashboard loads in 30 days, peak 9 requests a minute). The timer scan always runs on its own instance (Flex scales HTTP and timer functions separately and the cap applies to each group), so at most 2 instances run at once and at most 2 Autotask requests are in flight (previously up to 3). | 2026-10-12, updated 2026-10-18 |
| D-05 (BW-018) | The 6 non-volume auto-ticket toggles do nothing. Hide them, or implement auto-ticketing? | **Short term:** disable them in the UI with "Not yet available". **Long term:** implement per alert type, one at a time, behind the existing toggle. | *Pending* – owner asked what the 6 toggles are (explained 2026-10-12). | |
| D-06 (BW-013) | Which Autotask statuses count as "closed"? | Make it configurable in Admin Console (default: Completed + any status whose label contains "Cancel" or "Closed"). Needs the live status picklist to confirm. | **Deferred – review later** (Malith). BW-013 stays on hold. | 2026-10-12 |
| D-07 (all) | What is the dashboard for? | – | **Occasional use now, possibly the main alert view later** (Malith). Day to day the team relies on alerts and uses the dashboard mainly to add exclusions, but the dashboard must **always show complete information** – no change may strip information from it – because Datto's own alerts may later be retired in favour of BackupWatch. Consequence: alerting must come from the background scan, not from someone opening the page (raises the priority of D-05 / BW-018 and the scanner reliability items). | 2026-10-18 |
| D-09 (BW-025) | What should the scan do with an exclusion whose agent is archived in Datto? | **Option A:** open ticket – post one note, then remove; closed or no ticket – remove. Audited. Option B: never remove; flag "Agent archived – review". | **Option A** (Malith). | 2026-10-19 |
| D-08 (BW-023) | How far should BW-023 go? | Full version: shared snapshot, instant loads, queued refresh. | **Reduced scope** (Malith). Opening the dashboard stays a live read (5–15 s is fine for occasional use) but never writes to Autotask; only scans write. The Force Refresh button becomes a real **Force Scan** (Specialist/Administrator) that runs a full scan and waits for it (scans take about 7 s). A shared lock stops a forced scan overlapping the timer scan. The snapshot / instant-load version can be revisited if usage grows. | 2026-10-18 |

---

## Phase 0 – Foundations

### BW-020 – No source control
**Status:** `DONE`  **Severity:** High  **Release type:** Tooling (no deployment)

**Finding.** `C:\Projects\FifoDash` had no `.git` folder: the only copy of the code was being edited in place, with no history or rollback.

**Fix.**
- [x] Backup zip taken (`FifoDash_backup_2026-10-10.zip`).
- [x] `.gitignore` added (excludes `node_modules`, `dist`, `spfx-client/lib`, `*.sppkg`, `local.settings.json`, `.env*`, `fn_details*.json`, Azurite data, graphify cache, logs).
- [x] Pre-commit secrets scan of all committed files: no keys, connection strings, passwords or tokens found.
- [x] Git initialised; baseline commit `1fa2819` "Baseline: BackupWatch backend v1.23.2 / frontend v1.23.1 (pre-remediation)"; tag `baseline-2026-10-10`.
- [x] Pushed to private GitHub repo `malithwijesinghe91/fifosys-backupwatch` (`main` tracks `origin/main`).
- [x] Verified from local git metadata: 106 tracked files; none of the excluded/secret files tracked.
- [ ] Add the repo to Claude's GitHub connection so reviews can read it directly.
- [ ] Later: move the repo into a Fifosys GitHub/Azure DevOps organisation (history is kept).
- [x] `C:\Projects\BackupWatchScaffold` is not under source control – handled in BW-011. *(Done: scaffold config tracked in `scaffold/` and copied in by `npm run scaffold:prepare`.)*

**Working rule from now on:** one branch per item (e.g. `bw-017-test-runner`), merged to `main` only after its acceptance criteria pass.

**Progress log.**
- 2026-10-10 – Repo created, baseline committed, tagged and pushed. Verified clean. `DONE`.

---

### BW-022 – Audit Trail button unresponsive since 1.23.2 (unbound click handler)
**Status:** `DONE`  **Severity:** High  **Release type:** Frontend

**Finding.** In `spfx-client/src/webparts/backupWatch/components/BackupWatch.tsx`, `_openAuditLogs` was defined as a standard class method (`private _openAuditLogs(): void`) instead of an arrow function. When passed as a callback property (`onOpenAuditLogs={this._openAuditLogs}`) to `HeaderBar`, `this` was unbound when invoked, preventing the Audit Trail drawer from opening.

**Fix.**
- [x] In `spfx-client/src/webparts/backupWatch/components/BackupWatch.tsx`, convert `_openAuditLogs` to an arrow function `private _openAuditLogs = (): void =>`.
- [x] Bump frontend version to 1.23.3 in `spfx-client/package.json`, `BackupWatchWebPart.manifest.json`, `BackupWatchScaffold/package.json`, scaffold manifest, and `BackupWatchScaffold/config/package-solution.json` (`solution.version` and `features[0].version` -> 1.23.3.0).
- [x] Sync src to scaffold via robocopy, bundle, and package solution (`gulp bundle --ship && gulp package-solution --ship`).
- [x] Copy `backup-watch-scaffold.sppkg` to repo root.
- [x] Add CHANGELOG entry for `1.23.3`.

**Acceptance criteria.** Clicking Audit Trail button opens the drawer without error; package version 1.23.3 built and ready for catalog deployment.

**Progress log.**
- 2026-10-11 – Hotfix applied (arrow function binding); frontend bumped to 1.23.3; package-solution rebuilt; awaiting SharePoint upload and live verification. `TESTING`.
- 2026-10-11 – Uploaded to App Catalog and live (confirmed by Malith). `DONE`. Branch `bw-022-audit-trail-hotfix` to be merged into `main`.

---

### BW-017 – No automated test runner
**Status:** `DONE`  **Severity:** Medium  **Release type:** Tooling (no deployment)

**Finding.** `stateless-backend/package.json` has `"test": "echo \"No tests specified\" && exit 0"`. The eight `scratch/test_*.js` files are ad-hoc and never run automatically. Every fix in this plan needs tests to prove it.

**Fix.**
- [x] Add Jest with `ts-jest` to `stateless-backend`.
- [x] Move the mock-only tests from `scratch/test_*.js` into `stateless-backend/tests/` and convert them to the runner.
- [x] Add shared mocks for Autotask, Datto and Table Storage (no network calls possible in tests; fail the test if axios is called un-mocked).
- [x] `npm test` runs all tests; `npm run verify` runs build + test.
- [x] Note: Not hooked into `prebuild` as per instructions.

**Acceptance criteria.** `npm test` passes locally with the converted tests; a deliberately broken `normalizeVolumeName` makes the test fail.

**Progress log.**
- 2026-10-10 – Item created.
- 2026-10-12 – Reviewed and corrected the first draft (its guard only replaced `global.axios`, which production code never uses, and five test files tested copies of the logic instead of production code). Final state: Jest + ts-jest; `tests/setup.ts` blocks all network access at the socket layer (http/https/net/tls/fetch) and strips live Autotask/Datto/Storage credentials, proven by `networkGuard.test.ts` (fails when the guard is disabled); mocks for Autotask, Datto, Table Storage and Functions context. Tests drive real code: `shared/volumeUtils`, `shared/auth`, `shared/autotask` (getTicketEntityFields lock/cache), the `exclusions` HTTP handler (mandatory ticket, ticket retention, twin cleanup) and `backupWatchTimerTrigger` (exact BW-021 log line). **`npm test`: 8 suites, 74 tests passed, 0 failed; 6 of the 74 are `test.failing` known bugs (3 × BW-009 Linux root `/`, 3 × BW-001 client-supplied role).** Removing `.toUpperCase()` from `normalizeVolumeName` fails 10 tests in 3 suites; restored, `shared/volumeUtils.ts` identical to main. `tsconfig.json` now excludes `tests/`, so `npm run build` emits no test files to `dist/`. No production code changed. `DONE`.
  - Gap: `scratch/test_exclusion_lifecycle_sync.js` not converted – the reconciliation sweep lives inside `runPipeline` (`backupWatchTrigger/index.ts`) and can't be unit-tested without extracting it; cover when that code is refactored (BW-010).
  - Deploy finding (config read only, not run): nothing in the repo selects a build mode (no `--build` flag in docs, no `SCM_DO_BUILD_DURING_DEPLOYMENT`/`ENABLE_ORYX_BUILD` setting), so `func azure functionapp publish backupwatch-api` uses whatever Core Tools picks by default (assumed local build; *corrected in BW-019: the default is not stated in `--help` and is unconfirmed*). `function.json` loads `../dist/*`. There is **no `.funcignore`**, so the package also ships `tests/`, `scratch/` (including `delete_ghost_entity.js`), Jest dev dependencies and any stale `dist/` files, since `build` is plain `tsc` without a clean. Recommend adding `.funcignore` and an explicit `--build local` (fold into BW-011 release script).

---

### BW-011 – Versions drift between backend, frontend and scaffold
**Status:** `DONE` (backend 1.24.1 + web part 1.25.1 live, 2026-10-12)  **Severity:** Medium  **Release type:** Tooling + web part

**Finding.** `version.ts` and backend `package.json` = 1.23.2; `spfx-client/package.json`, web part manifest and scaffold `package.json` = 1.23.1; `package-solution.json` solution = 1.23.1.0 but `features[0].version` = 1.22.1.0. Versions are typed by hand in up to 7 places.

**Fix (D-03 = separate versions, final).**
- [x] Repo-root `versions.json` = `{ "backend": "x.y.z", "web": "x.y.z" }` – the only place a version is typed. (Root `package.json` holds the scripts only.)
- [x] `scripts/release.mjs`: `npm run release -- backend|web|both patch|minor|major` bumps only the named half and writes its files:
  - Backend: `stateless-backend/shared/version.ts`, `stateless-backend/package.json`, `package-lock.json`.
  - Web part: `spfx-client/package.json`, `package-lock.json`, `BackupWatchWebPart.manifest.json`, `scaffold/config/package-solution.json` (`solution.version` **and** every `features[].version`, `x.y.z.0`). Scaffold copies are written by `scaffold:prepare`.
  - Appends a dated `CHANGELOG.md` stub labelled `Backend x.y.z`, `Web part x.y.z` or `Backend x.y.z / Web part x.y.z`.
- [x] `scripts/verify-versions.mjs` fails if any file disagrees with its half in `versions.json` (`--scaffold` also checks the scaffold copies). Wired as backend `prebuild` and inside `scaffold:prepare`.
- [x] `BackupWatchScaffold` config under source control in `scaffold/` (`config/*.json`, `gulpfile.js`, `tsconfig.json`, `.yo-rc.json`).
- [x] `npm run scaffold:prepare` replaces the manual clean (`release\`, `temp\`) + robocopy steps.
- [x] Versions shown in the footer only: `UI v<web part> · Engine v<backend>`, no mismatch warning (different numbers are normal). Header shows no version (owner choice, web part 1.25.1).
- [x] Update `CLAUDE.md` §2 and §4, `.agents/AGENTS.md` §3, `AGENT_PLAYBOOK.md` and `deployment_guide.md`: deploy only the half that changed.
- [x] `npm prune --omit=dev` + `npm install` in the backend deploy steps (`CLAUDE.md` §4); the scripts themselves never deploy.
- [x] Clean `dist/` before build (backend `prebuild` runs `npm run clean`).
- [x] Publish with explicit build mode – `func azure functionapp publish backupwatch-api --build local` (BW-019).
- [ ] Optional later: backend reports a minimum web part version and the footer warns if the deployed web part is older (only needed if a backend change ever requires a new UI).

**Acceptance criteria.** `npm run release -- backend|web|both …` changes only the named half's files, and every one of them; manually editing any version file makes the check (and the backend build) fail; the footer shows both versions and the header none.

**Progress log.**
- 2026-10-10 – Item created. Waiting on D-03.
- 2026-10-12 – **D-03 decided (Malith): shared version.** Fix rewritten for one version. Release rule in `CLAUDE.md` §2, `.agents/AGENTS.md` §3 and `AGENT_PLAYBOOK.md` changed now: every release bumps every version file to the same number and ships both the backend and the `.sppkg`. Script and checks still `TODO`.
- 2026-10-12 – Built on branch `bw-011-release-script` (not merged, not deployed). Repo-root `package.json` holds the one version and the scripts. `npm run release -- patch|minor|major` (`scripts/release.mjs`) writes `shared/version.ts`, both `package.json`/`package-lock.json` pairs, the web part manifest and `scaffold/config/package-solution.json` (solution + every feature version, `x.y.z.0`) and adds a CHANGELOG stub. `npm run verify-versions` fails on any mismatch; wired as backend `prebuild` together with `npm run clean` (stale `dist/`). `npm run scaffold:prepare` (`scripts/prepare-scaffold.mjs`) checks versions, deletes scaffold `release\`/`temp\`, copies `spfx-client/src`, `spfx-client/package.json` and the tracked `scaffold/` config (`config/*.json`, `gulpfile.js`, `tsconfig.json`, `.yo-rc.json`; `deploy-azure-storage.json` holds placeholders only), then checks the scaffold copies. Footer: `UI v<manifest> · Engine v<appVersion>`; on mismatch the dot turns amber and "Version mismatch – deploy pending" shows (text keeps the muted colour – amber text fails 4.5:1 on the light theme). `npm prune --omit=dev` + `npm install` added to the deploy steps in `CLAUDE.md` §4 (the script itself never deploys).
  - Tests: root `npm test` (node:test, temp copies only) – 7 passed: every file, both `package-solution.json` versions, lockfile dependencies untouched, CRLF CHANGELOG, and a hand edit to each of the 7 files failing the check. Backend: `npm run build` OK, `npm test` 9 suites / 140 passed; hand-editing `version.ts` makes `npm run build` exit 1.
  - Release cut with the script: **1.24.1** everywhere (was backend 1.24.0 / web part 1.23.4). `scaffold:prepare` + `gulp bundle --ship` + `package-solution --ship` OK; `.sppkg` (52,326 bytes, SHA-256 prefix `4a8c4ea23564a37a`) copied to repo root: one bundle (`backup-watch-web-part_7f3adfb7728d19e9ae26.js`), all versions 1.24.1(.0), no 1.23.4 left, permissions unchanged (`BackupWatch-Backend-API/user_impersonation`, Graph `User.Read`), no role/identity code.
  - To finish: merge, deploy backend 1.24.1 **and** upload the 1.24.1 `.sppkg`, check the footer shows `UI v1.24.1 · Engine v1.24.1` with a green dot, tag `v1.24.1`. Then `DONE`.
- 2026-10-12 – PR #6 merged (`cf94a75`). **Backend 1.24.1 deployed** to `backupwatch-api` (13:59 UTC) by Claude on Malith's instruction: `npm ci` → 140 tests passed → build → `npm prune --omit=dev` (jest/ts-jest/typescript no longer deployed) → `func azure functionapp publish backupwatch-api --build local`. Host Running, all 7 functions listed; `BW_DEV_ROLE` / `AZURE_FUNCTIONS_ENVIRONMENT` confirmed not set; anonymous GET returns 401. Header showed `V1.24.1`. Rollback: tag `backend-1.24.0`.
- 2026-10-12 – **D-03 changed to separate versions (Malith, final).** Seeing `UI v… · Engine v…` in the footer led to a review: one shared number hides which half changed and forces a SharePoint upload for every backend fix. Agreed: separate versions; header shows the web part version, footer both. Tooling reworked on branch `bw-011-separate-versions`: `versions.json` with `backend`/`web`; `npm run release -- backend|web|both patch|minor|major`; per-half verify; labelled CHANGELOG headings; footer mismatch warning removed. Root `npm test`: 10 passed (each half bumps only its own files, `both` bumps each from its own version, a hand edit to any of the 7 files fails the check, a web file carrying the backend number fails, scaffold copy drift caught).
  - Released with the script: **web part 1.25.0** (`release -- web minor`); backend unchanged at 1.24.1, so no Azure deploy. The 1.24.1 `.sppkg` is superseded and should not be uploaded.
  - To finish: merge; upload the 1.25.0 `.sppkg`; check header `V1.25.0` and footer `UI v1.25.0 · Engine v1.24.1`; tag `backend-1.24.1` (`cf94a75`) and `frontend-1.25.0`. Then `DONE`.
- 2026-10-12 – PR #7 merged (`57cbf93`). **Web part 1.25.0 uploaded** to the App Catalog (Malith); header showed `V1.25.0`. Tags `backend-1.24.1` (`cf94a75`) and `frontend-1.25.0` (`57cbf93`) pushed.
- 2026-10-12 – Owner chose to show **no version in the header** (option 3); both versions stay in the footer only. Released as **web part 1.25.1** (`release -- web patch`); backend unchanged at 1.24.1, no Azure deploy.
  - To finish: merge; upload the 1.25.1 `.sppkg`; check the header has no version and the footer shows `UI v1.25.1 · Engine v1.24.1`; tag `frontend-1.25.1`. Then `DONE`.
- 2026-10-12 – PR #8 merged (`8ce87c9`). **Web part 1.25.1 uploaded** to the App Catalog (Malith). Tag `frontend-1.25.1` pushed. Live: backend 1.24.1, web part 1.25.1. `DONE`.

- 2026-11-03 – **Web part build brought into the repo** (owner's request): `spfx-client/` is now the complete SPFx project; `scaffold/` and the external `C:\Projects\BackupWatchScaffold` retired as build locations; `npm run build:web` replaces `scaffold:prepare`. Found and fixed: Teams icons and the working tool list existed only outside git; `spfx-client/package.json` lacked the build tools; a hand-patched Microsoft file skipped SPFx's Node check (build now runs on Node 18 via npx instead). Parity proven: 1.28.1 rebuilt from the repo matches the uploaded package (identical bundle, manifest, icons; only per-build random package IDs differ). External folder kept as a fallback until the owner agrees to delete it.

---

### BW-012 – Is the v1.23.2 frontend refactor actually deployed?
**Status:** `DONE`  **Severity:** Medium  **Release type:** Verification only

**Finding.** CHANGELOG 1.23.2 is a frontend refactor (`BackupWatch.tsx` split into sub-components), but all frontend version files are 1.23.1. The UI header shows the backend version only, so a stale web part is invisible. (Also: CHANGELOG says `BackupWatch.tsx` is 2,772 lines; the audit measured 2,618.)

**Fix.**
- [x] In the SharePoint App Catalog, note the deployed BackupWatch package version and modified date.
- [x] Compare with the `.sppkg` in the repo root (modified date) and the current source.
- [x] If the refactor isn't live: rebuild via the BW-011 release script as frontend 1.23.2 (or next version) and deploy. *(Superseded: frontend 1.23.4, which contains the refactor, built by hand and deployed – see progress log.)*
- [x] Correct the CHANGELOG line count. *(No change needed: `BackupWatch.tsx` at `baseline-2026-10-10` is 2,771 lines, matching the CHANGELOG's 2,772; the audit's 2,618 was the outlier.)*

**Acceptance criteria.** Deployed package version is known and recorded here; it matches the source.

**Progress log.**
- 2026-10-10 – Item created.
- 2026-10-12 – Frontend **1.23.4** deployed to the App Catalog (Malith). Package = repo-root `backup-watch-scaffold.sppkg` built 2026-10-12 12:19 (52,119 bytes, SHA-256 prefix `12db8f1f9b13fd81`, single bundle `backup-watch-web-part_a96c098e47f7856f4de3.js`) from `main` at `0933d12`; scaffold `src` checked identical to `spfx-client/src` (line endings aside). Deployed version is known and matches source; it includes the 1.23.2 refactor. `DONE`. Remaining risk (a stale web part is invisible because the header shows only the engine version) is covered by BW-011's `UI v<x> · Engine v<y>` footer.

---

### BW-019 – Scratch scripts can write to live Table Storage
**Status:** `DONE`  **Severity:** Medium  **Release type:** Tooling

**Finding.** `stateless-backend/scratch/delete_ghost_entity.js` deletes a live Table Storage row and writes an audit entry using `local.settings.json`. `check_live_status.js` and `inspect_specific_entities.js` read live data. Easy to run by accident; breaks the production-safety rule.

**Fix.**
- [x] Move live-touching scripts to `tools/live/` with a header comment marking them as live.
- [x] Add a guard: script refuses to run unless `--confirm-live` is passed and prints the target storage account first.
- [x] Delete one-off scripts that have already done their job (e.g. the specific ghost-entity delete).
- [x] Confirm `local.settings.json` is excluded from source control.
- [x] Add `stateless-backend/.funcignore` so tests, scratch, tools, sources and secrets are not deployed.

**Acceptance criteria.** No script can write to live storage without an explicit flag; the remaining scratch scripts are mock-only.

**Progress log.**
- 2026-10-10 – Item created.
- 2026-10-12 – `check_live_status.js` and `inspect_specific_entities.js` moved (git mv) to `stateless-backend/tools/live/`; both load `liveGuard.js` first, which exits unless `--confirm-live` is passed and then prints only the storage AccountName (never key/connection string). Code review: both only call `getEntity`/`listEntities` – read-only. Guard tested with fake connection strings only; no live script was run. Added `tools/live/README.md`. Added `stateless-backend/.funcignore`; dry run (git ls-files with `.funcignore` as the only exclude file) shows only `host.json`, `package*.json`, the 7 `*/function.json`, `dist/**/*.js` and `node_modules/` remain, and every `function.json` `scriptFile` resolves to an included `dist/<name>/index.js`. `npm test`: 8 suites, 74 passed. `npm run build`: OK. No production code changed. With owner approval, deleted `scratch/delete_ghost_entity.js` (finished one-off live delete) and the 7 `scratch/test_*.js` superseded by Jest (still in git history); kept `scratch/test_exclusion_lifecycle_sync.js` until BW-008 adds Jest coverage for the expiry sweep.
  - Local build pinned: deploy docs now use `npm run build` + `func azure functionapp publish backupwatch-api --build local`; remote build is unsupported because `.funcignore` excludes TypeScript sources.
  - Build-mode finding (`func azure functionapp publish --help`, Core Tools 4.13.0): `--build remote|local` exists but the help does not state the default, and nothing in the repo or `local.settings.json` pins it, so the mode is chosen by Core Tools at publish time from the plan/runtime. Either way `node_modules/` is uploaded as it is locally (with `.funcignore` keeping it), so **devDependencies (jest, ts-jest, typescript, @types/jest) are currently deployed**. To be fixed in BW-011.

---

## Phase 1 – Security

### BW-003 – Confirm Easy Auth / Entra configuration
**Status:** `DONE`  **Severity:** High  **Release type:** Azure configuration (no code)

**Finding.** All functions are `authLevel: anonymous`; protection depends entirely on Easy Auth. This can't be confirmed from code.

**Fix.**
- [x] Function App → Authentication: confirm *Require authentication* and *HTTP 401* for unauthenticated requests.
- [x] Confirm issuer is the fifosys365 tenant and allowed audience is `api://04de3dc9-a4e8-4bba-9957-925668bbe027`.
- [x] Confirm CORS lists only the Fifosys SharePoint origin (no `*`).
- [ ] Optional hardening: Networking → Access restrictions to Fifosys ranges, or a private endpoint. *(Not done – public access accepted for remote engineers; see findings.)*
- [x] Record findings in the progress log. *(Findings table below.)*

**Acceptance criteria.** An anonymous request to `/api/backupWatchTrigger` returns 401 (test with a plain GET – read-only).

**Findings (2026-10-11).**

| Setting | Value | Verdict |
|---|---|---|
| App Service authentication | Enabled | OK |
| Restrict access | Require authentication | OK |
| Unauthenticated requests | HTTP 401 | OK |
| Excluded paths | None | OK |
| Allowed token audience | `api://04de3dc9-a4e8-4bba-9957-925668bbe027` | OK |
| Tenant requirement | Issuer tenant only (`a49c02e1-1813-4dd1-bd7f-636ec695f19e`) | OK |
| Client application requirement | Allow requests from **any** application | **Tighten** – see BW-002 |
| Identity requirement | Allow requests from any identity | Acceptable once BW-001 assignment is in place |
| CORS | `https://fifosys365.sharepoint.com` only, credentials on | OK |
| Public network access | Enabled, no restrictions | Acceptable (engineers work remotely); optional hardening later |
| Max instance count | 100 | **Lower** – see BW-004 / D-04 |
| Anonymous `curl` to `/api/auditlogs` and `/api/auditlogs?role=administrator` | 401 / 401 | OK – outsiders blocked |
| Entra app roles | None | Expected – created in BW-001 |
| Groups claim | None | Explains why the code trusts the browser's role |
| `accessTokenAcceptedVersion` | null (v1 tokens) | Leave as is |
| Enterprise app: Assignment required | **No**; no users/groups assigned | **Any user in the tenant, including guests, can get a token** – fixed in BW-001 |

**Conclusion.** The perimeter is correctly locked to the Fifosys tenant. Exposure from BW-001 is limited to signed-in tenant accounts (members and any B2B guests) – still critical, but not public.

**Progress log.**
- 2026-10-10 – Item created.
- 2026-10-11 – Portal and Entra review completed by Malith; anonymous access returns 401. `DONE`. Follow-ups moved to BW-001 (assignment required), BW-002 (client application restriction) and BW-004 (instance cap).

---

### BW-001 – Backend trusts client-supplied role (privilege escalation)
**Status:** `DONE` (backend 1.24.0 + frontend 1.23.4, both live 2026-10-12)  **Severity:** Critical  **Release type:** Backend + Entra configuration (+ small frontend change)

**Finding.** `shared/auth.ts:93-105` adds a role taken from the `x-user-role` header or `?role=` query parameter to the caller's groups; lines 176-186 then pick the highest role. The SPFx client works out the role in the browser (Graph `transitiveMemberOf`) and sends it. Any signed-in Fifosys user can change `role=viewer` to `role=administrator` and gain full admin rights (blackout, table purge, routing changes, permanent exclusions). `x-mock-role` (lines 157-169) has the same effect.

**Intended design (unchanged):** roles come from Entra security group membership. The fix makes the **backend** enforce that.

**Fix.**
- [x] **Entra:** on the `BackupWatch-Backend-API` app registration, create App Roles `BackupWatch.Administrator`, `BackupWatch.Specialist`, `BackupWatch.Contributor`, `BackupWatch.Viewer` (allowed member type: Users/Groups).
- [x] **Entra:** Enterprise Applications → BackupWatch-Backend-API → Users and groups: assign the four existing security groups to the matching roles (needs Entra ID P1).
- [x] **Entra:** set *Assignment required = Yes* so only members of the four groups can get a token. **Do this only after the four groups are assigned**, otherwise everyone is locked out. (Current state 2026-10-11: Assignment required = No, nobody assigned, no app roles, no groups claim.)
- [x] **Backend:** rewrite `getUserSecurityContext` to read roles **only** from the `roles` claim in `X-MS-CLIENT-PRINCIPAL` (set by Easy Auth after validating the token; Azure strips client-supplied copies). Highest role wins; no role = deny (or Viewer – decide during build). *Decided: authenticated with no BackupWatch role = Viewer + warning log; no principal = 401.*
- [x] **Backend:** delete support for `x-user-role`, `?role=`, `?user=`, `x-mock-role`, and the manual JWT decode. User email also comes from the principal only.
- [x] **Backend:** return the server-resolved `userRole` in the main payload (plus `userEmail`; additive).
- [x] **Frontend:** show the role badge and gate buttons from the server-resolved `userRole` (Graph lookup can be removed or kept as cosmetic only). Stop sending `role`/`user` parameters.
- [x] **Tests (backend):** a request with `?role=administrator` and a Viewer principal is treated as Viewer; each role reaches only its permitted endpoints (matrix from `security_group_rbac_proposal.md`).
- [x] **Release order:** Entra roles first → backend → frontend. The old frontend still works against the new backend (extra parameters are simply ignored).

**Acceptance criteria.** Role cannot be changed by anything the browser sends; each role's permissions match the RBAC matrix; audit log shows the server-resolved email and role.

**Progress log.**
- 2026-10-10 – Item created.
- 2026-10-11 – Config step done early: Enterprise app *Assignment required* set to **Yes** (Malith). Code fix still `TODO`.
- 2026-10-12 – Entra config done (Malith): App Roles `BackupWatch.Administrator`, `BackupWatch.Specialist`, `BackupWatch.Contributor`, `BackupWatch.Viewer` created on BackupWatch-Backend-API; the four security groups assigned to them; Assignment required = Yes.
- 2026-10-12 – Backend 1.24.0 on branch `bw-001-server-side-roles` (not merged, not deployed). `shared/auth.ts` rewritten: identity/role only from Easy Auth `X-MS-CLIENT-PRINCIPAL` (+ `X-MS-CLIENT-PRINCIPAL-NAME`); role claims via `role_typ`, `roles` and the v1 role URI; highest `BackupWatch.*` role wins; authenticated with none = Viewer + warning; no principal = 401 via new `requireAuthenticatedUser` on every HTTP function (backupWatchTrigger incl. all `?action=` handlers, exclusions GET/POST/DELETE – GET was previously unchecked, escalateTrigger, auditLogs, adminRouting, adminDiagnostics); existing role checks unchanged. Removed `x-user-role`, `x-user-email`, `x-mock-role`, `?role=`, `?user=`, JWT decode and `RBAC_*_GROUP_ID`. Dev-only `BW_DEV_ROLE` honoured only when `AZURE_FUNCTIONS_ENVIRONMENT=Development`. Audit entries record server-resolved `userEmail` + new `userRole`; main payload adds `userRole`/`userEmail`. Tests: 3 BW-001 `test.failing` cases now pass normally; new `endpointAuthorization.test.ts` drives the real handlers. **`npm test`: 9 suites, 140 passed, 0 failed (3 `test.failing` remain, all BW-009).** Mutation checks: re-trusting `?role=` fails 14 tests; removing the 401 fails 28. `npm run build` OK.
  - Before deploy: confirm `BW_DEV_ROLE` is not set and `AZURE_FUNCTIONS_ENVIRONMENT` is not `Development` in the Function App settings. `RBAC_*_GROUP_ID` app settings are now unused and can be removed after release.
- 2026-10-12 – **Backend 1.24.0 deployed** to `backupwatch-api` (merge `461f0d7`, tag `backend-1.24.0`; `npm ci` → 140 tests passed → build → `npm prune --omit=dev` → `func azure functionapp publish backupwatch-api --build local`). Deployment successful, host Running, all 7 functions listed. Rollback point: tag `backend-1.23.2-live` (`42ee4ed`). Smoke-tested OK by Malith, no errors seen. Status stays `TESTING` until the frontend release (web part uses server `userRole`, stops sending `role`/`user` params and `x-user-*` headers).
- 2026-10-12 – **Backend 1.24.0 LIVE** (deployed 12/10/2026 ~11:22 UK time). Verified by Malith: `appVersion` 1.24.0; payload returns server-resolved `userRole` = Administrator and `userEmail`; background scanner ran successfully at 11:30. Status stays `TESTING` until the frontend part is done.
- 2026-10-12 – Frontend 1.23.4 on branch `bw-001-frontend` (not uploaded): web part uses server `userRole`/`userEmail`, sends no role/identity, Graph role lookup removed. Owner decisions: (1) `BackupWatchScaffold\release\` deleted and rebuilt – `.sppkg` now contains only the current bundle (`backup-watch-web-part_d13ab7aa4a2a1f46d9b6.js`), none of the old role code; (2) Graph `GroupMember.Read.All` removed from `package-solution.json` (`.sppkg` now requests only `BackupWatch-Backend-API/user_impersonation` and Graph `User.Read`). Note: `package-solution.json` lives only in the scaffold, which is not under source control (BW-011).
  - [ ] **Check before revoking:** the tenant-wide `GroupMember.Read.All` approval (SharePoint admin centre → Advanced → API access) is shared by every SPFx solution. Do **not** revoke until it's confirmed no other web part uses it.
- 2026-10-12 – Branch `bw-001-frontend-2` (still 1.23.4, not released): header shows the **engine version only** (backend `appVersion`, `v…` until the first response) instead of falling back to the web part version and then switching; footer "BCDR Engine v…" fixed the same way. `release\` and `temp\` cleaned, rebuilt; `.sppkg` verified: one bundle (`backup-watch-web-part_a96c098e47f7856f4de3.js`, the one the web part loads), no role/identity params or headers, no Graph role lookup, permissions only `BackupWatch-Backend-API/user_impersonation` + Graph `User.Read`, feature version 1.23.4.0.
- 2026-10-12 – **Frontend 1.23.4 deployed** to the App Catalog (Malith), from `main` at `0933d12` (PRs #2 and #3); tag `frontend-1.23.4`. Release order Entra → backend → frontend complete. `DONE`.
  - Still open (tracked here, not blocking): revoke the tenant-wide `GroupMember.Read.All` approval only after the check above; remove the unused `RBAC_*_GROUP_ID` app settings.
- 2026-10-17 – Housekeeping check (read-only). `RBAC_*_GROUP_ID`: **already gone** – none of the 17 live app settings is `RBAC_*` and no backend code reads them. `GroupMember.Read.All`: still in the tenant-wide Microsoft Graph grant to *SharePoint Online Web Client Extensibility*, alongside about 35 other scopes that look like Microsoft's defaults; SharePoint's API access list could not be read from the Azure CLI, so which package requested it is unknown. **Not revoked.** Owner to check SharePoint admin centre → Advanced → API access → Approved requests: remove it only if the package is `backup-watch-scaffold` (or blank).

---

### BW-002 – JWT decoded but not verified
**Status:** `TODO`  **Severity:** High  **Release type:** Backend

**Finding.** `shared/auth.ts:114-155` base64-decodes the Bearer token without signature, issuer, audience or expiry checks. Safe only while Easy Auth sits in front of every function.

**Fix.**
- [x] Removed as part of BW-001 (identity comes from `X-MS-CLIENT-PRINCIPAL` only). *(Backend 1.24.0: manual JWT decode deleted.)*
- [x] Defence in depth: if `X-MS-CLIENT-PRINCIPAL` is absent, reject with 401 (never fall back to decoding the token). *(Backend 1.24.0: `requireAuthenticatedUser` on every HTTP function; covered by `endpointAuthorization.test.ts`.)*
- [ ] Optional: validate the Bearer token with `jose` against the tenant JWKS (issuer, audience, expiry) as a second check.
- [x] Easy Auth → Microsoft provider → *Client application requirement*: change from "any application" to **specific client applications**, allowing only the SharePoint/SPFx client that actually calls the API. Get its App ID from **Entra → Sign-in logs → Service principal / non-interactive sign-ins, filtered to resource `BackupWatch-Backend-API`** (do not guess it – Microsoft has changed the SPFx client app over time). Change during a quiet period; revert immediately if the dashboard shows 401/403.

**Acceptance criteria.** A request without an Easy Auth principal is rejected even if it carries a hand-crafted token.

**Progress log.**
- 2026-10-10 – Item created.
- 2026-10-11 – Config step done early: Easy Auth *Client application requirement* restricted to SharePoint Online Web Client Extensibility (`08e18876-6177-487e-b8b5-cf950c1e598c`) (Malith). Code items still `TODO`.
- 2026-10-12 – First two code steps delivered by BW-001 (backend 1.24.0, live): no JWT decode, 401 without an Easy Auth principal. Only the optional `jose` token validation remains – decide whether to do it or close as `DONE`.
---

## Phase 2 – Autotask gateway & suppression

### BW-004 – Autotask concurrency can exceed the 3-thread limit
**Status:** `TESTING` (backend 1.25.0 live since 2026-10-12; 30-day alert check pending)  **Severity:** High  **Release type:** Backend

**Finding.** Autotask is called from many places, each with its own pacing. `handleAutoHeal` (storage/offline notes) runs inside `Promise.all(devices.map(...))` (`backupWatchTrigger/index.ts:877-920`), so 4+ appliances recovering in one scan can fire 4+ concurrent requests. Flex Consumption can also run several instances, each with its own in-memory limits.

**Fix.**
- [x] **Layer 1 – Gateway:** create `shared/autotaskGateway.ts`. Every Autotask HTTP call goes through it. Max 2 concurrent requests per instance (`p-limit`), retry with exponential back-off on "thread threshold" / 429 / 5xx, structured logging of every call. *(Built with **1** per instance, agreed with the owner 2026-10-12: with 2 instances, 2 per instance could reach 4 > 3. No `p-limit` – a small built-in queue that also gives engineer actions priority. Writes are retried only on busy responses, never on 5xx, to avoid duplicate tickets. 60 s queue wait cap.)*
- [x] Refactor `shared/autotask.ts`, `escalateTrigger`, `exclusions` and `backupWatchTrigger` to use only the gateway. *(Also `adminDiagnostics`. New read helpers `getAutotaskCompanyName` and `pingAutotaskZone` replace the last direct calls; `getAutoTaskHeaders` removed – headers are built only in the gateway.)*
- [x] **Layer 2 – Guard rails:** ESLint `no-restricted-imports`/custom rule plus a unit test that fails if any file other than the gateway contains the Autotask base URL or calls axios for Autotask. *(Done as `tests/autotaskGuardRails.test.ts` only – the backend has no ESLint set-up. It fails if any file other than the gateway and the Datto pipeline imports axios, if an axios call outside the gateway isn't a Datto URL, if another HTTP client is used, or if Autotask credential headers are built anywhere else. Write functions also require a write context, so the compiler lists every write site.)*
- [x] **Layer 3 – Multiple instances (D-04):** lower Function App maximum instance count (currently **100**) to the smallest value the portal allows, ideally 1–2. Flex Consumption has historically enforced a minimum (e.g. 40); if it won't go low enough, use the Storage Queue option for Autotask writes instead. Document it in `CLAUDE.md`.
- [ ] **Later (optional):** Azure Storage Queue for all Autotask writes, consumed by one function with concurrency 1; poison queue alerting.
- [x] Tests: simulate 10 simultaneous auto-heals; assert peak concurrency ≤ 2. *(`tests/autotaskGateway.test.ts`: peak = 1 for 10 parallel auto-heals through the real gateway.)*

**Acceptance criteria.** No code path can issue more than 2 concurrent Autotask requests per instance; the guard-rail test catches direct calls; no "Thread Threshold Exceeded" alerts for 30 days after release.

**Progress log.**
- 2026-10-10 – Item created.
- 2026-10-11 – Function App maximum instance count lowered from 100 to **2** (Malith). Layers 1–2 (gateway + guard rails) still `TODO`.
- 2026-10-12 – D-04 (Malith): leave the instance cap at 2 and build the in-process gateway; Storage Queue not now. Review D-04 after this item is live.
- 2026-10-12 – Owner agreed: 1 request at a time per instance, engineer actions first, retries 1 s / 2 s / 4 s, ~60 s wait cap. Built with BW-006 and BW-007 on branch `bw-004-autotask-gateway` (backend 1.25.0 + web part 1.26.0, not deployed). `npm test`: **13 suites, 288 passed** (new: `autotaskGateway` 18, `autotaskPolicy` 99, `changeFreeze` 26, `autotaskGuardRails` 5; `autotaskConcurrency` failure test updated because reads are now retried). Mutation checks, each caught: concurrency 2 (5 tests fail), priority reversed (1), writes retried on 5xx (1), auto-heal ignoring silence (3), policy ignoring silence (16), Administrator needing no reason (1), escalation skipping the freeze check (4), Specialists allowed in a freeze (3), a direct Autotask call added to `exclusions` (2). Also fixed: cached dashboard responses lacked `appVersion`.
  - Acceptance "no Thread Threshold alerts for 30 days" can only be confirmed after release.
- 2026-10-12 – PR #11 merged (`2a14e26`). **Web part 1.26.0 uploaded** (Malith). **Backend 1.25.0 deployed** to `backupwatch-api` at 16:40 UTC by Claude on Malith's instruction (`npm ci` → 288 tests passed → build → `npm prune --omit=dev` → `func azure functionapp publish backupwatch-api --build local`); host Running, all 7 functions listed, no dev-role settings, anonymous GET 401. Tag `backend-1.25.0`; rollback `backend-1.24.1`. Stays `TESTING` until 30 days without "Thread Threshold Exceeded" alerts (review around 2026-11-11).
- 2026-10-18 – **Max instances lowered from 2 to 1** (Claude, on Malith's instruction; `az functionapp scale config set --maximum-instance-count 1`; app Running, anonymous GET 401). Application Insights, last 30 days: the timer scan and HTTP requests **never** shared an instance (0 of 1,594 instance IDs) – Flex scales them as separate groups and the cap applies per group – so up to 2 HTTP instances + 1 timer instance could send 3 Autotask requests at once. Now at most 2. Watch for HTTP 429s after the change. See D-04.
---

### BW-005 – Datto asset fetch is unbounded
**Status:** `TODO`  **Severity:** Medium  **Release type:** Backend

**Finding.** `backupWatchTrigger/index.ts:460` fetches `/device/{serial}/asset` for every appliance at once (120+ parallel requests).

**Fix.**
- [ ] Same pattern as BW-004: `shared/dattoGateway.ts` with concurrency 8, retry/back-off on 429/5xx, 15 s timeout kept.
- [ ] Tests: peak concurrency ≤ 8 with 150 mock appliances; one failing appliance doesn't fail the whole scan.

**Acceptance criteria.** Bounded concurrency; scan duration still acceptable (record before/after times here).

**Progress log.**
- 2026-10-10 – Item created.

---

### BW-006 – Appliance silence does not block all Autotask writes
**Status:** `TESTING` (backend 1.25.0 live since 2026-10-12)  **Severity:** Medium  **Release type:** Backend

**Finding.** Storage, offline and offsite-sync auto-heals (`backupWatchTrigger/index.ts:894, 916, 1114`) and the exclusion expiry sweep (`482-764`) don't check appliance silence. The spec promises "0 Autotask calls" for a silenced appliance.

**Fix (policy enforcement point in the gateway from BW-004).**
- [x] Create `shared/suppression.ts` with `evaluateSuppression(target)` → `{ suppressed: boolean, reason }`. Checks, in order: global blackout, appliance silence, agent silence, volume exclusion. *(Built as `shared/autotaskPolicy.ts` `evaluateAutotaskWrite`. Volume exclusions are deliberately **not** a gateway check: the volume-exclusion workflow itself writes to its own ticket (mute notes, expiry reminders, auto-heal); those rules stay in the sweep. Silence applies to **automatic** writes only – an engineer's own action (e.g. the note recording a mute) is not blocked by silence, only by the change freeze.)*
- [x] Every Autotask **write** through the gateway must include a target (`serial`, `deviceName`, `agentName?`, `volume?`, `alertType`). The gateway calls `evaluateSuppression` and refuses suppressed writes. *(Required `IAutotaskWriteContext` parameter on every write function – origin, action, device, agent, user, override reason; checked in the write functions just before the gateway.)*
- [x] Suppressed writes are recorded in `AuditLogs` (`action: "Suppressed"`, with reason). *(`Suppressed Autotask Write`, at most once per item per 6 hours so 30-minute scans don't flood the log.)*
- [ ] Remove the scattered per-feature silence checks once the gateway enforces them. *(Kept on purpose: they stop the scanner changing table state (auto-heal deletes, expiry sweep) and are harmless as a second check. Auto-heal and the sweep now use `getScannerSuppression()` so held-back items stay tracked and are retried after un-muting.)*
- [x] Tests: matrix of every alert type × every silence tier × blackout on/off. *(`tests/autotaskPolicy.test.ts`: 7 scanner write types × 6 silence tiers × blackout on/off, user roles, and the real write functions sending nothing when suppressed.)*

**Acceptance criteria.** With an appliance silenced, a full scan makes zero Autotask writes for it (verified by mock gateway in tests); suppressed actions visible in the audit trail.

**Progress log.**
- 2026-10-10 – Item created. Waiting on D-01.
- 2026-10-12 – D-01 decided (Malith): **No** Autotask writes of any kind while silenced. Unblocked; build with BW-004.
- 2026-10-12 – Built with BW-004 (see its log). Behaviour change: appliance-level auto-heal notes (storage, offline, offsite sync) now respect appliance silence; a held-back auto-heal keeps its ticket tracked so the note is posted on the first scan after un-muting (D-01).

---

### BW-007 – Global blackout (change freeze) not enforced on manual changes
**Status:** `TESTING` (backend 1.25.0 + web part 1.26.0 live since 2026-10-12)  **Severity:** Medium  **Release type:** Backend + frontend

**Finding.** Blackout is checked only in `createComplianceTicket` (`shared/autotask.ts:664-671`); `escalateTrigger` never checks it.

**Scope (widened by D-02, 2026-10-12).** Originally escalation only; the owner decided a blackout is a full change freeze, so this item covers every user-initiated write.

**Fix (D-02 = full change freeze; Administrator-only override).**
- [x] One server-side check (`requireNoBlackout(user, req)`) on **every mutating endpoint**: escalate, exclusions POST/DELETE (incl. permanent and appliance/agent mutes), unmute, bulk cleanup and any other write. Blocked during blackout unless the caller is Administrator **and** the request carries `overrideBlackout: true` plus a reason. *(`requireNoChangeFreeze` in `shared/changeFreeze.ts` on escalate and exclusions POST/DELETE. **Admin Console settings (routing, alert matrix, blackout on/off, orphan cleanup) are not guarded**: they are already Administrator-only and are how the freeze is managed – for owner review. If the override can't be audited, the change is refused.)*
- [x] Gateway/suppression (BW-006) also blocks automatic Autotask writes during blackout (scanner auto-tickets, auto-heal notes, expiry-sweep tickets).
- [x] Override accepted **only from Administrator** (server-resolved role, after BW-001); Specialist, Contributor and Viewer get 403 "Change freeze active until …".
- [x] Web part: a banner "Change freeze active until …"; every change button (escalate, mute, exclude, unmute) disabled for non-Administrators with that reason; Administrators get an override checkbox + mandatory reason. *(Administrators get a reason prompt when they make the change, instead of a checkbox – same rule, fewer screens touched. Not yet seen in a browser: needs the web part deployed.)*
- [x] Audit action `Change During Blackout` (with the action type and reason) for every Administrator override.
- [x] Tests: every mutating endpoint × every role × blackout on/off; Administrator without a reason is rejected. *(`tests/changeFreeze.test.ts`, 26 tests.)*

**Acceptance criteria.** During a blackout no role below Administrator can change anything (blocked server-side, not just hidden in the UI); Administrators can act only with a reason; every override is audited.

**Progress log.**
- 2026-10-10 – Item created. Waiting on D-02.
- 2026-10-12 – D-02 decided (Malith): only the **Administrator** role may act during a blackout; every role below is restricted. Clarified: "a change freeze or a blackout is a blackout" – applies to **all** changes, not just escalation. Scope widened accordingly. Unblocked; build with BW-004/BW-006.
- 2026-10-12 – Built with BW-004 (see its log). Release order: backend 1.25.0 first (server-side block works with the current web part – a blocked user just sees the error), then web part 1.26.0 (banner, disabled buttons, Administrator reason prompt).

---

## Phase 3 – Correctness

### BW-009 – Linux root volume `/` normalised to empty string
**Status:** `TODO`  **Severity:** High if any Linux agents are protected; otherwise none today  **Release type:** Backend

**Finding.** `shared/volumeUtils.ts:26-36` strips trailing slashes, so `"/"` becomes `""`; `backupWatchTrigger/index.ts:934-935` then filters it out. Linux root volumes vanish from the dashboard and an unprotected `/` never raises a compliance ticket.

**Fix.**
- [ ] Confirm from a real Datto asset payload (read-only GET) how Linux root volumes are named.
- [ ] `normalizeVolumeName`: if the trimmed input consists only of slashes, return `"/"`.
- [ ] Check `buildVolumeTargetKey`, row-key encoding and `isVolumeExcluded` handle `/` (target `dev:agent:/`).
- [ ] Tests: `"/"`, `"//"`, `"/data/"`, `"C:\\"`, `"d:"`, `""`.

**Acceptance criteria.** `/` appears on Linux agents; an unprotected `/` raises a compliance ticket in a mocked scan.

**Progress log.**
- 2026-10-10 – Item created.
- 2026-10-12 – Evidence from live dashboard data (Malith): Linux agents `LONITLCENTOS001`, `LONITLAPP008`, `LON-OC-P01` and `m002ukpxt` show `/BOOT` and `/HOME` volumes but **no `/` root volume** – consistent with `/` being normalised to `""` and filtered out. Linux agents are protected, so the High severity applies. Raw Datto payload naming for `/` still to be confirmed (first fix step).

---

### BW-008 – Expired exclusion deleted before follow-up ticket is confirmed (to verify)
**Status:** `TODO`  **Severity:** Medium (unconfirmed)  **Release type:** Backend

**Finding (inferred from report section 8).** For an expired temporary exclusion with a closed ticket, the sweep deletes the exclusion (`backupWatchTrigger/index.ts:598`) **before** calling `createComplianceTicket` (`601-608`). If that returns `null` (blackout active or VolumeExclusion auto-ticket disabled), the volume is left with no record and no ticket until a later scan.

**Fix.**
- [ ] Confirm the order and the `null` handling in code.
- [ ] If confirmed: create the follow-up ticket first; only delete/replace the old exclusion when the new ticket succeeds. If suppressed, keep the old record and log "Re-raise deferred (blackout/auto-ticket off)".
- [ ] Tests: closed ticket + blackout on → exclusion retained, no ticket; blackout off → new ticket + replaced record.
- [ ] Add Jest coverage for the exclusion expiry sweep, then delete `scratch/test_exclusion_lifecycle_sync.js`.

**Acceptance criteria.** No path leaves an unprotected volume without either a record or a ticket.

**Progress log.**
- 2026-10-10 – Item created.

---

### BW-013 – Only Autotask status 5 treated as closed
**Status:** `DECISION` (D-06)  **Severity:** Low/Medium  **Release type:** Backend (+ Admin Console)

**Finding.** Every closed check uses `status === 5`. Cancelled or merged tickets stay tracked forever and block new tickets for the same issue.

**Fix.**
- [ ] Read the live status picklist (read-only) and list candidate terminal statuses here.
- [ ] Add `terminalStatusIds` to `SystemConfig` (Admin Console editable), default per D-06.
- [ ] Replace all `=== 5` / `!== 5` with `isTerminalStatus(id)`.
- [ ] Tests for each terminal and non-terminal status.

**Progress log.**
- 2026-10-10 – Item created. Waiting on D-06.
- 2026-10-12 – D-06 deferred by Malith (review later). On hold.

---

### BW-015 – Raw volume names in `volumesList`
**Status:** `TODO`  **Severity:** Low  **Release type:** Backend

**Finding.** `backupWatchTrigger/index.ts:1103-1107` uses raw `volName` (can produce `D:\` alongside `D`). `volumeUtils.ts:118` uses an ad-hoc regex instead of `normalizeVolumeName`.

**Fix.**
- [ ] Normalise and de-duplicate in `volumesList`.
- [ ] Replace the ad-hoc regex fallback with `normalizeVolumeName`/`buildVolumeTargetKey`.
- [ ] Tests.

**Progress log.**
- 2026-10-10 – Item created.

---

### BW-010 – Settings handling: dead admin functions, `AT_USER` mismatch, no start-up validation
**Status:** `TODO`  **Severity:** Medium  **Release type:** Backend

**Finding.** The standalone `adminDiagnostics` and `adminRouting` functions are never called (the UI uses `backupWatchTrigger?action=…`). `adminDiagnostics` checks `AT_USER`/`AT_SECRET` instead of `AUTOTASK_*`. ~600 lines of admin handlers live inside `backupWatchTrigger/index.ts` (lines ~1175-1770). App settings are read ad hoc in 20+ places.
**Confirmed live (2026-10-10):** Application Insights "Host Startup Errors" shows `The 'adminRouting' function is in error: The specified route conflicts with one or more built in routes` (same for `adminDiagnostics`) on every host start (e.g. 16:58 and 17:28). Routes beginning with `admin` are reserved by the Azure Functions host (`/admin/...`), so these two functions never load. No user impact (the UI never calls them), but it is log noise on every cold start and hides real startup errors.

**Fix.**
- [ ] Delete the `adminDiagnostics` and `adminRouting` function folders (do **not** rename them to another `admin*` route). After the next backend publish, confirm "Host Startup Errors" in Application Insights is empty.
- [ ] Move admin handlers from `backupWatchTrigger/index.ts` into `shared/admin/*.ts` modules (same routes, same behaviour).
- [ ] Create `shared/config.ts`: reads and validates every app setting once (zod schema), exposes typed values; logs a clear error for missing required settings. All code uses it instead of `process.env`.
- [ ] Admin diagnostics reports settings status from `shared/config.ts`.
- [ ] Guard-rail test: no `process.env` outside `shared/config.ts`.

**Acceptance criteria.** Diagnostics status always matches what the code actually uses; `backupWatchTrigger/index.ts` contains only the data pipeline.

**Progress log.**
- 2026-10-10 – Item created.

---

### BW-023 – Dashboard request runs the full scan (slow loads; Autotask writes on page load)
**Status:** `DONE` (backend 1.26.0 + web part 1.28.1, confirmed live 2026-10-18)  **Severity:** Medium  **Release type:** Backend + small web part

**Finding (2026-10-12).** When the 5-minute cache has expired, `GET /api/backupWatchTrigger` (opening the dashboard) runs the whole pipeline before replying: Datto device and asset calls, the TrackedTickets sync, the volume-exclusion sweep and auto-heals. The person opening the page waits for background work, and simply opening the dashboard can trigger Autotask writes (sweep notes, auto-heal notes). With the BW-004 gateway sending Autotask calls one at a time, these loads can take longer. Web part 1.27.0 hides most of the wait (shows the browser's last copy), but doesn't fix it.

**Measured (2026-10-18, Application Insights, last 30 days, read-only).** 153 dashboard loads (about 5 a day); 85 (56%) took over 5 s – median 5.7 s, slowest 16.6 s. 1,439 timer scans – median 6.6 s, 95% under 16 s. About 55 different instances a day: Flex shuts idle instances down, and the timer scan always runs on a different instance from the dashboard, so the 5-minute in-memory cache almost never helps a visitor.

**Further findings.**
- The web part's "Force Refresh" button (`BackupWatch.tsx:1658`) never sends `refresh=true`; it just reloads like a normal visit.
- Only new native-exclusion tickets are already limited to the background scan (`isBackground`, `backupWatchTrigger/index.ts:795`). The exclusion sweep, compliance tickets and auto-heal notes still run on a dashboard load.

**Fix (D-08 – reduced scope).**
- [x] Dashboard GET runs the pipeline **read-only**: Datto and Autotask reads as now, every piece of information still shown (D-07), but no Autotask writes and no TrackedTickets changes – sweep, compliance tickets and auto-heal notes only on a scan.
- [x] **Force Scan:** `refresh=true` from Specialist/Administrator runs a full scan (same rules as the timer: silence, change freeze, audit) and waits for the result; audited with who requested it. Other roles: ignored as now.
- [x] **Scan lock** in shared storage so a forced scan and the timer scan never overlap (they run on different instances); a request arriving during a scan waits for that scan instead of starting another.
- [x] Web part (small): the button sends `refresh=true`, is labelled "Force Scan", shows the existing Refreshing strip.
- [x] Tests (mocks only): dashboard GET makes zero Autotask writes and changes no tracking rows; dashboard shows the same information as before; Force Scan performs sweep/auto-heal; Viewer/Contributor cannot force; lock blocks overlap; timer unaffected. Guard-rail test so a future change can't reintroduce writes on page load.
- [ ] Not now (revisit if usage grows): shared snapshot for 1–2 s loads.

**Acceptance criteria.** Opening the dashboard never sends anything to Autotask and shows the same information as before; Force Scan updates tickets and the dashboard in one go; no overlapping scans.

**Progress log.**
- 2026-10-12 – Item created (owner agreed to do it after the web part 1.27.0 loading experience).
- 2026-10-18 – Measured (above). Full plan (snapshot, queue, instant loads) discussed; owner reduced the scope (D-08) because the dashboard is used occasionally (D-07). Max instances set to 1 (D-04, BW-004).
- 2026-10-18 – Built on branch `bw-023-readonly-loads` as **backend 1.26.0 + web part 1.28.0** (not deployed). `runPipeline(context, forceRefresh, isScan)`: on a dashboard load (`isScan` false) the sweep, native-exclusion tickets, auto-heal notes, picklist proof row and completed-ticket pruning are skipped; reads unchanged. Force Scan runs `runPipeline(context, true, true)` inside `withScanLock` (`shared/scanLock.ts`: Table Storage row ScanStatus/Lock/BCDRScanner, create-or-replace-expired by ETag, 15-min expiry, fail open if the store is down), audits "Force Scan", records the last scan (keeps the timer's next scan); if a scan is running it waits and returns fresh read-only data (`X-Scan: joined`). Timer takes the same lock and skips its run if a Force Scan holds it. Web part: button "Force Scan" sends `refresh=true`, shows "Scanning…" and is disabled meanwhile. `npm test`: **16 suites, 336 passed** (new: `dashboardReadOnly` 13, `scanLock` 10, timer +2; table mock now has real ETags); root tests 10 passed. Mutation checks, each caught: sweep on page load (7 fail), auto-heal on page load (7), picklist proof on page load (5), completed-ticket pruning on page load (6), native-exclusion tickets on page load (6), Force Scan without the lock (2), anyone can force (1), timer without the lock (1), expired lock never taken over (2), lock ignoring a running scan (5), lock not released (8). `.sppkg` checked: one bundle, version 1.28.0.0, contains `refresh=true`/"Force Scan", no "Force Refresh".
  - Release order: backend first (web part 1.27.0 keeps working – its button just reloads), then web part 1.28.0. Rollback: `backend-1.25.1` / `frontend-1.27.0`.
- 2026-10-18 – Owner reviewed the diff and a local preview of web part 1.28.0 (real component, fake local backend, made-up data; preview removed afterwards). PR #17 merged (`91a57e9`, includes #16). **Backend 1.26.0 deployed** at 14:05 UTC by Claude on Malith's approval (`npm ci` → tests → build → `npm prune --omit=dev` → `func azure functionapp publish backupwatch-api --build local`); all 7 functions listed, no dev-role settings, anonymous GET (incl. `?refresh=true`) and exclusions 401. Tag `backend-1.26.0`; rollback `backend-1.25.1`.
  - The first `npm test` before the deploy had 2 failures; reruns passed 336/336 ten times. Cause: under heavy CPU load (straight after `npm ci`) older BW-004 gateway/concurrency tests overran Jest's 5 s limit, and a timed-out test upset the next one; `scanLock`'s "scan finishes" test had the same weakness. Test-only fix on branch `bw-023-deployed`: `testTimeout` 30 s, module compile moved into a `beforeAll`, wider wait cap in that `scanLock` test. Four full runs in parallel: 336/336 each. Not part of the deployed code.
  - Application Insights after deploy (read-only): 14:30 timer scan ran on 1.26.0 – "successfully executed and cached 117 appliances" (15.1 s); one dashboard load (4.0 s) with **no** write log lines; no exceptions; no failed requests.
  - Owner couldn't find the button: the whole status bar was missing on the live site, and always had been. The web part read the cache status only from the `X-Cache-Status` header, which the browser hides cross-origin (the backend's CORS doesn't expose it), so the bar never rendered in SharePoint (the local preview's fake backend exposed it, which hid the bug). Fixed in 1.28.0 before upload (PR #19): read `cacheStatus` from the response body. `.sppkg` rebuilt and checked (one bundle, 1.28.0.0, fix present).
- 2026-10-18 – Owner found "In-Memory Cache Status: HIT/MISS" misleading ("MISS" looked like a failure). **Web part 1.28.1** (PR #20, built on #19): plain-English status bar – "Live data, fetched just now · Last full scan 16:03 · Next scan 16:30", "Data from the last few minutes · …", "Full scan completed just now · …" after a Force Scan, "(failed)" when the last scan failed. A first build hit a type error and still produced a package; it was deleted and rebuilt after the fix (checked: one bundle, 1.28.1.0, new text present, old text gone).
- 2026-10-18 – **Web part 1.28.1 uploaded** (Malith) and **confirmed live**: status bar visible with the new wording. Owner pressed Force Scan (15:55 and 16:03 UK); audit trail shows both "Force Scan" entries by m.wijesinghe@fifosys.com. Application Insights for 16:00–16:04 UK: 16:00 timer scan OK (117 appliances, 13 s); 16:03:00 page load logged "dashboard loads are read-only" and wrote nothing; 16:03:15 Force Scan ran the full scan in 10 s (scan-only steps logged, silenced appliance ICE-DATTO2 correctly skipped); no exceptions, no failed requests, no scan overlap. Note: App Insights request URLs omit the query string, so Force Scans are identified by their scan-only log lines, not `refresh=true`. **`DONE`.** Tag `frontend-1.28.1` once PRs #18–#20 are merged.

---

### BW-024 – Appliance storage shown in the wrong unit (TB labelled as GB)
**Status:** `DONE` (backend 1.25.1; figures confirmed by Malith 2026-10-16)  **Severity:** Medium  **Release type:** Backend

**Finding (2026-10-16, reported by Malith).** The dashboard showed ACU-DAT-01 (S5-3, about 3 TB) as "2.80 GB / 2.93 GB (95.7%)". `backupWatchTrigger/index.ts` read `localStorageUsed.size` / `localStorageAvailable.size`, ignored `units` and divided by 1,073,741,824 as if the size were bytes. A read-only GET of the live Datto device list (owner approved; storage fields only printed) showed units "KB" on all 117 appliances (`offsiteStorageUsed` is "B"). ACU-DAT-01: used 3,009,445,320 KB, available 136,282,624 KB = 2.80 TB of 2.93 TB. So every figure was terabytes shown as gigabytes. The percentage, "Storage Critical" card, badges and 85% auto-heal threshold were correct (a ratio). Storage escalation tickets and storage auto-heal notes carried the wrong figures.

**Fix.**
- [x] `shared/storageUnits.ts`: `dattoSizeToGB` converts by unit (B, KB/KiB, MB/MiB, GB/GiB, TB/TiB; binary); a missing or unknown unit is assumed KB and logged once. `formatStorageGB` gives GB, or TB from 1024 GB.
- [x] Scanner uses it for used/total GB and the percentage.
- [x] Storage escalation ticket text and the storage auto-heal note use `formatStorageGB`.
- [x] Tests (`tests/storageUnits.test.ts`, 23): the real ACU-DAT-01 values give 2.80 TB / 2.93 TB / 95.7%; every unit; invalid sizes; unknown/missing unit warning; percentage unchanged by unit; ticket text "2.80 TB of 2.93 TB". Mutation (KB treated as bytes) fails 5 tests.

**Acceptance criteria.** ACU-DAT-01 shows about 2.80 TB / 2.93 TB (95.7%) on the dashboard; new storage tickets show TB; percentages unchanged.

**Progress log.**
- 2026-10-16 – Reported by Malith from the dashboard; units confirmed by a read-only Datto check; fixed as backend 1.25.1. `npm test`: 14 suites, 311 passed. Already-created Autotask tickets keep their old wording.
- 2026-10-16 – PR #14 merged (`ca746af`). **Backend 1.25.1 deployed** at 17:23 UTC by Claude on Malith's instruction (`npm ci` → 311 tests passed → build → `npm prune --omit=dev` → `func azure functionapp publish backupwatch-api --build local`); host Running, all 7 functions listed, no dev-role settings, anonymous GET 401. Tag `backend-1.25.1`; rollback `backend-1.25.0`.
- 2026-10-16 – Malith confirmed the dashboard figures are correct (ACU-DAT-01 about 2.80 TB / 2.93 TB). Item `DONE`.

---

### BW-025 – Exclusions on archived agents never cleaned up; duplicate agent names
**Status:** `DONE` (backend 1.26.1, confirmed by the 2026-10-19 10:00 scan)  **Severity:** Medium  **Release type:** Backend

**Finding (2026-10-19, reported by Malith).** KUI-DATTO-05:KSLCARPEDIEM01:G showed "TEMP (0D LEFT)" with ticket T20260827.0293, which is closed in Autotask. Read-only checks: the exclusion expired 2026-09-10 (F, T20260827.0292: 2026-09-08) and the scan had not touched either since – no expiry notes, no re-raise. Datto lists KSLCARPEDIEM01 twice on KUI-DATTO-05, **both archived**. The sweep did `if (!matchedDevice || !matchedAsset || matchedAsset.isArchived) continue;` – a silent skip before the ticket was ever checked. Also: Datto lists archived and live copies under the same name (KSLSQL01, KSLDC01/02/03, KSLFS01, KSLHRNET, KSLPRINT01, KSLPARTNER on KUI-DATTO-05) and `.find()` took the first, so an exclusion on a live server whose archived twin came first would be skipped the same way. Admin Console Cleanup missed both: it counted archived agents as existing and found nothing with an empty cache. A read-only audit of all 16 exclusions against Datto: only these 2 affected today; none hidden by a duplicate yet.

**Fix (D-09 = Option A).**
- [x] Prefer the live (non-archived) agent when names repeat; "archived" only when every copy is archived.
- [x] Archived agent: open ticket – one note, then remove; closed or no ticket – remove; audited "Removed Exclusion (Agent Archived)"; note not posted – nothing removed, retried next scan; ticket not fetched – retried next scan. Silence and change freeze still win (the sweep's suppression check runs first).
- [x] Never treat missing data as archived: agent list fetch failed, or agent not found at all – left alone, reason logged.
- [x] Every sweep skip logs its reason.
- [x] Cleanup: archived agents count as gone; loads data itself after a restart.
- [x] Tests (`archivedAgentExclusions`, 12). Mutation checks, each caught: first-match bug back (2 fail), archived skipped (3), fetch failure as archived (1), removed though note failed (1), note on closed ticket (1), cleanup counts archived (1), cleanup without load (1), missing agent as archived (1). `npm test`: 17 suites, 348 passed.

**Acceptance criteria.** After deploy, the next scan removes the two KUI-DATTO-05:KSLCARPEDIEM01 exclusions (F: note on T20260827.0292 if still open; G: closed, removed) and the audit trail shows both.

**Progress log.**
- 2026-10-19 – Reported by Malith; cause found read-only (App Insights, Exclusions table, Datto assets); Option A chosen; built as backend 1.26.1 on branch `bw-025-archived-agents`. Not deployed.
- 2026-10-19 – PR #21 merged (`47d757d`). **Backend 1.26.1 deployed** 08:59 UTC by Claude on Malith's approval (348 tests passed; no dev-role settings; anonymous GET 401). Tag `backend-1.26.1`; rollback `backend-1.26.0`. 09:00 UTC scan: **removed** KUI-DATTO-05:KSLCARPEDIEM01 G and F (both tickets closed, so no note), scan OK (117 appliances), no exceptions. `DONE`.
  - The new skip logging surfaced two more: (1) MP-DATTO-01:MP-HV-01:D (T20260909.0057, expired 2026-09-24) – MP-HV-01 no longer exists on MP-DATTO-01 at all (only MP-DC-01), so it is left for the owner to remove by hand (listed in Admin Console › Cleanup); (2) ARK-WAT-DATTO-01:JTS2-SVR:F – permanent, deliberate (Veeam), no ticket: nothing to do (quieten that log line for permanent exclusions later).
  - **Decision (Malith): no automatic handling of agents that disappear entirely** (e.g. "missing for 7 days, treat as archived") for now; clear them by hand via Cleanup.
  - Data note: four ARK-WAT-DATTO-01 exclusions (JTS2-SVR F; LOGIKAL2-SVR H, J, K) were saved in August with drive letters as `F:\` etc. rather than normalised `F`; the scan copes (it normalises when comparing). Optional one-off tidy-up later.

---

## Phase 4 – Hygiene

### BW-014 – Silent `catch {}` blocks hide failures
**Status:** `TODO`  **Severity:** Low  **Release type:** Backend

**Finding.** Empty catches at `backupWatchTrigger/index.ts:300, 1178, 1668, 1678, 1693, 1772`, `exclusions/index.ts:38, 180, 227`, `shared/auth.ts:41, 152`, `shared/configService.ts:131, 300`.

**Fix.**
- [ ] Each catch either logs a warning with context or is justified with a comment (e.g. expected 404).
- [ ] Bulk-cleanup deletes report per-row failures back to the Admin Console.

**Progress log.**
- 2026-10-10 – Item created.

---

### BW-018 – Auto-ticket toggles for 6 alert types do nothing
**Status:** `DECISION` (D-05)  **Severity:** Medium  **Release type:** Backend + frontend

**Finding.** The routing matrix exposes `autoTicketEnabled` for StorageAlert, LocalBackupFailure, OverdueBackup, OffsiteSyncIssue, ScreenshotFailure and OfflineAppliance, but the scanner only auto-tickets volume exclusions. An admin turning these on gets no tickets and no warning.

**Fix (assuming D-05).**
- [ ] Short term: disable the 6 toggles in the Admin Console with "Not yet available".
- [ ] Long term: one new item per alert type to implement auto-ticketing through the gateway (dedup via `TrackedTickets`, suppression via BW-006).

**Progress log.**
- 2026-10-10 – Item created. Waiting on D-05.
- 2026-10-12 – Owner asked what the six toggles are; explained (Storage Alerts, Local Backup Failures, Overdue Backups, Offsite Sync Issues, Screenshot Failures, Offline Appliances – none create tickets even when switched on). Options given: grey out (recommended), build some, or remove. Decision pending.
- 2026-10-18 – **Priority raised by D-07:** the team relies on alerts and may retire Datto's own alerts, so these six types raising tickets from the background scan becomes the main value. Suggested first: Offline Appliance, Local Backup Failure, Storage Alert. Next after BW-023; D-05 still to be decided.

---

### BW-016 – Documentation out of date / contradictory
**Status:** `TODO`  **Severity:** Low  **Release type:** Docs

**Finding.** See `CODE_VERIFICATION_REPORT.md` section 18 and the summary table. Highlights: `/api/escalateTrigger` (real: `/api/escalate`); 4 tables listed (real: 5, incl. `SystemConfig`); `DATTO_CREDS` (real: `DATTO_KEY`); `.antigravity/rules.md` (stateless, Tailwind, Key Vault, v1.9.2) and `memory.md` (`C:\AG\…` paths) obsolete; `ROADMAP.md` lists shipped features as future; silence "0 Autotask calls" claim untrue until BW-006.

**Fix.**
- [ ] Update `CLAUDE.md` and `BACKUPWATCH_OPERATIONAL_SPECIFICATION.md` to match code (re-check after Phases 1–3).
- [ ] Mark `.antigravity/rules.md`, `.antigravity/agents.md`, `.antigravity/agent_build_instructions.md` as **archived** (header note) or move to `docs/archive/`.
- [ ] Fix `azure_setup_guide.md` (`DATTO_KEY`), `deployment_guide.md` paths.
- [ ] Update `ROADMAP.md` to remove shipped items.
- [ ] Add a "Remediation" link to this file from `CLAUDE.md`.

**Progress log.**
- 2026-10-10 – Item created.

---

## Backlog – planned, not scheduled

### BW-026 – Automatic handling of backup and screenshot failures (smart ticketing)
**Status:** `BACKLOG` (discussed 2026-10-27; owner asked to keep it for later)  **Severity:** Medium  **Release type:** Backend + web part  **Closes:** D-05 / BW-018 when built

**Idea.** Today BackupWatch raises Autotask tickets only for volume exclusions; backup and screenshot failures come from Datto's own email alerts. The scanner already tracks and auto-heals backup/screenshot tickets (`agent:<name>:backup|screenshot` in TrackedTickets) – only the automatic raising is missing.

**What the data supports (read-only sample of 121 agents, 2026-10-27).** Each agent's last 10 backup attempts with status and Datto's error text; the latest screenshot attempt (pass/fail, time, image link) but no failure reason. Common messages: "A backup hasn't been taken in over 24 hours" (49), "Cannot connect to the host" (44), volumes unavailable (9), SNAPSHOT_INSUFFICIENT_FREE_SPACE (7), VSS export error (4), job stalled >900 s (4), agent failed to report / rebooted (1).

**Levels.**
1. Detect and ticket – yes (persisting failures only; update, don't duplicate; auto-heal note when cleared).
2. Diagnose and guide – yes for backups (cause and next steps from Datto's message, priority by severity and age); partly for screenshots (no reason given).
3. Fix – **not from BackupWatch**: the BCDR API is, as far as known, read-only for us (to confirm against Datto's docs), and BackupWatch must not touch client servers. Possible later via Datto RMM approved scripts – a separate project.

**Proposed rules (thresholds to agree).**
| Problem | Raise when | Priority | Ticket content |
|---|---|---|---|
| Backup failing | 3 failed attempts in a row, or failing ≥ 12 h | Medium → High at 48 h | Agent, last good backup, Datto error, likely cause, next steps |
| No backup in 24 h | Datto says so, or last success > 24 h | High | Plus "check agent service / schedule" |
| Host unreachable | 3 in a row | Medium | "Check server on, network, Datto agent service" |
| Insufficient snapshot space | First occurrence | Medium | "Free space on drive X or move snapshot location" |
| VSS error | 2 in a row | Medium | "Check VSS writers" |
| Volume unavailable | First occurrence | Medium | Which drive is missing |
| Screenshot failing | 2 in a row while backups succeed | Low | Screenshot link; "check boot / verification settings" |

**Safety.** One ticket per agent per problem; reopen-protection (a recurrence within 24 h of healing adds a note to the same ticket); silence and change freeze win; Autotask gateway limits; flood guard (more than ~10 new tickets in one scan → one alert to Fifosys, hold the rest); **dry run first** (1–2 weeks: dashboard and audit show "would have raised", nothing sent); every rule switchable in the Admin Console; dashboard shows "ticket in ~30 min if still failing".

**Decisions needed when picked up.** Scope (backup + screenshot first?); thresholds; one ticket per agent or per appliance; dry run (recommended); Level 3 via Datto RMM parked.

**Progress log.**
- 2026-10-27 – Discussed with Malith; parked in the backlog at his request.

---

## Release history for this plan

| Date | Version | Component | Items | Notes |
|---|---|---|---|---|
| 2026-10-10 | baseline-2026-10-10 | Repo | BW-020 | Source control baseline (backend 1.23.2 / frontend 1.23.1) |
| 2026-10-11 | 1.23.3 | Frontend | BW-022 | Audit Trail hotfix |
| 2026-10-12 | 1.24.0 | Backend | BW-001 | Live (roles server-side from Entra App Roles). Rollback tag `backend-1.23.2-live` |
| 2026-10-12 | 1.23.4 | Web part | BW-001, BW-012 | Server-resolved role; no role/identity sent; Graph `GroupMember.Read.All` dropped. Tag `frontend-1.23.4` |
| 2026-10-12 | 1.24.1 | Backend | BW-011 | Release tooling; first use of the script (shared version, later changed). Dev dependencies no longer deployed. Tag `backend-1.24.1` |
| 2026-10-12 | 1.24.1 | Web part | BW-011 | Built, **never uploaded** (superseded by 1.25.0) |
| 2026-10-12 | 1.25.0 | Web part | BW-011 | Separate versions (D-03 final); header showed web part version. Tag `frontend-1.25.0` |
| 2026-10-12 | 1.25.1 | Web part | BW-011 | No version in header; footer `UI v… · Engine v…`. Tag `frontend-1.25.1` |
| 2026-10-12 | 1.26.0 | Web part | BW-007 | Change-freeze banner, locked change buttons, Administrator reason prompt |
| 2026-10-12 | 1.25.0 | Backend | BW-004, BW-006, BW-007 | Autotask gateway, silence enforcement, change freeze. Tag `backend-1.25.0` |
| 2026-10-12 | 1.27.0 | Web part | – | Loading experience (skeleton, last dashboard shown instantly, Retry). Uploaded and confirmed by Malith. Tag `frontend-1.27.0` |
| 2026-10-16 | 1.25.1 | Backend | BW-024 | Storage shown in the correct unit (TB, not GB). Deployed 17:23 UTC; figures confirmed by Malith. Tag `backend-1.25.1` |
| 2026-10-18 | 1.26.0 | Backend | BW-023 | Read-only dashboard loads, Force Scan endpoint, scan lock. Deployed 14:05 UTC. Tag `backend-1.26.0` |
| 2026-10-18 | 1.28.0 | Web part | BW-023 | "Force Scan" button; status bar now shows on the live site. Superseded by 1.28.1 before use |
| 2026-10-18 | 1.28.1 | Web part | BW-023 | Plain-English status bar. Uploaded and confirmed by Malith |
| 2026-10-19 | 1.26.1 | Backend | BW-025 | Archived-agent exclusions retired; live agent preferred over archived twin. Deployed 08:59 UTC. Tag `backend-1.26.1` |
