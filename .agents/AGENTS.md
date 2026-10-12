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

*   **Dynamic Engine Versioning**: The frontend SPFx client dynamically binds to the backend `appVersion` payload sent from `stateless-backend/shared/version.ts`.
*   **Shared Version (decision D-03, 2026-10-12)**: Backend and web part always carry the same version. The version lives in the repo-root `package.json`; **never edit version numbers by hand** – run `npm run release -- patch|minor|major` from the repo root, which writes every version file (backend, web part, `scaffold/config/package-solution.json` solution + feature versions) and adds a `CHANGELOG.md` stub. `npm run verify-versions` (also run before every backend build) fails on any mismatch.
*   **Every Release Ships Both Halves**, even if only one side changed: deploy the backend via `npm run build` followed by `func azure functionapp publish backupwatch-api --build local` (from `stateless-backend/`; `--build local` is required because `.funcignore` excludes the TypeScript sources and `tsconfig.json`, so remote build is not supported), **and** rebuild the web part (`npm run scaffold:prepare` from the repo root, then `gulp bundle --ship && gulp package-solution --ship` in `BackupWatchScaffold`), copy `backup-watch-scaffold.sppkg` to root, and provide it for SharePoint App Catalog deployment. Scaffold config is tracked in `scaffold/` – edit it there.
*   **Exclusion Drive Letter Normalization**: Drive letters must ALWAYS be strictly normalized (uppercase drive letter with colon/backslash stripped, e.g. `D`) before storing in Azure Table Storage row keys or comparing with Datto payloads to prevent ghost twin duplicate entries.

## 4. Architectural Navigation & Repo-Map Protocol

*   **Token-Efficient Discovery**: Before executing deep, token-expensive full-text greps or reading large files, check if `REPO_MAP.md` exists in the workspace root. Read `REPO_MAP.md` to identify symbol hubs, exported signatures, and module boundaries.
*   **Automatic Refresh Protocol**: Whenever substantial code changes, new files, or renamed modules are introduced, refresh `REPO_MAP.md` by invoking the global `repo-map` generator:
    `uv run --python 3.12 --with "tree-sitter,tree-sitter-language-pack,networkx" python "C:\Users\m.wijesinghe\.gemini\config\skills\repo-map\generate_repo_map.py" . "REPO_MAP.md"`
