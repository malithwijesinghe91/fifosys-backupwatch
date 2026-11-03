# Workspace Rules: Prevention of Live Modifying Operations

To protect live production environments and prevent disruptions to business operations (such as panic in the service desk), the following rules are strictly enforced for all development, troubleshooting, and testing tasks:

## 1. Safety & Production Isolation

*   **No Live Modifying Tests**: Under no circumstances should any code execution, test script, or command perform write operations (create, update, delete, or trigger emails/tickets) on a live production environment during analysis or troubleshooting.
*   **Use Mock Clients or Sandboxes**: All tests must use mocked responses, local stub services, or an isolated sandbox/staging environment.
*   **Explicit User Approval for Live Writes**: If testing in production is absolutely unavoidable:
    1.  Explicitly ask the user for permission first.
    2.  Align on the exact safe test parameters (e.g., specific test queues, test company IDs).
    3.  Prepend all test subjects/titles clearly with `[TEST - DO NOT RESPOND]` or `[SYSTEM TEST]`.

## 2. API Interaction Safety

*   **Read-Only Defaults**: During troubleshooting or inspection, only use read-only API calls (e.g., `GET` or `query` without side-effects).
*   **Verify Parameter Mapping**: Before deploying any code that interacts with ticketing systems, verify that all routing fields (such as `queueID`, `ticketCategory`, etc.) are correctly mapped and resolve to the correct target queues.

## 3. Versioning, Release Protocol & SPFx Decoupling

*   **Version Display**: Footer only – `UI v… · Engine v…` (UI = web part manifest version, Engine = backend `appVersion` from `stateless-backend/shared/version.ts`). The header shows no version.
*   **Separate Versions (decision D-03, final 2026-10-12)**: The backend and the web part each have their own version, held in the repo-root `versions.json`. **Never edit version numbers by hand** – run `npm run release -- backend|web|both patch|minor|major` from the repo root; it writes every file of the half that changed and adds a labelled `CHANGELOG.md` stub. `npm run verify-versions` (also run before every backend build) fails on any mismatch. Versions are shown in the footer only (`UI v… · Engine v…`).
*   **Deploy Only What Changed**: backend change → `npm run build` followed by `func azure functionapp publish backupwatch-api --build local` (from `stateless-backend/`; `--build local` is required because `.funcignore` excludes the TypeScript sources and `tsconfig.json`, so remote build is not supported). Web part change → `npm run build:web` from the repo root (builds `spfx-client/` on Node 18 and copies `backup-watch-scaffold.sppkg` to the root), then provide it for SharePoint App Catalog deployment. `spfx-client/` is the complete SPFx project – edit its `config/` there. **Do NOT require a `.sppkg` upload for a backend-only release.**
*   **Exclusion Drive Letter Normalization**: Drive letters must ALWAYS be strictly normalized (uppercase drive letter with colon/backslash stripped, e.g. `D`) before storing in Azure Table Storage row keys or comparing with Datto payloads to prevent ghost twin duplicate entries.

## 4. Architectural Navigation & Repo-Map Protocol

*   **Token-Efficient Discovery**: Before executing deep, token-expensive full-text greps or reading large files, check if `REPO_MAP.md` exists in the workspace root. Read `REPO_MAP.md` to identify symbol hubs, exported signatures, and module boundaries.
*   **Automatic Refresh Protocol**: Whenever substantial code changes, new files, or renamed modules are introduced, refresh `REPO_MAP.md` by invoking the global `repo-map` generator:
    `uv run --python 3.12 --with "tree-sitter,tree-sitter-language-pack,networkx" python "C:\Users\m.wijesinghe\.gemini\config\skills\repo-map\generate_repo_map.py" . "REPO_MAP.md"`
