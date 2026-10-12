import { autotaskRequest } from "./autotaskGateway";
import { guardAutotaskWrite, IAutotaskWriteContext } from "./autotaskPolicy";
import { normalizeVolumeName } from "./volumeUtils";
import { getAutotaskRoutingConfig, getAlertRoutingMatrix, DEFAULT_ALERT_ROUTING_MATRIX } from "./configService";

let cachedBaseUrl: string | null = null;

export interface IAutoTaskConfig {
    user: string;
    secret: string;
    integrationCode: string;
}

export function getAutoTaskConfig(): IAutoTaskConfig | null {
    const user = process.env.AUTOTASK_USER;
    const secret = process.env.AUTOTASK_SECRET;
    const integrationCode = process.env.AUTOTASK_INTEGRATION_CODE;

    if (!user || !secret || !integrationCode) {
        return null;
    }

    return { user, secret, integrationCode };
}

export async function getAutoTaskBaseUrl(user: string): Promise<string> {
    if (cachedBaseUrl) return cachedBaseUrl;

    try {
        const response = await autotaskRequest(null, { method: "get", kind: "read", anonymous: true, timeoutMs: 10000, url: `https://webservices.autotask.net/atservicesrest/v1.0/zoneInformation?user=${encodeURIComponent(user)}` });
        if (response.data && response.data.url) {
            let url = response.data.url;
            if (!url.endsWith("/")) {
                url += "/";
            }
            if (!url.includes("v1.0/")) {
                url += "v1.0/";
            }
            cachedBaseUrl = url;
            return cachedBaseUrl!;
        }
        throw new Error("Invalid response from AutoTask zoneInformation endpoint.");
    } catch (err: any) {
        console.error("Failed to fetch AutoTask zone information:", err.message || err);
        // Fallback to default
        return "https://webservices.autotask.net/atservicesrest/v1.0/";
    }
}

export function getAutoTaskZoneNumber(baseUrl: string): string {
    const match = baseUrl.match(/webservices(\d+)\.autotask\.net/i);
    return match ? match[1] : "16"; // Default to 16 if extraction fails
}

export function getAutoTaskTicketUrl(baseUrl: string, ticketId: number | string): string {
    const zone = getAutoTaskZoneNumber(baseUrl);
    return `https://ww${zone}.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc/Index?ticketId=${ticketId}`;
}

export interface IConfigurationItem {
    id: number;
    companyID: number;
    serialNumber: string;
}

export async function lookupDeviceInAutoTask(serialNumber: string, config: IAutoTaskConfig): Promise<IConfigurationItem | null> {
    try {
        const baseUrl = await getAutoTaskBaseUrl(config.user);

        const response = await autotaskRequest(config, { method: "post", kind: "read", url: `${baseUrl}ConfigurationItems/query`, data: {
            filter: [
                {
                    op: "equals",
                    field: "serialNumber",
                    value: serialNumber
                }
            ]
        } });

        const items = response.data && response.data.items;
        if (items && items.length > 0) {
            return {
                id: items[0].id,
                companyID: items[0].companyID,
                serialNumber: items[0].serialNumber
            };
        }
        return null;
    } catch (err: any) {
        console.error(`Failed to lookup device ${serialNumber} in AutoTask:`, err.message || err);
        return null;
    }
}

