# Implementation Plan - Fallback Configuration Item Mapping & Subject Format Update (Detailed)

This plan outlines the detailed code changes required to automate Autotask Configuration Item (Asset) linkage and to update ticket subject formatting to mimic Datto email alerts.

## Goal Description

1. **Fallback Configuration Item (Asset) Lookup**: 
   Automate linking the ticket to the correct Configuration Item (Asset) in Autotask. The lookup flow will match:
   - If it is an agent-level alert, query by `agentName` (guest hostname).
   - If not found or if it is an appliance-level alert, query by appliance `serialNumber`.
   - If still not found, query by appliance `deviceName`.
   
   To avoid the Autotask REST API `op: "equals"` limitations observed in queries (where exact matching occasionally fails due to formatting/space anomalies), we will fetch candidate records using `op: "contains"` and perform exact matching and sorting in Javascript:
   - Sort matches prioritizing the correct mapped `companyID` and `isActive === true`.
   - Automatically inherit the matched Asset's `companyID` to ensure accurate ticket mapping, falling back to name-based company matching and catch-all policies if no Asset is found.

2. **Ticket Subject formatting**:
   Modify the ticket subject line style to align with Datto email alerts:
   - **Agent-Level Alerts** (when `agentName` is present): `CRITICAL ERROR for [AgentName] on [DeviceName]`
   - **Appliance-Level Alerts** (when `agentName` is absent): `CRITICAL ERROR for [DeviceName]`

---

## Proposed Changes

### 1. Backend Shared Module (`stateless-backend/shared`)

#### [MODIFY] [autotask.ts](file:///C:/AG/FifoDash/stateless-backend/shared/autotask.ts)
We will add `lookupConfigurationItemInAutoTask` below `lookupDeviceInAutoTask`. This function performs the 3-step lookup chain using `op: "contains"` queries combined with exact client-side filtering and sorting:

```typescript
export async function lookupConfigurationItemInAutoTask(
    params: { serialNumber: string; agentName?: string; deviceName?: string; companyID: number | null },
    config: IAutoTaskConfig
): Promise<IConfigurationItem | null> {
    try {
        const baseUrl = await getAutoTaskBaseUrl(config.user);
        const headers = await getAutoTaskHeaders(config);

        // Helper to sort candidates: Target Company + Active > Target Company + Inactive > Active > Inactive
        const sortCandidates = (items: any[]) => {
            return items.sort((a, b) => {
                const aIsCompany = params.companyID !== null && a.companyID === params.companyID;
                const bIsCompany = params.companyID !== null && b.companyID === params.companyID;
                
                if (aIsCompany && !bIsCompany) return -1;
                if (!aIsCompany && bIsCompany) return 1;
                
                if (a.isActive && !b.isActive) return -1;
                if (!a.isActive && b.isActive) return 1;
                
                return 0;
            });
        };

        // --- STEP 1: Search by agentName (if provided) ---
        if (params.agentName) {
            const agentNameClean = params.agentName.trim();
            console.log(`[AutoTask Asset Lookup] Querying candidates containing agentName: "${agentNameClean}"`);
            const response = await axios.post(`${baseUrl}ConfigurationItems/query`, {
                filter: [
                    {
                        op: "or",
                        items: [
                            { op: "contains", field: "referenceTitle", value: agentNameClean },
                            { op: "contains", field: "dattoHostname", value: agentNameClean },
                            { op: "contains", field: "serialNumber", value: agentNameClean }
                        ]
                    }
                ]
            }, { headers, timeout: 15000 });

            const items = response.data && response.data.items || [];
            // Match exact case-insensitive
            const exactMatches = items.filter((item: any) => {
                const labelMatch = item.referenceTitle && item.referenceTitle.toLowerCase().trim() === agentNameClean.toLowerCase();
                const hostMatch = item.dattoHostname && item.dattoHostname.toLowerCase().trim() === agentNameClean.toLowerCase();
                const serialMatch = item.serialNumber && item.serialNumber.toLowerCase().trim() === agentNameClean.toLowerCase();
                return labelMatch || hostMatch || serialMatch;
            });

            if (exactMatches.length > 0) {
                const bestMatch = sortCandidates(exactMatches)[0];
                console.log(`[AutoTask Asset Lookup] Found exact match by agentName "${agentNameClean}": ID=${bestMatch.id}, CompanyID=${bestMatch.companyID}, Active=${bestMatch.isActive}`);
                return {
                    id: bestMatch.id,
                    companyID: bestMatch.companyID,
                    serialNumber: bestMatch.serialNumber
                };
            }
        }

        // --- STEP 2: Search by appliance serialNumber ---
        const serialClean = params.serialNumber.trim();
        console.log(`[AutoTask Asset Lookup] Querying candidates containing appliance serialNumber: "${serialClean}"`);
        const responseSerial = await axios.post(`${baseUrl}ConfigurationItems/query`, {
            filter: [
                {
                    op: "or",
                    items: [
                        { op: "contains", field: "serialNumber", value: serialClean },
                        { op: "contains", field: "dattoSerialNumber", value: serialClean },
                        { op: "contains", field: "referenceNumber", value: serialClean }
                    ]
                }
            ]
        }, { headers, timeout: 15000 });

        const serialItems = responseSerial.data && responseSerial.data.items || [];
        const exactSerialMatches = serialItems.filter((item: any) => {
            const sMatch = item.serialNumber && item.serialNumber.toLowerCase().trim() === serialClean.toLowerCase();
            const dsMatch = item.dattoSerialNumber && item.dattoSerialNumber.toLowerCase().trim() === serialClean.toLowerCase();
            const refMatch = item.referenceNumber && item.referenceNumber.toLowerCase().trim() === serialClean.toLowerCase();
            return sMatch || dsMatch || refMatch;
        });

        if (exactSerialMatches.length > 0) {
            const bestMatch = sortCandidates(exactSerialMatches)[0];
            console.log(`[AutoTask Asset Lookup] Found exact match by appliance serialNumber "${serialClean}": ID=${bestMatch.id}, CompanyID=${bestMatch.companyID}, Active=${bestMatch.isActive}`);
            return {
                id: bestMatch.id,
                companyID: bestMatch.companyID,
                serialNumber: bestMatch.serialNumber
            };
        }

        // --- STEP 3: Search by appliance deviceName ---
        if (params.deviceName) {
            const deviceNameClean = params.deviceName.trim();
            console.log(`[AutoTask Asset Lookup] Querying candidates containing appliance deviceName: "${deviceNameClean}"`);
            const responseDevice = await axios.post(`${baseUrl}ConfigurationItems/query`, {
                filter: [
                    { op: "contains", field: "referenceTitle", value: deviceNameClean }
                ]
            }, { headers, timeout: 15000 });

            const deviceItems = responseDevice.data && responseDevice.data.items || [];
            const exactDeviceMatches = deviceItems.filter((item: any) => {
                return item.referenceTitle && item.referenceTitle.toLowerCase().trim() === deviceNameClean.toLowerCase();
            });

            if (exactDeviceMatches.length > 0) {
                const bestMatch = sortCandidates(exactDeviceMatches)[0];
                console.log(`[AutoTask Asset Lookup] Found exact match by appliance deviceName "${deviceNameClean}": ID=${bestMatch.id}, CompanyID=${bestMatch.companyID}, Active=${bestMatch.isActive}`);
                return {
                    id: bestMatch.id,
                    companyID: bestMatch.companyID,
                    serialNumber: bestMatch.serialNumber
                };
            }
        }

        console.log(`[AutoTask Asset Lookup] No matching configuration item found in AutoTask for agentName="${params.agentName || ""}", serial="${params.serialNumber}", deviceName="${params.deviceName || ""}".`);
        return null;
    } catch (err: any) {
        console.error(`[AutoTask Asset Lookup] Failed to lookup configuration item:`, err.message || err);
        return null;
    }
}
```

