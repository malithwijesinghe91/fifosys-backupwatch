# Agent Build Instructions - BackupWatch Implementation

Follow these structured build tasks sequentially to implement the stateless BackupWatch project.

---

## Task 1: Scaffolding the Stateless Monorepo Structure
- **Assigned to**: *Project Orchestrator Agent* (Scaffolding coordination), *Frontend Integration Agent* (SPFx setup), and *Backend Serverless Agent* (Azure Functions setup).

### Objectives
1. Set up `/spfx-client` containing a clean TypeScript-based SPFx project configured with React and Tailwind CSS.
2. Set up `/stateless-backend` containing an HTTP-triggered Node.js Azure Function framework running on TypeScript.
3. Establish global runtime variables `cachedData` and `cacheTimestamp` in backend main scope.

### File Targets
- `/spfx-client/package.json`
- `/stateless-backend/package.json`
- `/stateless-backend/src/functions/httpTrigger.ts`

---

## Task 2: Real-Time Backend Cache & Correlation Logic
- **Assigned to**: *Backend Serverless Agent* (APIs & Caching) and *Cloud Security & Identity Agent* (Secure endpoints credentials fetching).

### Objectives
1. Implement Axios fetches targeting Datto and Autotask API endpoints in parallel using `Promise.all()`.
2. Check incoming cache age using:
   ```typescript
   const isCacheValid = cachedData && (Date.now() - cacheTimestamp < 300000);
   ```
3. Map Datto appliances with Autotask tickets in-memory:
   - Identify mismatch anomalies (device backup failed but no corresponding Autotask ticket open).
   - Return clean JSON payloads containing device name, model, storage, backup state, ticket ID, and action requirement flag.

### File Targets
- `/stateless-backend/src/functions/httpTrigger.ts`

---

## Task 3: Client React Dashboard with Entra ID RBAC
- **Assigned to**: *Frontend Integration Agent* (UI rendering) and *Cloud Security & Identity Agent* (Microsoft Graph RBAC validation).

### Objectives
1. Build the dashboard UI matching the dark theme wireframe style from the blueprint.
2. Execute backend API query via standard SPFx `AadHttpClient`.
3. Query `https://graph.microsoft.com/v1.0/me/transitiveMemberOf` using `MSGraphClientV3`.
4. Restrict Action buttons (e.g. ticket creation/escalation triggers) based on the group validation boolean.

### File Targets
- `/spfx-client/src/webparts/backupWatchDashboard/components/BackupWatchDashboard.tsx`