export async function lookupConfigurationItemInAutoTask(
    params: { serialNumber: string; agentName?: string; deviceName?: string; companyID: number | null },
    config: IAutoTaskConfig
): Promise<IConfigurationItem | null> {
    try {
        const baseUrl = await getAutoTaskBaseUrl(config.user);

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
            const response = await autotaskRequest(config, { method: "post", kind: "read", url: `${baseUrl}ConfigurationItems/query`, data: {
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
            } });

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
        const serialClean = params.serialNumber ? params.serialNumber.trim() : "";
        if (serialClean) {
            console.log(`[AutoTask Asset Lookup] Querying candidates containing appliance serialNumber: "${serialClean}"`);
            const responseSerial = await autotaskRequest(config, { method: "post", kind: "read", url: `${baseUrl}ConfigurationItems/query`, data: {
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
            } });

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
        }

        // --- STEP 3: Search by appliance deviceName ---
        if (params.deviceName) {
            const deviceNameClean = params.deviceName.trim();
            console.log(`[AutoTask Asset Lookup] Querying candidates containing appliance deviceName: "${deviceNameClean}"`);
            const responseDevice = await autotaskRequest(config, { method: "post", kind: "read", url: `${baseUrl}ConfigurationItems/query`, data: {
                filter: [
                    { op: "contains", field: "referenceTitle", value: deviceNameClean }
                ]
            } });

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

export async function lookupCompanyInAutoTask(companyName: string, config: IAutoTaskConfig): Promise<number | null> {
    try {
        const baseUrl = await getAutoTaskBaseUrl(config.user);

        // 1. Try exact match
        let response = await autotaskRequest(config, { method: "post", kind: "read", url: `${baseUrl}Companies/query`, data: {
            filter: [
                {
                    op: "equals",
                    field: "companyName",
                    value: companyName
                }
            ]
        } });

        let items = response.data && response.data.items;
        if (items && items.length > 0) {
            return items[0].id;
        }

        // 2. Fuzzy match helper - clean corporate suffixes (e.g. Ltd, Limited, Group)
        const cleanName = companyName
            .replace(/\b(ltd|limited|group|plc|llp|co|corp|corporation)\b/gi, "")
            .trim();

        if (cleanName && cleanName.toLowerCase() !== companyName.toLowerCase()) {
            console.log(`Fallback: Querying companyName with cleaned name: "${cleanName}"`);
            response = await autotaskRequest(config, { method: "post", kind: "read", url: `${baseUrl}Companies/query`, data: {
                filter: [
                    {
                        op: "equals",
                        field: "companyName",
                        value: cleanName
                    }
                ]
            } });

            items = response.data && response.data.items;
            if (items && items.length > 0) {
                return items[0].id;
            }
        }

        // 3. Fallback to beginsWith
        console.log(`Fallback: Querying beginsWith for "${cleanName || companyName}"`);
        response = await autotaskRequest(config, { method: "post", kind: "read", url: `${baseUrl}Companies/query`, data: {
            filter: [
                {
                    op: "beginsWith",
                    field: "companyName",
                    value: cleanName || companyName
                }
            ]
        } });

        items = response.data && response.data.items;
        if (items && items.length > 0) {
            // Find active company if multiple matched
            const activeCompany = items.find((c: any) => c.isActive !== false);
            return activeCompany ? activeCompany.id : items[0].id;
        }

        // 4. Fallback to contains
        console.log(`Fallback: Querying contains for "${cleanName || companyName}"`);
        response = await autotaskRequest(config, { method: "post", kind: "read", url: `${baseUrl}Companies/query`, data: {
            filter: [
                {
                    op: "contains",
                    field: "companyName",
                    value: cleanName || companyName
                }
            ]
        } });

        items = response.data && response.data.items;
        if (items && items.length > 0) {
            const activeCompany = items.find((c: any) => c.isActive !== false);
            return activeCompany ? activeCompany.id : items[0].id;
        }

        return null;
    } catch (err: any) {
        console.error(`Failed to lookup company ${companyName} in AutoTask:`, err.message || err);
        return null;
    }
}


/** Company name for the Admin Console asset tester (read-only). */
export async function getAutotaskCompanyName(companyID: number, config: IAutoTaskConfig): Promise<string | null> {
    try {
        const baseUrl = await getAutoTaskBaseUrl(config.user);
        const response = await autotaskRequest(config, { method: "get", kind: "read", timeoutMs: 8000, url: `${baseUrl}Companies/${companyID}` });
        return response.data && response.data.item && response.data.item.companyName ? response.data.item.companyName : null;
    } catch (err: any) {
        console.error(`Failed to get company ${companyID} from AutoTask:`, err.message || err);
        return null;
    }
}

/** Connectivity probe for diagnostics: unauthenticated zoneInformation lookup. Throws on failure. */
export async function pingAutotaskZone(user: string): Promise<void> {
    await autotaskRequest(null, { method: "get", kind: "read", anonymous: true, timeoutMs: 8000, url: `https://webservices.autotask.net/atservicesrest/v1.0/zoneInformation?user=${encodeURIComponent(user)}` });
}

export interface IAutoTaskTicket {
    id: number;
    companyID: number;
    title: string;
    status: number; // 5 = Completed
    configurationItemID?: number;
    ticketNumber?: string;
}

export async function queryTicketsInAutoTask(ticketIds: number[], config: IAutoTaskConfig): Promise<IAutoTaskTicket[]> {
    if (!ticketIds || ticketIds.length === 0) return [];

    try {
        const baseUrl = await getAutoTaskBaseUrl(config.user);

        const filterItems = ticketIds.map(id => ({
            op: "equals",
            field: "id",
            value: id
        }));

        const response = await autotaskRequest(config, { method: "post", kind: "read", url: `${baseUrl}Tickets/query`, data: {
            filter: [
                ticketIds.length === 1
                    ? filterItems[0]
                    : { op: "or", items: filterItems }
            ]
        } });

        return response.data && response.data.items || [];
    } catch (err: any) {
        console.error("Failed to query tickets in AutoTask:", err.message || err);
        return [];
    }
}

export async function queryTicketByNumber(ticketNumber: string, config: IAutoTaskConfig): Promise<IAutoTaskTicket | null> {
    if (!ticketNumber) return null;
    try {
        const baseUrl = await getAutoTaskBaseUrl(config.user);

        const cleanNumber = ticketNumber.trim();
        const response = await autotaskRequest(config, { method: "post", kind: "read", url: `${baseUrl}Tickets/query`, data: {
            filter: [
                {
                    op: "eq",
                    field: "ticketNumber",
                    value: cleanNumber
                }
            ]
        } });

        let items = response.data && response.data.items;
        if (!items || items.length === 0) {
            // Fallback with contains
            const responseFallback = await autotaskRequest(config, { method: "post", kind: "read", url: `${baseUrl}Tickets/query`, data: {
                filter: [
                    {
                        op: "contains",
                        field: "ticketNumber",
                        value: cleanNumber
                    }
                ]
            } });
            items = responseFallback.data && responseFallback.data.items;
        }

        if (items && items.length > 0) {
            return items[0];
        }
        return null;
    } catch (err: any) {
        console.error(`Failed to query ticket by ticketNumber ${ticketNumber} in AutoTask:`, err.message || err);
        return null;
    }
}

export async function queryOpenTicketByTitle(title: string, config: IAutoTaskConfig): Promise<IAutoTaskTicket | null> {
    if (!title) return null;
    try {
        const baseUrl = await getAutoTaskBaseUrl(config.user);
        const cleanTitle = title.trim();

        const response = await autotaskRequest(config, { method: "post", kind: "read", url: `${baseUrl}Tickets/query`, data: {
            filter: [
                {
                    op: "eq",
                    field: "title",
                    value: cleanTitle
                },
                {
                    op: "noteq",
                    field: "status",
                    value: 5 // 5 = Completed/Closed
                }
            ]
        } });

        const items = response.data && response.data.items;
        if (items && items.length > 0) {
            return items[0];
        }
        return null;
    } catch (err: any) {
        console.error(`Failed to query open ticket by title in AutoTask:`, err.message || err);
        return null;
    }
}

export async function getSingleTicketFromAutoTask(ticketId: number, config: IAutoTaskConfig): Promise<IAutoTaskTicket | null> {
    try {
        const baseUrl = await getAutoTaskBaseUrl(config.user);
        const response = await autotaskRequest(config, { method: "get", kind: "read", url: `${baseUrl}Tickets/${ticketId}` });
        return response.data && response.data.item ? response.data.item : null;
    } catch (err: any) {
        console.error(`Failed to get ticket ${ticketId} from AutoTask:`, err.message || err);
        return null;
    }
}

export interface IPicklistValue {
    value: number;
    label: string;
    parentValue?: string;
    isActive?: boolean;
}

interface IEntityFieldsCache {
    fields: any[];
    timestamp: number;
}

let ticketFieldsCache: IEntityFieldsCache | null = null;
let inFlightTicketFieldsPromise: Promise<any[]> | null = null;
const TICKET_FIELDS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 Hour

/**
 * Fetches all Ticket entity fields and picklists from Autotask exactly once,
 * caching the metadata in memory for 1 hour to prevent breaching the 3-thread ceiling.
 * Implements an in-flight singleton promise lock to prevent thundering herd concurrency.
 */
export async function getTicketEntityFields(config: IAutoTaskConfig, forceRefresh: boolean = false): Promise<any[]> {
    const now = Date.now();
    if (!forceRefresh && ticketFieldsCache && (now - ticketFieldsCache.timestamp < TICKET_FIELDS_CACHE_TTL_MS)) {
        return ticketFieldsCache.fields;
    }

    if (inFlightTicketFieldsPromise) {
        return inFlightTicketFieldsPromise;
    }

    inFlightTicketFieldsPromise = (async () => {
        try {
            const baseUrl = await getAutoTaskBaseUrl(config.user);
                const response = await autotaskRequest(config, { method: "get", kind: "read", url: `${baseUrl}Tickets/entityInformation/fields` });
            const fields = response.data && response.data.fields ? response.data.fields : (Array.isArray(response.data) ? response.data : []);
            
            if (Array.isArray(fields) && fields.length > 0) {
                ticketFieldsCache = {
                    fields,
                    timestamp: Date.now()
                };
            }
            return fields;
        } catch (err: any) {
            console.error("Failed to fetch Ticket entity fields from AutoTask:", err.message || err);
            // If network failure occurs but we have stale cached data, return it as resilient fallback
            if (ticketFieldsCache && ticketFieldsCache.fields) {
                return ticketFieldsCache.fields;
            }
            return [];
        } finally {
            inFlightTicketFieldsPromise = null;
        }
    })();

    return inFlightTicketFieldsPromise;
}

export async function getTicketFieldPicklistValues(fieldName: string, config: IAutoTaskConfig, forceRefresh: boolean = false): Promise<IPicklistValue[]> {
    try {
        const fields = await getTicketEntityFields(config, forceRefresh);
        const targetField = fields.find((f: any) => f.name && f.name.toLowerCase() === fieldName.toLowerCase());
        
        if (targetField && targetField.picklistValues) {
            return targetField.picklistValues
                .filter((pv: any) => pv.isActive !== false)
                .map((pv: any) => ({
                    value: parseInt(pv.value, 10),
                    label: String(pv.label),
                    parentValue: pv.parentValue !== undefined && pv.parentValue !== null ? String(pv.parentValue) : undefined,
                    isActive: pv.isActive
                }));
        }
        return [];
    } catch (err: any) {
        console.error(`Failed to resolve Ticket ${fieldName} picklist values:`, err.message || err);
        return [];
    }
}

export async function getTicketStatusPicklistValues(config: IAutoTaskConfig, forceRefresh: boolean = false): Promise<{ value: number; label: string }[]> {
    return getTicketFieldPicklistValues("status", config, forceRefresh);
}

export async function updateTicketStatusInAutoTask(ticketId: number, statusId: number, config: IAutoTaskConfig, ctx: IAutotaskWriteContext): Promise<boolean> {
    if (!(await guardAutotaskWrite(ctx))) return false;
    try {
        const baseUrl = await getAutoTaskBaseUrl(config.user);
        const response = await autotaskRequest(config, { method: "patch", kind: "write", url: `${baseUrl}Tickets`, data: {
            id: ticketId,
            status: statusId
        } });
        return response.status === 200 || response.status === 204;
    } catch (err: any) {
        console.error(`Failed to update status for ticket ${ticketId} in AutoTask:`, err.message || err);
        return false;
    }
}

export async function lookupContractInAutoTask(companyID: number, contractName: string, config: IAutoTaskConfig): Promise<number | null> {
    try {
        const baseUrl = await getAutoTaskBaseUrl(config.user);

        const response = await autotaskRequest(config, { method: "post", kind: "read", url: `${baseUrl}Contracts/query`, data: {
            filter: [
                {
                    op: "equals",
                    field: "companyID",
                    value: companyID
                },
                {
                    op: "equals",
                    field: "contractName",
                    value: contractName
                },
                {
                    op: "equals",
                    field: "status",
                    value: 1 // Active
                }
            ]
        } });

        const items = response.data && response.data.items;
        if (items && items.length > 0) {
            return items[0].id;
        }
        return null;
    } catch (err: any) {
        console.error(`Failed to lookup contract ${contractName} for company ${companyID} in AutoTask:`, err.message || err);
        return null;
    }
}

export async function createTicketInAutoTask(payload: {
    title: string;
    description: string;
    companyID: number;
    configurationItemID?: number;
    queueID?: number;
    ticketCategory?: number;
    ticketType?: number;
    source?: number;
    allocationCodeID?: number;
    issueType?: number;
    subIssueType?: number;
    contractID?: number;
    priority?: number;
}, config: IAutoTaskConfig, ctx: IAutotaskWriteContext): Promise<number | null> {
    if (!(await guardAutotaskWrite(ctx))) return null;
    try {
        const baseUrl = await getAutoTaskBaseUrl(config.user);

        const response = await autotaskRequest(config, { method: "post", kind: "write", url: `${baseUrl}Tickets`, data: {
            ...payload,
            status: 1, // New
            priority: payload.priority !== undefined ? payload.priority : 2 // Default Medium
        } });

        if (response.data && response.data.itemId) {
            return response.data.itemId;
        }
        if (response.data && response.data.id) {
            return response.data.id;
        }
        return null;
    } catch (err: any) {
        console.error("Failed to create ticket in AutoTask:", err.message || err);
        throw err;
    }
}

export async function createTicketNoteInAutoTask(ticketId: number, note: {
    title: string;
    description: string;
    publish?: number; // 1 = All Users, 2 = Internal Only
}, config: IAutoTaskConfig, ctx: IAutotaskWriteContext): Promise<boolean> {
    if (!(await guardAutotaskWrite(ctx))) return false;
    try {
        const baseUrl = await getAutoTaskBaseUrl(config.user);

        const response = await autotaskRequest(config, { method: "post", kind: "write", url: `${baseUrl}Tickets/${ticketId}/Notes`, data: {
            title: note.title,
            description: note.description,
            noteType: 1, // Detail Note
            publish: note.publish !== undefined ? note.publish : 1 // Default to All / Public
        } });

        if (response && (response.status === 200 || response.status === 201)) {
            console.log(`[AutoTask Note Push] Successfully created note on ticket ${ticketId}`);
            return true;
        }
        return false;
    } catch (err: any) {
        console.error(`Failed to create note on ticket ${ticketId} in AutoTask:`, err.response?.data || err.message || err);
        return false;
    }
}

export async function createComplianceTicket(params: {
    deviceName: string;
    agentName: string;
    volumeName: string;
    reason: string;
    serialNumber?: string;
    clientCompanyName?: string;
}, config: IAutoTaskConfig, ctx: IAutotaskWriteContext): Promise<{ ticketId: number; companyID: number; configurationItemID?: number } | null> {
    const safeDevice = (params.deviceName || "Unknown Device").trim();
    const safeAgent = (params.agentName || "Unknown Agent").trim();
    const normVol = normalizeVolumeName(params.volumeName);

    // Blackout and silence rules (autotaskPolicy.ts) – checked before any lookups are made.
    const writeCtx: IAutotaskWriteContext = { ...ctx, deviceName: safeDevice, agentName: safeAgent };
    if (!(await guardAutotaskWrite(writeCtx))) return null;

    const alertMatrix = await getAlertRoutingMatrix();
    const volConfig = alertMatrix.VolumeExclusion || DEFAULT_ALERT_ROUTING_MATRIX.VolumeExclusion;

    if (!volConfig.autoTicketEnabled) {
        console.log(`[Auto-Ticket Disabled] Automatic ticketing for VolumeExclusion is currently disabled by Administrator. Skipping ticket creation for ${safeDevice}:${safeAgent}:${normVol}.`);
        return null;
    }

    let ticketTitle = `Volume Exclusion Detected - ${safeDevice} - ${safeAgent} - ${normVol}`;
    if (volConfig.titleTemplate) {
        ticketTitle = volConfig.titleTemplate
            .replace(/{Company}/g, params.clientCompanyName || "Client")
            .replace(/{Device}/g, safeDevice)
            .replace(/{Agent}/g, safeAgent)
            .replace(/{Detail}/g, normVol)
            .trim();
    }

    // Pre-check: Avoid duplicate tickets if an open ticket with this title already exists in Autotask
    try {
        const existingOpenTicket = await queryOpenTicketByTitle(ticketTitle, config);
        if (existingOpenTicket) {
            console.log(`[Autotask Ticket Dedup] Open ticket #${existingOpenTicket.id} (${existingOpenTicket.ticketNumber || existingOpenTicket.id}) already exists with title "${ticketTitle}". Reusing existing ticket.`);
            return {
                ticketId: existingOpenTicket.id,
                companyID: existingOpenTicket.companyID,
                configurationItemID: existingOpenTicket.configurationItemID
            };
        }
    } catch (dedupErr: any) {
        console.warn(`[Autotask Ticket Dedup] Query check failed, proceeding to create:`, dedupErr.message || dedupErr);
    }

    // Fallback Level 1: Look up by agent name (hostname)
    let asset = await lookupConfigurationItemInAutoTask({
        serialNumber: params.serialNumber || "",
        agentName: safeAgent,
        deviceName: safeDevice,
        companyID: null
    }, config);

    let companyID: number | null = null;
    let configurationItemID: number | undefined = undefined;

    if (asset) {
        companyID = asset.companyID;
        configurationItemID = asset.id;
        console.log(`[Autotask Ticket Fallback] Found Agent CI: ID=${asset.id}, CompanyID=${asset.companyID}`);
    } else {
        // Fallback Level 2: Try to find appliance CI
        console.log(`[Autotask Ticket Fallback] Agent CI not found. Trying Appliance CI lookup...`);
        let applianceAsset = await lookupConfigurationItemInAutoTask({
            serialNumber: params.serialNumber || "",
            deviceName: safeDevice,
            companyID: null
        }, config);

        if (applianceAsset) {
            companyID = applianceAsset.companyID;
            configurationItemID = applianceAsset.id;
            console.log(`[Autotask Ticket Fallback] Found Appliance CI: ID=${applianceAsset.id}, CompanyID=${applianceAsset.companyID}`);
        } else {
            // Fallback Level 3: Try to look up the company by name
            console.log(`[Autotask Ticket Fallback] Appliance CI not found. Trying Company lookup...`);
            if (params.clientCompanyName) {
                const resolvedCompanyID = await lookupCompanyInAutoTask(params.clientCompanyName, config);
                if (resolvedCompanyID) {
                    companyID = resolvedCompanyID;
                    console.log(`[Autotask Ticket Fallback] Found Company by name: ID=${resolvedCompanyID}`);
                }
            }
        }
    }

    // Fallback Level 4: Use Catch-All Company
    if (companyID === null || companyID === undefined || isNaN(companyID)) {
        const catchAll = process.env.AUTOTASK_CATCHALL_COMPANY_ID;
        companyID = (catchAll !== null && catchAll !== undefined && catchAll.trim() !== "") ? parseInt(catchAll) : null;
        if (companyID !== null && companyID !== undefined && !isNaN(companyID)) {
            console.log(`[Autotask Ticket Fallback] Falling back to Catch-All Company: ID=${companyID}`);
        }
    }

    if (companyID === null || companyID === undefined || isNaN(companyID)) {
        console.error(`[Autotask Ticket Fallback] Failed to resolve any target Company ID. Cannot create ticket.`);
        return null;
    }

    const ukTimeStr = new Date().toLocaleString("en-GB", { timeZone: "Europe/London" });
    const ticketDescription = `[COMPLIANCE ALERT] VOLUME EXCLUDED IN DATTO BCDR\n\n` +
        `An unprotected volume has been detected on server [${safeAgent}] (Appliance: [${safeDevice}]).\n\n` +
        `Details:\n` +
        `* Volume: [${normVol}]\n` +
        `* Agent / Server: [${safeAgent}]\n` +
        `* Datto Appliance: [${safeDevice}]\n` +
        `* Detected Time: ${ukTimeStr}\n\n` +
        `Action Required for Engineers:\n` +
        `1. If the exclusion is TEMPORARY (e.g. maintenance / active investigation):\n` +
        `   -> Go to BackupWatch Dashboard, select the volume, enter a reason, and set a Temporary Exclusion (choose 1, 3, 7, 14, or 30 days duration).\n\n` +
        `2. If the volume should PERMANENTLY never be backed up (e.g. scratch disk / temp data):\n` +
        `   -> Go to BackupWatch Dashboard, select the volume, enter the technical justification, and set a Permanent Exclusion.\n\n` +
        `3. If the volume was excluded by MISTAKE:\n` +
        `   -> Re-include the volume in Datto BCDR backup settings and force a manual snapshot. Once resolved in Datto, BackupWatch will automatically close this ticket.`;

    try {
        const routing = await getAutotaskRoutingConfig();

        const ticketId = await createTicketInAutoTask({
            title: ticketTitle,
            description: ticketDescription,
            companyID: companyID,
            configurationItemID: configurationItemID,
            queueID: volConfig.queueId !== undefined ? volConfig.queueId : (routing.queueId !== undefined ? routing.queueId : (process.env.AUTOTASK_QUEUE_ID ? parseInt(process.env.AUTOTASK_QUEUE_ID) : undefined)),
            ticketCategory: volConfig.categoryId !== undefined ? volConfig.categoryId : (routing.categoryId !== undefined ? routing.categoryId : (process.env.AUTOTASK_CATEGORY_ID ? parseInt(process.env.AUTOTASK_CATEGORY_ID) : undefined)),
            priority: volConfig.priorityId !== undefined ? volConfig.priorityId : (routing.priorityId !== undefined ? routing.priorityId : 2),
            ticketType: process.env.AUTOTASK_TICKET_TYPE_ID ? parseInt(process.env.AUTOTASK_TICKET_TYPE_ID) : undefined,
            source: process.env.AUTOTASK_SOURCE_ID ? parseInt(process.env.AUTOTASK_SOURCE_ID) : undefined,
            allocationCodeID: volConfig.workTypeId !== undefined ? volConfig.workTypeId : (routing.workTypeId !== undefined ? routing.workTypeId : (process.env.AUTOTASK_WORK_TYPE_ID ? parseInt(process.env.AUTOTASK_WORK_TYPE_ID) : undefined)),
            issueType: volConfig.issueTypeId !== undefined ? volConfig.issueTypeId : (routing.issueTypeId !== undefined ? routing.issueTypeId : (process.env.AUTOTASK_ISSUE_TYPE_ID ? parseInt(process.env.AUTOTASK_ISSUE_TYPE_ID) : undefined)),
            subIssueType: volConfig.subIssueTypeId !== undefined ? volConfig.subIssueTypeId : (routing.subIssueTypeId !== undefined ? routing.subIssueTypeId : (process.env.AUTOTASK_SUB_ISSUE_TYPE_ID ? parseInt(process.env.AUTOTASK_SUB_ISSUE_TYPE_ID) : undefined))
        }, config, writeCtx);

        if (ticketId) {
            return {
                ticketId,
                companyID,
                configurationItemID
            };
        }
    } catch (err: any) {
        console.error(`[Autotask Ticket Fallback] Failed to create ticket:`, err.message || err);
    }

    return null;
}
