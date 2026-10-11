# BackupWatch Remediation Plan & Progress Tracker

> **Owner:** Malith Wijesinghe
> **Created:** 2026-10-10
> **Last updated:** 2026-10-11
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
| BW-001 | Backend trusts client-supplied role (privilege escalation) | Critical | 1 | Backend + Entra config (+ small frontend) | `TODO` | |
| BW-002 | JWT decoded but not verified; all functions `anonymous` | High | 1 | Backend | `TODO` | |
| BW-003 | Confirm Easy Auth / Entra configuration | High | 1 | Azure config (no code) | `DONE` | n/a (config check) |
| BW-004 | Autotask concurrency can exceed 3-thread limit | High | 2 | Backend | `TODO` | |
| BW-005 | Datto asset fetch is unbounded `Promise.all` | Medium | 2 | Backend | `TODO` | |
| BW-006 | Appliance silence does not block all Autotask writes | Medium | 2 | Backend | `DECISION` | |
| BW-007 | Global blackout not enforced on manual escalation | Medium | 2 | Backend + frontend | `DECISION` | |
| BW-008 | Expired exclusion deleted before follow-up ticket is confirmed | Medium (to verify) | 3 | Backend | `TODO` | |
| BW-009 | Linux root volume `/` normalised to empty string | High (if Linux agents exist) | 3 | Backend | `TODO` | |
| BW-010 | Settings handling: dead admin functions, `AT_USER` mismatch, no start-up validation | Medium | 3 | Backend | `TODO` | |
| BW-011 | Versions drift between backend, frontend and scaffold | Medium | 0 | Tooling | `DECISION` | |
| BW-012 | Is the v1.23.2 frontend refactor actually deployed? | Medium | 0 | Verification only | `TODO` | |
| BW-013 | Only Autotask status 5 treated as closed | Low/Medium | 3 | Backend | `DECISION` | |
| BW-014 | Silent `catch {}` blocks hide failures | Low | 4 | Backend | `TODO` | |
| BW-015 | Raw volume names in `volumesList` | Low | 3 | Backend | `TODO` | |
| BW-016 | Documentation out of date / contradictory | Low | 4 | Docs | `TODO` | |
| BW-017 | No automated test runner | Medium | 0 | Tooling | `TODO` | |
| BW-018 | Auto-ticket toggles for 6 alert types do nothing | Medium | 4 | Backend + frontend | `DECISION` | |
| BW-019 | Scratch scripts can write to live Table Storage | Medium | 0 | Tooling | `TODO` | |

### Phases

| Phase | Goal | Items |
|---|---|---|
| **0 – Foundations** | Make every later fix testable, safely releasable and correctly versioned | BW-020, BW-022, BW-017, BW-011, BW-012, BW-019 |
| **1 – Security** | Roles enforced server-side from Entra; no client trust | BW-003, BW-001, BW-002 |
| **2 – Autotask gateway & suppression** | One choke point for all Autotask traffic that enforces rate limits, silence and blackout | BW-004, BW-006, BW-007, BW-005 |
| **3 – Correctness** | Fix data-handling bugs | BW-009, BW-008, BW-013, BW-015, BW-010 |
| **4 – Hygiene** | Clean-up, docs, misleading UI | BW-014, BW-016, BW-018 |

> BW-001 is the only item with live exposure today. If time is short, do BW-003 → BW-001 first and pick up Phase 0 straight after.

---

## Decisions log

