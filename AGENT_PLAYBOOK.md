# BackupWatch Agent Playbook (consolidated roles & working rules)

> Created 2026-10-10. Consolidates every agent role, rule and skill found in the Antigravity files, with obsolete parts removed. Used by Claude (planning/review) and Antigravity (implementation) when working on `REMEDIATION_PLAN.md`.

## Sources reviewed

| Source | Content | Verdict |
|---|---|---|
| `.antigravity/agents.md` | 4 agent roles | Absorbed (updated) |
| `.antigravity/rules.md` | Tech stack, auth, cache, versioning rules | Partly absorbed; stateless / Tailwind / Key Vault / "always Promise.all" / v1.9.2 are obsolete |
| `.antigravity/agent_build_instructions.md` | Original 3-task build plan | Historical only |
| `.antigravity/memory.md` | Team responsibilities, versioning policy, release log | Versioning policy + Version Comments absorbed |
| `.agents/AGENTS.md` | Production isolation, release protocol, drive-letter rule, repo-map protocol | Absorbed in full |
| `.agents/skills/cc-skill-security-review` | Security checklist | Absorbed |
| Global `accidental-data-loss-prevention` | Stop and get consent before irreversible deletes | Absorbed |
| Global `security-and-hardening` | STRIDE threat model, always/ask/never tiers | Absorbed |
| Global `repo-map` | Read/refresh `REPO_MAP.md` | Absorbed (Antigravity runs the generator) |
| Global `ui-ux-pro-max` | UX priorities, accessibility, no emoji icons | Absorbed |
| Global `fixing-accessibility` | WCAG 2.1 AA rules for controls, dialogs, forms | Absorbed |
| Global `anti-ui-slop` | Reuse the design system, cover all states, inspect render | Core absorbed (UIZZE part not used) |
| Global `card-based-design` | ClassTrack (Laravel/Blade) card patterns | Not applicable – different product; only the 3-zone card principle kept |
| Other global skills (GCP, BigQuery, Laravel, data pipelines, etc.) | Unrelated stacks | Not applicable |

## Roles

### 1. Orchestrator & Release Manager
*(was: Project Orchestrator Agent)*
- Owns `REMEDIATION_PLAN.md`: statuses, progress logs, decisions log, release history.
- Sequences work by phase; one item (or tight group) per release.
- Release protocol (separate versions, D-03 final 2026-10-12): backend and web part each have their own version in `versions.json`; run `npm run release -- backend|web|both patch|minor|major` (never hand-edit versions) and deploy **only the half that changed** – backend `npm run build` then `func azure functionapp publish backupwatch-api --build local` (remote build not supported: `.funcignore` excludes TypeScript sources); web part via `npm run scaffold:prepare` then gulp in `C:\Projects\BackupWatchScaffold`, `.sppkg` copied to repo root and uploaded to App Catalog. Steps in `CLAUDE.md` §4.
- MAJOR / MINOR / PATCH rules: new thing = MINOR; fix/polish = PATCH; changes how it all works or needs web part re-adding = MAJOR.
- Every `.sppkg` build ends with a **Version Comments** section listing what changed.
- `CHANGELOG.md` in Keep a Changelog format, entries reference item IDs (`Fixed (BW-009): …`).
- Refreshes `REPO_MAP.md` after substantial structural changes.

### 2. Backend Serverless Engineer
*(was: Backend Serverless Agent)*
- Azure Functions (Node.js/TypeScript, Flex Consumption, UK South), Table Storage, Datto and Autotask integrations.
- 5-minute in-memory cache; live exclusions merged on every request.
- **All Autotask calls through one gateway** (BW-004); never parallel Autotask calls outside it; respect the 3-thread limit.
- Bounded concurrency for Datto (BW-005).
- Drive letters always normalised (`D`, not `D:\`) before compare/store; `/` preserved (BW-009).
- ASCII-only text in Autotask tickets and notes; UK date/time (`Europe/London`).
- App settings read only through `shared/config.ts` (BW-010).

### 3. Frontend (SPFx) Engineer
*(was: Frontend Integration Agent)*
- SPFx 1.19, React 17, TypeScript; styles in `BackupWatchStyles.tsx` (Cyber Navy dark / Enterprise Clean light tokens). **Not Tailwind.**
- Calls backend via `AadHttpClient`; never sends role or identity claims – uses the server-resolved role (BW-001).
- UI standards (from ui-ux-pro-max, fixing-accessibility, anti-ui-slop):
  - WCAG 2.1 AA: 4.5:1 text contrast, 3:1 UI/borders, visible focus rings, `aria-label` on icon buttons, labelled inputs.
  - Modals trap focus, close on Esc, return focus to trigger.
  - SVG icons, not emoji, in UI chrome.
  - Every async button shows loading/disabled state; destructive actions need confirmation.
  - Cover loading, empty, error, success, disabled and permission states.
  - Reuse existing components and tokens before inventing new ones; no fake data.
  - Hover effects in CSS classes, not inline `onMouseEnter` style mutation.
  - Monospace / tabular figures for ticket numbers, serials, dates.

### 4. Cloud Security & Identity Engineer
*(was: Cloud Security & Identity Agent)*
- Entra ID App Roles mapped to the four BackupWatch security groups; backend reads roles only from Easy Auth `X-MS-CLIENT-PRINCIPAL` (BW-001/002).
- Easy Auth: Require authentication, 401, single tenant, CORS limited to the Fifosys SharePoint origin (BW-003).
- Secrets only in App Settings / Key Vault; never in code or logs; `local.settings.json` never committed.
- Threat-model each change with STRIDE; write the abuse case as the first test.
- Never trust client-side checks; authorise every mutating endpoint server-side; audit-log every privileged action.
- Ask first before loosening any security control (CORS, auth, roles).

### 5. QA & Test Engineer *(new – no equivalent existed)*
- Owns the test runner and mocks (BW-017).
- Every remediation item ships with tests that fail before the fix and pass after.
- Tests never touch live Datto, Autotask or Table Storage; un-mocked network calls fail the test.
- Verifies acceptance criteria in `REMEDIATION_PLAN.md` before an item moves to `DONE`.

### 6. Independent Reviewer *(new – Claude's role)*
- Reviews plans and diffs against the plan, the safety rules and the security checklist before release.
- Keeps `REMEDIATION_PLAN.md` and the Claude Project copy in sync.

## Non-negotiable safety rules (all roles)

1. No live writes (tickets, notes, status changes, exclusions, deletes) during analysis, development or testing. Mocks or sandbox only.
2. If a live write is truly unavoidable: ask the owner first, agree exact parameters (test queue / test company), and prefix titles with `[TEST - DO NOT RESPOND]`.
3. Read-only API calls (`GET`/query) by default when investigating.
4. **Stop and get explicit consent before anything irreversible** – Table Storage deletes/purges, `func publish`, App Catalog uploads, Entra changes, deleting files or functions. State the impact and why.
5. Verify Autotask routing fields (queue, category, issue/sub-issue, priority) resolve correctly before deploying ticketing changes.
6. Read `REPO_MAP.md` before deep searches.

## Who does what (proposed)

| Activity | Claude (this Project) | Antigravity (on the PC) | Malith |
|---|---|---|---|
| Plan, prompts, decisions log, reviews | ✔ | | Approves |
| Code changes, builds, tests, repo-map refresh | | ✔ | Approves |
| Deployments (`func publish`, App Catalog) | | Prepares | Executes / approves |
| Entra / Azure portal configuration | Instructions | | Executes |
| Decisions D-01 … D-06 | Proposes | | Decides |
