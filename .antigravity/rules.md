# BackupWatch System Rules & Coding Standards

This ruleset governs development for the stateless BackupWatch project.

## Tech Stack Constraints
- **Frontend** (Implemented by the *Frontend Integration Agent*): SharePoint Framework (SPFx) running React + TypeScript, integrated within MS Teams/SharePoint Online.
- **Styling** (Implemented by the *Frontend Integration Agent*): Tailwind CSS (used inside SPFx layout framework).
- **Backend** (Implemented by the *Backend Serverless Agent*): Node.js Azure Functions with TypeScript.
- **State Management** (Enforced by the *Project Orchestrator Agent*): **STRICTLY STATELESS**. Absolutely no databases, tables, or file system storage. All session processing and API coordination must happen entirely in-memory.

## Authentication & Security
- Frontend requests to Backend (Shared responsibility between *Frontend Integration Agent* and *Backend Serverless Agent*): Authenticate using `AadHttpClient`.
- API Security (Implemented by the *Cloud Security & Identity Agent*): Decode incoming client token in the Azure Function and check if user belongs to authorization Security Groups in Entra ID via Microsoft Graph.
- Third-Party Credentials (Implemented by the *Cloud Security & Identity Agent*): Fetch secrets securely via Azure Key Vault using Managed Identity. Do not hardcode API keys.

## API & Cache Rules
- API Retrieval (Implemented by the *Backend Serverless Agent*): Always use concurrent calls (`Promise.all`) when querying third-party systems (Datto and Autotask).
- In-Memory Cache (Implemented by the *Backend Serverless Agent*): Maintain an ephemeral backend memory cache for query results.
- **Cache TTL**: Strict 5-minute TTL limit (`5 * 60 * 1000` ms).

## SPFx Release Versioning (Enforced by the *Project Orchestrator Agent*)

Every build and upload of `backup-watch-scaffold.sppkg` to the SharePoint App Catalog **must** include a version bump in `C:\AG\BackupWatchScaffold\config\package-solution.json`. The version field uses the format `MAJOR.MINOR.PATCH.0`.

### Version Decision Rules

| Change Type | Version Bump | Examples |
|-------------|-------------|---------|
| Full dashboard redesign, new auth scheme, breaking API change, or users must re-add the web part to a page | **MAJOR** (e.g. `1.x → 2.0.0`) | New web part, switching from SPFx to Teams app, changing SSO scheme |
| New visible feature, new column, new section, new tab, or any change a user will notice | **MINOR** (e.g. `1.0 → 1.1.0`) | New metric tile, new agent card section, new table column, new tag type |
| Bug fix, encoding fix, typo, or style tweak with no new features | **PATCH** (e.g. `1.1.0 → 1.1.1`) | Fixing corrupted characters, fixing a broken conditional, colour tweaks |

### Mental Test
Ask: *"Did I add something new, or did I fix something existing?"*
- Added something new → **MINOR**
- Fixed or polished something existing → **PATCH**
- Changed the entire way something works → **MAJOR**

### Version Comments Requirement
The AI assistant **MUST** append a "Version Comments" section at the very end of its response to the user whenever the `.sppkg` package is built, rebuilt, or updated. This section must outline what has changed under that specific version.

### Current Version
**v1.9.2** — last released 2026-06-25. The release log is maintained in memory.md.