---

### 2. Backend Escalation Trigger (`stateless-backend/escalateTrigger`)

#### [MODIFY] [index.ts](file:///C:/AG/FifoDash/stateless-backend/escalateTrigger/index.ts)
* Import the new function `lookupConfigurationItemInAutoTask` from `../shared/autotask`.
* Replace Step 5 (Company and Configuration Item Resolution) with:

```typescript
        // 5. Look up Mapped Company and Configuration Item (Asset)
        let companyID: number | null = null;
        let configurationItemID: number | undefined = undefined;

        // Try mapping the company by name first (case-insensitive & fuzzy fallback)
        companyID = await lookupCompanyInAutoTask(companyName, autotaskConfig);
        if (companyID) {
            context.log.info(`Initially matched company ID by name: "${companyName}" -> CompanyID=${companyID}`);
        }

        // Search for the Configuration Item with our fallback lookup chain
        const ciItem = await lookupConfigurationItemInAutoTask({
            serialNumber,
            agentName,
            deviceName,
            companyID
        }, autotaskConfig);

        if (ciItem) {
            configurationItemID = ciItem.id;
            // Override or establish companyID with the Asset's companyID to ensure they match
            companyID = ciItem.companyID;
            context.log.info(`Resolved Configuration Item mapping: CompanyID=${companyID}, AssetID=${configurationItemID}`);
        }

        // Use Catch-all Company ID if both lookups fail to resolve a companyID
        if (!companyID) {
            const catchAllId = process.env.AUTOTASK_CATCHALL_COMPANY_ID;
            if (catchAllId) {
                companyID = parseInt(catchAllId);
                context.log.warn(`Company lookup failed. Using Catch-all Company ID: ${companyID}`);
            } else {
                throw new Error(`Could not resolve company mapping in AutoTask for "${companyName}" (Serial: ${serialNumber}) and no AUTOTASK_CATCHALL_COMPANY_ID is configured.`);
            }
        }
```

* Replace Step 8 (Ticket Title Generation) with:

```typescript
        // 8. Create Ticket in AutoTask with extended field categorizations
        const ticketTitle = agentName
            ? `CRITICAL ERROR for ${agentName} on ${deviceName}`
            : `CRITICAL ERROR for ${deviceName}`;
```

---

## Verification Plan

### Automated Verification
1. Run `npm run build` inside `C:\AG\FifoDash\stateless-backend` to verify clean compilation.

### Manual Verification
1. Trigger an agent-level ticket escalation (e.g. Backup failure or Screenshot Verification issue) via the dashboard and check the resulting ticket in Autotask:
   - Subject matches: `CRITICAL ERROR for [AgentName] on [DeviceName]`
   - Linked Configuration Item matches the agent hostname asset.
2. Trigger an appliance-level ticket escalation (e.g. Offline or Storage alert) via the dashboard and check in Autotask:
   - Subject matches: `CRITICAL ERROR for [DeviceName]`
   - Linked Configuration Item matches the appliance device asset.