| ID | Question | Proposed answer | Decision | Date |
|---|---|---|---|---|
| D-01 (BW-006) | When an appliance/agent is silenced and a tracked issue clears, should the auto-heal note still be posted to Autotask? | **No.** No Autotask writes of any kind while silenced. The first scan after un-muting posts the auto-heal note. Suppressed actions are written to the audit log. | | |
| D-02 (BW-007) | During a global blackout, can engineers still escalate manually? | **Soft block.** Warning shown; Specialist/Administrator may override with a mandatory reason (audited); Contributor blocked. | | |
| D-03 (BW-011) | Lockstep versioning, or separate backend/frontend versions? | **Separate versions** (matches the existing release rule that backend-only changes don't rebuild the `.sppkg`), managed by one script and shown side by side in the UI. | | |
| D-04 (BW-004) | Multi-instance protection: cap Function App instances, or queue all Autotask writes? | **Now:** cap max instances (1–2) + in-process gateway. **Later, if volume grows:** Azure Storage Queue with a single consumer for all Autotask writes. | | |
| D-05 (BW-018) | The 6 non-volume auto-ticket toggles do nothing. Hide them, or implement auto-ticketing? | **Short term:** disable them in the UI with "Not yet available". **Long term:** implement per alert type, one at a time, behind the existing toggle. | | |
| D-06 (BW-013) | Which Autotask statuses count as "closed"? | Make it configurable in Admin Console (default: Completed + any status whose label contains "Cancel" or "Closed"). Needs the live status picklist to confirm. | | |

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
- [ ] `C:\Projects\BackupWatchScaffold` is not under source control – handled in BW-011.

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
**Status:** `TODO`  **Severity:** Medium  **Release type:** Tooling (no deployment)

**Finding.** `stateless-backend/package.json` has `"test": "echo \"No tests specified\" && exit 0"`. The eight `scratch/test_*.js` files are ad-hoc and never run automatically. Every fix in this plan needs tests to prove it.

**Fix.**
- [ ] Add Jest (or Vitest) with `ts-jest` to `stateless-backend`.
- [ ] Move the mock-only tests from `scratch/test_*.js` into `stateless-backend/tests/` and convert them to the runner.
- [ ] Add shared mocks for Autotask, Datto and Table Storage (no network calls possible in tests; fail the test if axios is called un-mocked).
- [ ] `npm test` runs all tests; `npm run build` runs `npm test` first (`prebuild`).

**Acceptance criteria.** `npm test` passes locally with the converted tests; a deliberately broken `normalizeVolumeName` makes the build fail.

**Progress log.**
- 2026-10-10 – Item created.

---

### BW-011 – Versions drift between backend, frontend and scaffold
**Status:** `DECISION` (D-03)  **Severity:** Medium  **Release type:** Tooling

**Finding.** `version.ts` and backend `package.json` = 1.23.2; `spfx-client/package.json`, web part manifest and scaffold `package.json` = 1.23.1; `package-solution.json` solution = 1.23.1.0 but `features[0].version` = 1.22.1.0. Versions are typed by hand in up to 7 places.

**Fix (assuming D-03 = separate versions).**
- [ ] Create `versions.json` at the repo root: `{ "backend": "1.23.2", "frontend": "1.23.1" }`. The only place a version is ever typed.
- [ ] Create `scripts/release.mjs`: `npm run release -- backend|frontend patch|minor|major`. It bumps `versions.json` and writes:
  - Backend: `stateless-backend/shared/version.ts`, `stateless-backend/package.json`.
  - Frontend: `spfx-client/package.json`, `BackupWatchWebPart.manifest.json` (both copies), `BackupWatchScaffold/package.json`, `package-solution.json` (`solution.version` **and** every `features[].version`, in `x.y.z.0` form).
  - Appends a dated stub to `CHANGELOG.md` for you to fill in.
- [ ] Create `scripts/verify-versions.mjs` that fails if any file disagrees with `versions.json`. Wire it as `prebuild` for the backend and as the first step of the SPFx build commands in `CLAUDE.md`.
- [ ] Backend returns `appVersion` **and** `expectedFrontendVersion` in the main payload.
- [ ] Footer shows `UI v<x> · Engine v<y>`; show a small warning if the deployed web part version is older than `expectedFrontendVersion`.
- [ ] Update `CLAUDE.md` section 4 and `.agents/AGENTS.md` section 3 to use the release script.

**Acceptance criteria.** Running the release script for each component produces consistent versions everywhere; manually editing one file makes the build fail; the footer shows both versions.

**Progress log.**
- 2026-10-10 – Item created. Waiting on D-03.

---

### BW-012 – Is the v1.23.2 frontend refactor actually deployed?
**Status:** `TODO`  **Severity:** Medium  **Release type:** Verification only

**Finding.** CHANGELOG 1.23.2 is a frontend refactor (`BackupWatch.tsx` split into sub-components), but all frontend version files are 1.23.1. The UI header shows the backend version only, so a stale web part is invisible. (Also: CHANGELOG says `BackupWatch.tsx` is 2,772 lines; the audit measured 2,618.)

**Fix.**
- [ ] In the SharePoint App Catalog, note the deployed BackupWatch package version and modified date.
- [ ] Compare with the `.sppkg` in the repo root (modified date) and the current source.
- [ ] If the refactor isn't live: rebuild via the BW-011 release script as frontend 1.23.2 (or next version) and deploy.
- [ ] Correct the CHANGELOG line count.

**Acceptance criteria.** Deployed package version is known and recorded here; it matches the source.

**Progress log.**
- 2026-10-10 – Item created.

---

### BW-019 – Scratch scripts can write to live Table Storage
**Status:** `TODO`  **Severity:** Medium  **Release type:** Tooling

**Finding.** `stateless-backend/scratch/delete_ghost_entity.js` deletes a live Table Storage row and writes an audit entry using `local.settings.json`. `check_live_status.js` and `inspect_specific_entities.js` read live data. Easy to run by accident; breaks the production-safety rule.

**Fix.**
- [ ] Move live-touching scripts to `tools/live/` with a header comment marking them as live.
- [ ] Add a guard: script refuses to run unless `--confirm-live` is passed and prints the target storage account first.
- [ ] Delete one-off scripts that have already done their job (e.g. the specific ghost-entity delete).
- [ ] Confirm `local.settings.json` is excluded from source control.

**Acceptance criteria.** No script can write to live storage without an explicit flag; the remaining scratch scripts are mock-only.

**Progress log.**
- 2026-10-10 – Item created.

---

## Phase 1 – Security

### BW-003 – Confirm Easy Auth / Entra configuration
**Status:** `TODO`  **Severity:** High  **Release type:** Azure configuration (no code)

**Finding.** All functions are `authLevel: anonymous`; protection depends entirely on Easy Auth. This can't be confirmed from code.

**Fix.**
- [ ] Function App → Authentication: confirm *Require authentication* and *HTTP 401* for unauthenticated requests.
- [ ] Confirm issuer is the fifosys365 tenant and allowed audience is `api://04de3dc9-a4e8-4bba-9957-925668bbe027`.
- [ ] Confirm CORS lists only the Fifosys SharePoint origin (no `*`).
- [ ] Optional hardening: Networking → Access restrictions to Fifosys ranges, or a private endpoint.
- [ ] Record findings in the progress log.

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
**Status:** `TODO`  **Severity:** Critical  **Release type:** Backend + Entra configuration (+ small frontend change)

**Finding.** `shared/auth.ts:93-105` adds a role taken from the `x-user-role` header or `?role=` query parameter to the caller's groups; lines 176-186 then pick the highest role. The SPFx client works out the role in the browser (Graph `transitiveMemberOf`) and sends it. Any signed-in Fifosys user can change `role=viewer` to `role=administrator` and gain full admin rights (blackout, table purge, routing changes, permanent exclusions). `x-mock-role` (lines 157-169) has the same effect.

**Intended design (unchanged):** roles come from Entra security group membership. The fix makes the **backend** enforce that.

**Fix.**
- [ ] **Entra:** on the `BackupWatch-Backend-API` app registration, create App Roles `BackupWatch.Administrator`, `BackupWatch.Specialist`, `BackupWatch.Contributor`, `BackupWatch.Viewer` (allowed member type: Users/Groups).
- [ ] **Entra:** Enterprise Applications → BackupWatch-Backend-API → Users and groups: assign the four existing security groups to the matching roles (needs Entra ID P1).
- [ ] **Entra:** set *Assignment required = Yes* so only members of the four groups can get a token. **Do this only after the four groups are assigned**, otherwise everyone is locked out. (Current state 2026-10-11: Assignment required = No, nobody assigned, no app roles, no groups claim.)
- [ ] **Backend:** rewrite `getUserSecurityContext` to read roles **only** from the `roles` claim in `X-MS-CLIENT-PRINCIPAL` (set by Easy Auth after validating the token; Azure strips client-supplied copies). Highest role wins; no role = deny (or Viewer – decide during build).
- [ ] **Backend:** delete support for `x-user-role`, `?role=`, `?user=`, `x-mock-role`, and the manual JWT decode. User email also comes from the principal only.
- [ ] **Backend:** return the server-resolved `userRole` in the main payload.
- [ ] **Frontend:** show the role badge and gate buttons from the server-resolved `userRole` (Graph lookup can be removed or kept as cosmetic only). Stop sending `role`/`user` parameters.
- [ ] **Tests:** a request with `?role=administrator` and a Viewer principal is treated as Viewer; each role reaches only its permitted endpoints (matrix from `security_group_rbac_proposal.md`).
- [ ] **Release order:** Entra roles first → backend → frontend. The old frontend still works against the new backend (extra parameters are simply ignored).

**Acceptance criteria.** Role cannot be changed by anything the browser sends; each role's permissions match the RBAC matrix; audit log shows the server-resolved email and role.

**Progress log.**
- 2026-10-10 – Item created.
- 2026-10-11 – Config step done early: Enterprise app *Assignment required* set to **Yes** (Malith). Code fix still `TODO`.

---

### BW-002 – JWT decoded but not verified
**Status:** `TODO`  **Severity:** High  **Release type:** Backend

**Finding.** `shared/auth.ts:114-155` base64-decodes the Bearer token without signature, issuer, audience or expiry checks. Safe only while Easy Auth sits in front of every function.

**Fix.**
- [ ] Removed as part of BW-001 (identity comes from `X-MS-CLIENT-PRINCIPAL` only).
- [ ] Defence in depth: if `X-MS-CLIENT-PRINCIPAL` is absent, reject with 401 (never fall back to decoding the token).
- [ ] Optional: validate the Bearer token with `jose` against the tenant JWKS (issuer, audience, expiry) as a second check.
- [ ] Easy Auth → Microsoft provider → *Client application requirement*: change from "any application" to **specific client applications**, allowing only the SharePoint/SPFx client that actually calls the API. Get its App ID from **Entra → Sign-in logs → Service principal / non-interactive sign-ins, filtered to resource `BackupWatch-Backend-API`** (do not guess it – Microsoft has changed the SPFx client app over time). Change during a quiet period; revert immediately if the dashboard shows 401/403.

**Acceptance criteria.** A request without an Easy Auth principal is rejected even if it carries a hand-crafted token.

**Progress log.**
- 2026-10-10 – Item created.

---

## Phase 2 – Autotask gateway & suppression

### BW-004 – Autotask concurrency can exceed the 3-thread limit
**Status:** `TODO`  **Severity:** High  **Release type:** Backend

**Finding.** Autotask is called from many places, each with its own pacing. `handleAutoHeal` (storage/offline notes) runs inside `Promise.all(devices.map(...))` (`backupWatchTrigger/index.ts:877-920`), so 4+ appliances recovering in one scan can fire 4+ concurrent requests. Flex Consumption can also run several instances, each with its own in-memory limits.

**Fix.**
- [ ] **Layer 1 – Gateway:** create `shared/autotaskGateway.ts`. Every Autotask HTTP call goes through it. Max 2 concurrent requests per instance (`p-limit`), retry with exponential back-off on "thread threshold" / 429 / 5xx, structured logging of every call.
- [ ] Refactor `shared/autotask.ts`, `escalateTrigger`, `exclusions` and `backupWatchTrigger` to use only the gateway.
- [ ] **Layer 2 – Guard rails:** ESLint `no-restricted-imports`/custom rule plus a unit test that fails if any file other than the gateway contains the Autotask base URL or calls axios for Autotask.
- [ ] **Layer 3 – Multiple instances (D-04):** lower Function App maximum instance count (currently **100**) to the smallest value the portal allows, ideally 1–2. Flex Consumption has historically enforced a minimum (e.g. 40); if it won't go low enough, use the Storage Queue option for Autotask writes instead. Document it in `CLAUDE.md`.
- [ ] **Later (optional):** Azure Storage Queue for all Autotask writes, consumed by one function with concurrency 1; poison queue alerting.
- [ ] Tests: simulate 10 simultaneous auto-heals; assert peak concurrency ≤ 2.

**Acceptance criteria.** No code path can issue more than 2 concurrent Autotask requests per instance; the guard-rail test catches direct calls; no "Thread Threshold Exceeded" alerts for 30 days after release.

**Progress log.**
- 2026-10-10 – Item created.

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
**Status:** `DECISION` (D-01)  **Severity:** Medium  **Release type:** Backend

**Finding.** Storage, offline and offsite-sync auto-heals (`backupWatchTrigger/index.ts:894, 916, 1114`) and the exclusion expiry sweep (`482-764`) don't check appliance silence. The spec promises "0 Autotask calls" for a silenced appliance.

**Fix (policy enforcement point in the gateway from BW-004).**
- [ ] Create `shared/suppression.ts` with `evaluateSuppression(target)` → `{ suppressed: boolean, reason }`. Checks, in order: global blackout, appliance silence, agent silence, volume exclusion.
- [ ] Every Autotask **write** through the gateway must include a target (`serial`, `deviceName`, `agentName?`, `volume?`, `alertType`). The gateway calls `evaluateSuppression` and refuses suppressed writes.
- [ ] Suppressed writes are recorded in `AuditLogs` (`action: "Suppressed"`, with reason).
- [ ] Remove the scattered per-feature silence checks once the gateway enforces them.
- [ ] Tests: matrix of every alert type × every silence tier × blackout on/off.

**Acceptance criteria.** With an appliance silenced, a full scan makes zero Autotask writes for it (verified by mock gateway in tests); suppressed actions visible in the audit trail.

**Progress log.**
- 2026-10-10 – Item created. Waiting on D-01.

---

### BW-007 – Global blackout not enforced on manual escalation
**Status:** `DECISION` (D-02)  **Severity:** Medium  **Release type:** Backend + frontend

**Finding.** Blackout is checked only in `createComplianceTicket` (`shared/autotask.ts:664-671`); `escalateTrigger` never checks it.

**Fix (assuming D-02 = soft block).**
- [ ] Gateway/suppression (BW-006) blocks escalation writes during blackout unless the request carries `overrideBlackout: true` and a reason.
- [ ] Backend accepts the override only from Specialist/Administrator (server-resolved role, after BW-001).
- [ ] Escalation modal shows "Global blackout active until …"; override checkbox + mandatory reason for permitted roles.
- [ ] Audit action `Escalation During Blackout` with reason.
- [ ] Tests for each role with blackout on/off.

**Acceptance criteria.** Contributors can't escalate during blackout; overrides are always audited.

**Progress log.**
- 2026-10-10 – Item created. Waiting on D-02.

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

---

### BW-008 – Expired exclusion deleted before follow-up ticket is confirmed (to verify)
**Status:** `TODO`  **Severity:** Medium (unconfirmed)  **Release type:** Backend

**Finding (inferred from report section 8).** For an expired temporary exclusion with a closed ticket, the sweep deletes the exclusion (`backupWatchTrigger/index.ts:598`) **before** calling `createComplianceTicket` (`601-608`). If that returns `null` (blackout active or VolumeExclusion auto-ticket disabled), the volume is left with no record and no ticket until a later scan.

**Fix.**
- [ ] Confirm the order and the `null` handling in code.
- [ ] If confirmed: create the follow-up ticket first; only delete/replace the old exclusion when the new ticket succeeds. If suppressed, keep the old record and log "Re-raise deferred (blackout/auto-ticket off)".
- [ ] Tests: closed ticket + blackout on → exclusion retained, no ticket; blackout off → new ticket + replaced record.

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

## Release history for this plan

| Date | Version | Component | Items | Notes |
|---|---|---|---|---|
| 2026-10-10 | baseline-2026-10-10 | Repo | BW-020 | Source control baseline (backend 1.23.2 / frontend 1.23.1) |
| 2026-10-11 | 1.23.3 | Frontend | BW-022 | Audit Trail hotfix |
