import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import axios from "axios";
import { getTableClient } from "../shared/tableService";
import { getAutoTaskConfig, getAutoTaskBaseUrl, getAutoTaskTicketUrl, getSingleTicketFromAutoTask, createTicketNoteInAutoTask, lookupConfigurationItemInAutoTask, lookupContractInAutoTask, getAutotaskCompanyName, pingAutotaskZone, queryTicketsInAutoTask, queryTicketByNumber, createComplianceTicket, getTicketStatusPicklistValues, getTicketFieldPicklistValues, updateTicketStatusInAutoTask, IPicklistValue } from "../shared/autotask";
import { runAsUserAction } from "../shared/autotaskGateway";
import { getScannerSuppression } from "../shared/autotaskPolicy";
import { normalizeVolumeName, buildVolumeTargetKey, isVolumeExcluded, isDeviceMuted, isDeviceSilenced, isAgentSilenced } from "../shared/volumeUtils";
import { requireAuthenticatedUser } from "../shared/auth";
import { getAutotaskRoutingConfig, saveAutotaskRoutingConfig, getGlobalMaintenanceMode, setGlobalMaintenanceMode, getAlertRoutingMatrix, saveAlertRoutingMatrix } from "../shared/configService";
import { APP_VERSION } from "../shared/version";
import { dattoSizeToGB, formatStorageGB } from "../shared/storageUnits";
import { withScanLock, waitForScanToFinish } from "../shared/scanLock";

// Stateless Global Variables for In-Memory Caching (Phase 2: Datto BCDR)
let cachedRawData: any = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // Strict 5-Minute Cache Window

/** Test hook: forget the in-memory dashboard copy. */
export function __resetDashboardCacheForTests(): void {
    cachedRawData = null;
    cacheTimestamp = 0;
}

export function getDattoCacheStats() {
    const now = Date.now();
    const ageMs = cachedRawData ? (now - cacheTimestamp) : 0;
    const isHit = cachedRawData && (ageMs < CACHE_TTL_MS);
    const ttlRemainingMs = isHit ? Math.max(0, CACHE_TTL_MS - ageMs) : 0;
    const deviceCount = cachedRawData && Array.isArray(cachedRawData) ? cachedRawData.length : 0;
    return {
        isCached: Boolean(isHit),
        ageSeconds: Math.round(ageMs / 1000),
        ttlRemainingSeconds: Math.round(ttlRemainingMs / 1000),
        cachedDeviceCount: deviceCount,
        lastCacheTime: cacheTimestamp ? new Date(cacheTimestamp).toISOString() : null
    };
}

interface IExclusionEntity {
    partitionKey: string;
    rowKey: string;
    type: "Device" | "Agent" | "Volume";
    target: string;
    reason: string;
    isPermanent?: boolean;
    expiresAt?: string | null;
    ticketNumber?: string | null;
    ticketUrl?: string | null;
    createdTime?: string;
}

interface ITrackedTicketEntity {
    partitionKey: string; // SerialNumber
    rowKey: string; // IssueKey
    ticketId: string;
    ticketNumber?: string;
    ticketUrl?: string;
    status?: string;
    lastSeenMessage?: string;
    createdTime?: string;
}

interface IAgentResult {
    name: string;
    status: 'Active' | 'Paused' | 'Archived' | 'Silenced';
    isPaused: boolean;
    isArchived: boolean;
    isSilenced?: boolean;
    excludedVolumes: { name: string; reason: string }[];
    excludedVolumesCount: number;
    protectedVolumeNames: string[];
    unprotectedVolumeNames?: string[];
    osName?: string;
    lastSnapshot?: string;
    lastBackupStatus?: {
        success: boolean;
        time?: number | string;
        errorMessage?: string;
    } | null;
    screenshotVerification?: {
        success: boolean;
        time?: number | string;
        image?: string;
    } | null;
    backupTicketReference?: {
        ticketId: string;
        ticketNumber?: string;
        ticketUrl?: string;
        status: string;
    } | null;
    screenshotTicketReference?: {
        ticketId: string;
        ticketNumber?: string;
        ticketUrl?: string;
        status: string;
    } | null;
    statusTicketReference?: {
        ticketId: string;
        ticketNumber?: string;
        ticketUrl?: string;
        status: string;
    } | null;
}

function formatLastBackup(asset: any): string {
    const val = asset.lastBackup || asset.lastSnapshot || asset.localSnapshotTime || asset.lastBackupTime;
    if (!val) {
        if (asset.lastBackupEpoch) {
            return new Date(asset.lastBackupEpoch * 1000).toLocaleString();
        }
        return "Unknown";
    }
    if (typeof val === 'number') {
        return new Date(val * 1000).toLocaleString();
    }
    return String(val);
}

function mapAutoTaskStatus(statusId: number): string {
    switch (statusId) {
        case 1: return "New";
        case 2: return "In Progress";
        case 3: return "Active";
        case 4: return "Waiting";
        case 5: return "Completed";
        default: return `Active (${statusId})`;
    }
}

function isApplianceActive(device: any): boolean {
    if (device.hidden) return false;
    const hasServicePeriod = device.servicePeriod && typeof device.servicePeriod === "string" && device.servicePeriod.trim() !== "";
    if (hasServicePeriod) {
        return new Date(device.servicePeriod).getTime() > Date.now();
    }
    // If servicePeriod is empty or missing (e.g. Infinite Cloud Retention), consider active if device checked in within 30 days
    const rawCheckin = device.lastCheckin ?? device.lastSeen ?? device.lastContact ?? device.lastSeenDate ?? null;
    if (rawCheckin) {
        let checkinMs: number | null = null;
        if (typeof rawCheckin === 'number') {
            checkinMs = rawCheckin > 1e11 ? rawCheckin : rawCheckin * 1000;
        } else {
            const parsed = Date.parse(rawCheckin);
            if (!isNaN(parsed)) checkinMs = parsed;
        }
        if (checkinMs) {
            return (Date.now() - checkinMs) < (30 * 24 * 3600 * 1000);
        }
    }
    return false;
}

/**
 * Posts the auto-heal note and stops tracking the ticket. Returns false (and changes nothing) when
 * Autotask writes for this appliance/agent are held back by a silence or change freeze (D-01/D-02),
 * so the note is posted on the first scan after the silence or freeze ends.
 */
export async function handleAutoHeal(
    tableClient: any,
    serialNumber: string,
    issueKey: string,
    ticketId: string,
    issueDetail: string,
    config: any,
    context: Context,
    target: { deviceName: string; agentName?: string; exclusions: IExclusionEntity[] }
): Promise<boolean> {
    const suppression = await getScannerSuppression(target.deviceName, target.agentName, target.exclusions);
    if (!suppression.allowed) {
        context.log.info(`Auto-heal for ticket #${ticketId} (${target.deviceName}${target.agentName ? ":" + target.agentName : ""}, ${issueKey}) held back: ${suppression.reason}. Ticket stays tracked.`);
        return false;
    }

    context.log.info(`Auto-healing ticket #${ticketId} for Serial=${serialNumber}, IssueKey=${issueKey}`);
    const ticketIdNum = parseInt(ticketId);
    if (!isNaN(ticketIdNum) && config) {
        await createTicketNoteInAutoTask(ticketIdNum, {
            title: "BackupWatch Auto-Heal Note",
            description: `[SUCCESS]: BackupWatch detected a successful completion or healthy status for this alert.\n\nDetails: ${issueDetail}\n\nThis ticket has been auto-healed, and future recurrences will log a new ticket.`
        }, config, { origin: "scanner", action: "Auto-heal note", deviceName: target.deviceName, agentName: target.agentName });
    }
    try {
        await tableClient.deleteEntity(serialNumber, issueKey);
        context.log.info(`Pruned auto-healed ticket #${ticketId} from table tracking.`);
    } catch (err: any) {
        context.log.error(`Failed to delete tracked ticket entity for Auto-Heal:`, err.message || err);
    }
    return true;
}

function applyExclusionsToDevices(devices: any[], exclusions: IExclusionEntity[]): any[] {
    return devices.map(d => {
        const deviceName = d.deviceName;
        const isSilencedDevice = isDeviceSilenced(exclusions, deviceName);

        // Deep/shallow copy agent and device objects so we don't mutate the cache
        const deviceCopy = {
            ...d,
            isSilenced: isSilencedDevice,
            agents: d.agents.map((a: any) => {
                const isSilencedAgent = isAgentSilenced(exclusions, deviceName, a.name);
                return {
                    ...a,
                    isSilenced: isSilencedAgent,
                    status: isSilencedAgent ? (a.isArchived ? 'Archived' : 'Silenced') : a.status,
                    excludedVolumes: [] as { name: string; reason: string }[]
                };
            })
        };

        // 1. Re-evaluate agent-level excluded volumes
        for (const agent of deviceCopy.agents) {
            const excludedVolumes: { name: string; reason: string }[] = [];
            const seenVolumes = new Set<string>();

            const rawProtected = agent.protectedVolumeNames || [];
            for (const volName of rawProtected) {
                const norm = normalizeVolumeName(volName);
                if (norm && !seenVolumes.has(norm)) {
                    const excl = isVolumeExcluded(exclusions, deviceName, agent.name, norm);
                    if (excl) {
                        seenVolumes.add(norm);
                        excludedVolumes.push({
                            name: norm,
                            reason: excl.reason || ""
                        });
                    }
                }
            }

            const rawUnprotected = agent.unprotectedVolumeNames || [];
            for (const volName of rawUnprotected) {
                const norm = normalizeVolumeName(volName);
                if (norm && !seenVolumes.has(norm)) {
                    seenVolumes.add(norm);
                    const excl = isVolumeExcluded(exclusions, deviceName, agent.name, norm);
                    excludedVolumes.push({
                        name: norm,
                        reason: excl ? (excl.reason || "") : ""
                    });
                }
            }

            agent.excludedVolumes = excludedVolumes;
            agent.excludedVolumesCount = (agent.isArchived || agent.isSilenced) ? 0 : excludedVolumes.length;
        }

        // 2. Re-calculate appliance exclusions count
        deviceCopy.applianceExclusionsCount = deviceCopy.agents
            .filter((a: any) => !a.isArchived && !a.isSilenced)
            .reduce((sum: number, a: any) => sum + a.excludedVolumesCount, 0);

        // 3. Find exclusions matching this device
        const deviceExclusion = exclusions.find(
            e => e.type === "Device" && e.target.toLowerCase() === deviceName.toLowerCase()
        );

        const volumeExclusions = exclusions.filter(
            e => e.type === "Volume" && e.target.toLowerCase().startsWith(`${deviceName.toLowerCase()}:`)
        );

        // 4. Re-determine backup status
        const isBackupSuccess = (deviceCopy.alertCount === 0);
        let backupStatus: 'Success' | 'Failed' | 'Muted' = isBackupSuccess ? "Success" : "Failed";
        let requiresAction = !isBackupSuccess;
        let exclusionReason: string | null = null;

        if (deviceCopy.isSilenced) {
            backupStatus = "Muted";
            requiresAction = false;
            exclusionReason = "Appliance is Silenced by administrator.";
        } else if (deviceExclusion) {
            backupStatus = "Muted";
            requiresAction = false;
            exclusionReason = deviceExclusion.reason || "Device alert muted by administrator.";
        } else if (volumeExclusions.length > 0) {
            backupStatus = "Muted";
            requiresAction = false;
            exclusionReason = `Muted volumes: ${volumeExclusions.map(v => {
                const parts = v.target.split(":");
                if (parts.length >= 3) {
                    return `${parts[1]} (${parts[2]})`;
                }
                return parts[1] || "unknown";
            }).join(", ")}`;
        }

        deviceCopy.backupStatus = backupStatus;
        deviceCopy.requiresAction = requiresAction;
        deviceCopy.exclusionReason = exclusionReason;

        return deviceCopy;
    });
}

/**
 * Builds the dashboard data.
 *
 * `isScan` true (timer scan or Force Scan, run under the scan lock): the only mode that writes – exclusion sweep,
 * compliance tickets, auto-heal notes, TrackedTickets pruning.
 * `isScan` false (someone opening the dashboard): read-only (BW-023, D-08) – the same Datto and Autotask reads, the
 * same information on screen (D-07), but nothing is written to Autotask or to the Exclusions/TrackedTickets tables.
 */
export async function runPipeline(context: Context, forceRefresh: boolean, isScan: boolean = false): Promise<any> {
    const currentTime = Date.now();

    // Check Cache Validity
    if (!forceRefresh && cachedRawData && (currentTime - cacheTimestamp < CACHE_TTL_MS)) {
        // Fetch active exclusions from Azure Table Storage and apply them to cachedRawData
        let exclusions: IExclusionEntity[] = [];
        try {
            const tableClient = await getTableClient("Exclusions");
            const entities = tableClient.listEntities<IExclusionEntity>();
            for await (const entity of entities) {
                exclusions.push(entity);
            }
        } catch (tableErr: any) {
            context.log.warn("Failed to fetch exclusions for cache HIT: ", tableErr.message || tableErr);
        }

        let scanStatus: any = null;
        try {
            const statusTableClient = await getTableClient("ScanStatus");
            scanStatus = await statusTableClient.getEntity("Status", "BCDRScanner");
        } catch (statusErr: any) { }

        let maintMode: any = null;
        try {
            maintMode = await getGlobalMaintenanceMode();
        } catch { }

        const mappedDevices = applyExclusionsToDevices(cachedRawData, exclusions);
        return {
            appVersion: APP_VERSION,
            devices: mappedDevices,
            maintenanceMode: maintMode,
            scanStatus: scanStatus ? {
                lastScan: scanStatus.lastScan,
                nextScan: scanStatus.nextScan,
                status: scanStatus.status,
                errorMessage: scanStatus.errorMessage
            } : null,
            cacheStatus: "HIT"
        };
    }

    const dattoKey = process.env.DATTO_KEY;

    if (!dattoKey || dattoKey === "YOUR_DATTO_API_KEY_HERE") {
        throw new Error("Datto BCDR API key is not configured in environment settings.");
    }

    // Construct Basic Authentication Header
    let authHeader = '';
    if (dattoKey.includes(':')) {
        const encoded = Buffer.from(dattoKey).toString('base64');
        authHeader = `Basic ${encoded}`;
    } else {
        const encoded = Buffer.from(`${dattoKey}:`).toString('base64');
        authHeader = `Basic ${encoded}`;
    }

    // Fetch active exclusions from Azure Table Storage
    let exclusions: IExclusionEntity[] = [];
    let exclusionsLoadFailed = false;
    try {
        const tableClient = await getTableClient("Exclusions");
        const entities = tableClient.listEntities<IExclusionEntity>();
        for await (const entity of entities) {
            exclusions.push(entity);
        }
    } catch (tableErr: any) {
        exclusionsLoadFailed = true;
        context.log.warn("Failed to fetch exclusions from Table Storage: ", tableErr.message || tableErr);
    }

    // Fetch active tracked tickets from Azure Table Storage and sync with AutoTask
    let trackedTickets: ITrackedTicketEntity[] = [];
    let ticketsTableClient: any = null;
    const autotaskConfig = getAutoTaskConfig();

    if (autotaskConfig && isScan) {
        // Log & persist live Autotask status picklist mapping for verification
        try {
            const statusPicklists = await getTicketStatusPicklistValues(autotaskConfig);
            context.log.info("[AUTOTASK STATUS PICKLIST PROOF]", JSON.stringify(statusPicklists));
            if (statusPicklists && statusPicklists.length > 0) {
                try {
                    const statusTableClient = await getTableClient("ScanStatus");
                    await statusTableClient.upsertEntity({
                        partitionKey: "Status",
                        rowKey: "AutotaskPicklistProof",
                        picklistsJson: JSON.stringify(statusPicklists),
                        updatedTime: new Date().toISOString()
                    }, "Replace");
                } catch (saveErr: any) { }
            }
        } catch (pErr: any) {
            context.log.warn("[AUTOTASK STATUS PICKLIST PROOF ERROR]", pErr.message || pErr);
        }
    }

    if (autotaskConfig && !exclusionsLoadFailed) {
        try {
            ticketsTableClient = await getTableClient("TrackedTickets");
            const entities = ticketsTableClient.listEntities();
            const allTracked: ITrackedTicketEntity[] = [];
            for await (const entity of entities) {
                allTracked.push(entity);
            }

            if (allTracked.length > 0) {
                const ticketIds = allTracked.map(t => parseInt(t.ticketId)).filter(id => !isNaN(id));
                if (ticketIds.length > 0) {
                    const autotaskTicketMap = new Map<number, any>();
                    // Batch ticket queries in chunks of 20 to eliminate concurrent API thread spikes
                    const TICKET_CHUNK_SIZE = 20;
                    for (let i = 0; i < ticketIds.length; i += TICKET_CHUNK_SIZE) {
                        const chunk = ticketIds.slice(i, i + TICKET_CHUNK_SIZE);
                        try {
                            const chunkResults = await queryTicketsInAutoTask(chunk, autotaskConfig);
                            if (chunkResults && Array.isArray(chunkResults)) {
                                for (const t of chunkResults) {
                                    if (t && t.id) {
                                        autotaskTicketMap.set(t.id, t);
                                    }
                                }
                            }
                        } catch (batchErr: any) {
                            context.log.warn(`[TrackedTickets] Batch query failed for chunk [${chunk.join(",")}]: ${batchErr.message || batchErr}`);
                        }
                        if (i + TICKET_CHUNK_SIZE < ticketIds.length) {
                            await new Promise(r => setTimeout(r, 100));
                        }
                    }

                    // Resolve zone-based ticket URL prefix
                    let resolvedBaseUrl = "";
                    try {
                        resolvedBaseUrl = await getAutoTaskBaseUrl(autotaskConfig.user);
                    } catch (e: any) {
                        context.log.warn("Could not resolve Autotask base URL for ticket links.");
                    }

                    // Sync statuses and prune completed tickets
                    for (const t of allTracked) {
                        const parsedId = parseInt(t.ticketId);
                        const atTicket = autotaskTicketMap.get(parsedId);

                        if (atTicket) {
                            if (atTicket.status === 5) {
                                // Ticket is completed: not shown. A scan also deletes the tracking record.
                                if (isScan) {
                                    await ticketsTableClient.deleteEntity(t.partitionKey, t.rowKey);
                                    context.log.info(`Deleted completed ticket reference from Table Storage: Serial=${t.partitionKey}, Issue=${t.rowKey}, TicketID=${t.ticketId}`);
                                }
                            } else {
                                // Update ticket status in memory
                                t.status = mapAutoTaskStatus(atTicket.status);
                                // Enrich with ticketNumber and ticketUrl if not already set
                                if (atTicket.ticketNumber && !t.ticketNumber) {
                                    t.ticketNumber = atTicket.ticketNumber;
                                }
                                if (resolvedBaseUrl && !t.ticketUrl) {
                                    t.ticketUrl = getAutoTaskTicketUrl(resolvedBaseUrl, parsedId);
                                }
                                trackedTickets.push(t);
                            }
                        } else {
                            // If the ticket wasn't found in AutoTask, keep it as Active for safety, or we could prune. Default to keeping.
                            t.status = "Active";
                            trackedTickets.push(t);
                        }
                    }
                }
            }
        } catch (ticketTableErr: any) {
            context.log.warn("Failed to fetch/sync tracked tickets: ", ticketTableErr.message || ticketTableErr);
        }
    }

    // Fetch from Datto BCDR REST API (fetching page 1 with 250 items to get all devices in one call)
    const bcdrResponse = await axios.get("https://api.datto.com/v1/bcdr/device?_page=1&_perPage=250", {
        headers: {
            "Authorization": authHeader
        },
        timeout: 30000 // 30 seconds timeout
    });

    const rawDevices = (bcdrResponse.data && bcdrResponse.data.items) || [];

    // Concurrently fetch assets/agents for ALL devices
    const devices = await Promise.all(rawDevices.map(async (device: any) => {
        let assets: any[] = [];
        try {
            const assetResponse = await axios.get(`https://api.datto.com/v1/bcdr/device/${device.serialNumber}/asset`, {
                headers: {
                    "Authorization": authHeader
                },
                timeout: 15000 // 15 seconds per asset fetch
            });
            assets = assetResponse.data || [];
        } catch (assetErr: any) {
            context.log.warn(`Failed to fetch assets/agents for device ${device.name}: ${assetErr.message || assetErr}`);
        }
        return {
            ...device,
            assets
        };
    }));

    // -----------------------------------------------------------------------------------------
    // Volume Exclusions Reconciliation Sweep (Autotask Sync, Auto-Heal, & Closed Ticket Lifecycle)
    // -----------------------------------------------------------------------------------------
    if (isScan && autotaskConfig && !exclusionsLoadFailed && exclusions.length > 0) {
        try {
            const exclusionsTableClient = await getTableClient("Exclusions");
            const nowMs = Date.now();

            // Process exclusions sequentially (1 thread at a time with 100ms pacing) to strictly adhere to Autotask 3-thread limit
            const exclusionList = [...exclusions];
            for (const e of exclusionList) {
                // If this record was already purged during a twin cleanup earlier in this pass, skip
                if (!exclusions.some(item => item.rowKey === e.rowKey)) continue;

                if (e.type !== "Volume") continue;

                // An exclusion is considered Permanent ONLY if explicitly marked isPermanent === true
                const isPerm = Boolean(e.isPermanent);
                const expiresAtMs = e.expiresAt ? new Date(e.expiresAt).getTime() : null;
                const isExpired = !isPerm && expiresAtMs !== null && expiresAtMs <= nowMs;

                // Parse target parts: devName:agentName:volumeName
                const targetParts = (e.target || "").split(":");
                const devName = targetParts[0] || "Unknown Device";
                const agentName = targetParts[1] || "";
                const volName = normalizeVolumeName(targetParts.slice(2).join(":"));

                if (!devName || !agentName || !volName) continue;

                // If a Permanent Exclusion already exists for this canonical volume on this agent,
                // suppress any action on this redundant/temporary record and purge it.
                if (!isPerm) {
                    const hasPermTwin = exclusions.some(other => 
                        other.rowKey !== e.rowKey &&
                        other.type === "Volume" &&
                        Boolean(other.isPermanent) &&
                        isVolumeExcluded([other], devName, agentName, volName) !== undefined
                    );
                    if (hasPermTwin) {
                        context.log.info(`[Exclusion Sweep] Silently purging redundant temporary record ${e.rowKey} because a Permanent Exclusion exists for ${devName}:${agentName}:${volName}.`);
                        try {
                            await exclusionsTableClient.deleteEntity(e.partitionKey, e.rowKey);
                            const delIdx = exclusions.findIndex(item => item.rowKey === e.rowKey);
                            if (delIdx > -1) exclusions.splice(delIdx, 1);
                        } catch (pErr) { }
                        continue;
                    }
                }

                // Silence / change freeze (D-01, D-02): leave this exclusion untouched until writes are allowed again
                const sweepSuppression = await getScannerSuppression(devName, agentName, exclusions);
                if (!sweepSuppression.allowed) {
                    context.log.info(`[Exclusion Sweep] Skipping ${e.rowKey}: ${sweepSuppression.reason}.`);
                    continue;
                }

                // Locate the matching device and asset in live Datto BCDR inventory
                const matchedDevice = devices.find((d: any) => 
                    (d.name && d.name.toLowerCase() === devName.toLowerCase()) || 
                    (d.serialNumber && d.serialNumber.toLowerCase() === devName.toLowerCase())
                );
                const matchedAsset = matchedDevice && matchedDevice.assets ? 
                    matchedDevice.assets.find((a: any) => 
                        (a.name && a.name.toLowerCase() === agentName.toLowerCase()) || 
                        (a.hostname && a.hostname.toLowerCase() === agentName.toLowerCase())
                    ) : null;

                // If device or asset cannot be found or is archived/inactive, skip auto-heal/reopen to prevent false actions
                if (!matchedDevice || !matchedAsset || matchedAsset.isArchived) continue;

                // Check live Datto protection status for this volume
                const rawUnprotected = matchedAsset.unprotectedVolumeNames || [];
                const isVolumeStillUnprotected = rawUnprotected.some((uv: string) => normalizeVolumeName(uv) === volName);

                // Resolve Autotask numeric Ticket ID
                const match = e.ticketUrl ? e.ticketUrl.match(/ticketId=(\d+)/) : null;
                let ticketIdNum: number | null = match ? parseInt(match[1]) : (!isNaN(parseInt(e.ticketNumber || "", 10)) && !(e.ticketNumber || "").startsWith("T") ? parseInt(e.ticketNumber || "", 10) : null);

                if (!ticketIdNum && e.ticketNumber && e.ticketNumber !== "[OVERRIDE: EMERGENCY OUTAGE]") {
                    try {
                        const atTicket = await queryTicketByNumber(e.ticketNumber, autotaskConfig);
                        if (atTicket) {
                            ticketIdNum = atTicket.id;
                            // Persist resolved ticket URL to Table Storage so future scans skip queryTicketByNumber
                            try {
                                const baseUrl = await getAutoTaskBaseUrl(autotaskConfig.user);
                                const ticketUrl = getAutoTaskTicketUrl(baseUrl, ticketIdNum);
                                await exclusionsTableClient.upsertEntity({
                                    partitionKey: e.partitionKey,
                                    rowKey: e.rowKey,
                                    ticketUrl: ticketUrl
                                }, "Merge");
                                e.ticketUrl = ticketUrl;
                            } catch (saveIdErr: any) {
                                context.log.warn(`[Exclusion Sweep] Failed to persist resolved ticket URL for ${e.rowKey}: ${saveIdErr.message || saveIdErr}`);
                            }
                        }
                    } catch (lookupErr: any) {
                        context.log.warn(`[Exclusion Sweep] Failed to resolve ticket ID for ticketNumber ${e.ticketNumber}: ${lookupErr.message}`);
                    }
                }

                if (!ticketIdNum) continue;

                let atTicket: any = null;
                try {
                    atTicket = await getSingleTicketFromAutoTask(ticketIdNum, autotaskConfig);
                } catch (tErr: any) {
                    context.log.warn(`[Exclusion Sweep] Could not fetch ticket #${ticketIdNum} from Autotask: ${tErr.message}`);
                    continue;
                }
                if (!atTicket) continue;

                const isTicketClosed = (atTicket.status === 5); // 5 = Completed (Closed in Autotask)

                // =========================================================================
                // CASE 1: Volume is STILL UNPROTECTED in Datto BCDR
                // =========================================================================
                if (isVolumeStillUnprotected) {
                    if (isTicketClosed) {
                        // Ticket was closed, but the exclusion is STILL live in Datto!
                        // For Temporary/Unconfigured exclusions: Open a new ticket & reset exclusion
                        if (!isPerm) {
                            context.log.info(`[Ticket Closed while Live in Datto] Target=${e.target}, ClosedTicketID=${ticketIdNum}. Opening follow-up compliance ticket...`);

                            // 1. Delete old exclusion record from Table Storage
                            await exclusionsTableClient.deleteEntity(e.partitionKey, e.rowKey);

                            // 2. Open brand new follow-up compliance ticket
                            const newTicket = await createComplianceTicket({
                                deviceName: devName,
                                agentName: agentName,
                                volumeName: volName,
                                reason: `[RE-OPENED COMPLIANCE TICKET] Previous Ticket #${atTicket.ticketNumber || ticketIdNum} was closed, but volume [${volName}] remains unprotected in Datto BCDR. Live compliance monitoring has re-engaged.`,
                                serialNumber: matchedDevice.serialNumber || devName,
                                clientCompanyName: matchedDevice.clientCompanyName || matchedDevice.organizationName
                            }, autotaskConfig, { origin: "scanner", action: "Re-raised compliance ticket" });

                            let newTicketNumber = String(ticketIdNum);
                            let newTicketUrl = e.ticketUrl;

                            if (newTicket) {
                                newTicketNumber = String(newTicket.ticketId);
                                try {
                                    const baseUrl = await getAutoTaskBaseUrl(autotaskConfig.user);
                                    newTicketUrl = getAutoTaskTicketUrl(baseUrl, newTicket.ticketId);
                                    const fetchedTicket = await getSingleTicketFromAutoTask(newTicket.ticketId, autotaskConfig);
                                    if (fetchedTicket && fetchedTicket.ticketNumber) {
                                        newTicketNumber = fetchedTicket.ticketNumber;
                                    }
                                } catch (uErr: any) {
                                    context.log.warn(`[Exclusion Sweep] Could not resolve new ticket URL: ${uErr.message}`);
                                }
                            }

                            // 3. Upsert fresh exclusion record in Table Storage
                            const expiresAtDate = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
                            const newEntity = {
                                ...e,
                                expiresAt: expiresAtDate,
                                ticketNumber: newTicketNumber,
                                ticketUrl: newTicketUrl,
                                createdTime: new Date().toISOString()
                            };
                            await exclusionsTableClient.upsertEntity(newEntity, "Replace");

                            // 4. Update memory array so downstream loops see the new ticket
                            const idx = exclusions.findIndex(item => item.rowKey === e.rowKey);
                            if (idx > -1) {
                                exclusions[idx] = newEntity;
                            } else {
                                exclusions.push(newEntity);
                            }

                            // 5. Write audit log
                            try {
                                const auditTableClient = await getTableClient("AuditLogs");
                                await auditTableClient.createEntity({
                                    partitionKey: "AuditLog",
                                    rowKey: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                                    userEmail: "system@fifosys.com",
                                    action: "Re-raised Volume Exclusion Ticket",
                                    target: e.target || e.rowKey,
                                    details: `Ticket #${atTicket.ticketNumber || ticketIdNum} was closed while volume remained unprotected in Datto. Replaced with Ticket #${newTicketNumber}.`,
                                    createdTime: new Date().toISOString()
                                });
                            } catch (auditErr: any) {
                                context.log.error("Failed to write audit log:", auditErr.message || auditErr);
                            }
                        }
                    } else {
                        // Ticket is STILL OPEN: check if temporary deadline has expired
                        if (isExpired) {
                            const newExpiresAt = new Date(nowMs + 24 * 3600 * 1000).toISOString();
                            const noteTitle = "[ACTION REQUIRED] TEMPORARY EXCLUSION EXPIRED";
                            const noteDesc = `[ACTION REQUIRED] TEMPORARY EXCLUSION EXPIRED\n` +
                                `Volume: [${volName}] on server [${devName}]\n\n` +
                                `Details: The temporary exclusion period for this volume has expired.\n\n` +
                                `Action Required:\n` +
                                `1. If backup issue is fixed: Re-include the volume in Datto backups, remove the exclusion note in the BackupWatch Dashboard, and close this ticket.\n` +
                                `2. If troubleshooting is still ongoing: Extend the temporary duration in the BackupWatch Dashboard.\n` +
                                `3. If volume should never be backed up: Change the exclusion policy to Permanent Exclusion in the BackupWatch Dashboard.\n\n` +
                                `(Note: Exclusion deadline auto-extended by 24 hours to allow review)`;

                            await createTicketNoteInAutoTask(ticketIdNum, {
                                title: noteTitle,
                                description: noteDesc
                            }, autotaskConfig, { origin: "scanner", action: "Exclusion expiry note", deviceName: devName, agentName });

                            // Update ticket status to Action Required
                            try {
                                const statusPicklists = await getTicketStatusPicklistValues(autotaskConfig);
                                const actionReqField = statusPicklists.find(p => p.label && p.label.toLowerCase().includes("action required"));
                                const targetStatusId = actionReqField ? actionReqField.value : (process.env.AUTOTASK_ACTION_REQUIRED_STATUS_ID ? parseInt(process.env.AUTOTASK_ACTION_REQUIRED_STATUS_ID, 10) : 8);

                                const statusUpdated = await updateTicketStatusInAutoTask(ticketIdNum, targetStatusId, autotaskConfig, { origin: "scanner", action: "Exclusion expiry status change", deviceName: devName, agentName });
                                if (statusUpdated) {
                                    context.log.info(`Successfully updated ticket #${ticketIdNum} status to Action Required (StatusID=${targetStatusId}).`);
                                }
                            } catch (statusErr: any) {
                                context.log.warn(`Could not update ticket status for #${ticketIdNum}:`, statusErr.message || statusErr);
                            }

                            // Update entity in Table Storage with new +24h expiry
                            const updatedEntity = {
                                ...e,
                                expiresAt: newExpiresAt
                            };
                            await exclusionsTableClient.upsertEntity(updatedEntity, "Replace");
                            e.expiresAt = newExpiresAt;
                            context.log.info(`Posted expiry reminder note to open ticket #${ticketIdNum} and extended deadline by 24 hours.`);
                        }
                    }
                }

                // =========================================================================
                // CASE 2: Volume has been RESOLVED in Datto BCDR (Re-included in Backups)
                // =========================================================================
                if (!isVolumeStillUnprotected) {
                    context.log.info(`[Volume Exclusion Auto-Heal] Volume ${volName} on ${devName}:${agentName} is now protected in Datto BCDR.`);

                    // If ticket is still open, post auto-heal resolution note (Do NOT close ticket; engineers close tickets)
                    if (!isTicketClosed) {
                        const ukTimeStr = new Date().toLocaleString("en-GB", { timeZone: "Europe/London" });
                        const noteTitle = `[AUTO-HEAL] Volume Re-included in Backups - ${volName}`;
                        const noteDesc = `[RESOLUTION CONFIRMED - AUTO-HEAL]\n\n` +
                            `Appliance:  ${devName} (${matchedDevice.serialNumber || "N/A"})\n` +
                            `Agent:      ${agentName}\n` +
                            `Volume:     ${volName}\n` +
                            `Timestamp:  ${ukTimeStr}\n\n` +
                            `Details:\n` +
                            `BackupWatch has verified that volume [${volName}] is now actively protected and included in backup snapshots on Datto BCDR.\n\n` +
                            `Actions Taken by BackupWatch:\n` +
                            `1. Removed the exclusion tracking record from the database.\n` +
                            `2. Restored live compliance monitoring on the BackupWatch Dashboard.\n` +
                            `3. This ticket remains OPEN per engineering policy.\n\n` +
                            `Engineer Next Steps:\n` +
                            `• Verify that the latest snapshot for ${agentName} completed successfully with all expected volumes.\n` +
                            `• Complete any required worklog/service notes and close this ticket when satisfied.`;

                        await createTicketNoteInAutoTask(ticketIdNum, {
                            title: noteTitle,
                            description: noteDesc
                        }, autotaskConfig, { origin: "scanner", action: "Volume auto-heal note", deviceName: devName, agentName });
                    }

                    // 1. Delete exclusion record from Table Storage
                    await exclusionsTableClient.deleteEntity(e.partitionKey, e.rowKey);

                    // 2. Remove from memory so dashboard immediately reports healthy
                    const idx = exclusions.findIndex(item => item.rowKey === e.rowKey);
                    if (idx > -1) exclusions.splice(idx, 1);

                    // 3. Write audit log
                    try {
                        const auditTableClient = await getTableClient("AuditLogs");
                        await auditTableClient.createEntity({
                            partitionKey: "AuditLog",
                            rowKey: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                            userEmail: "system@fifosys.com",
                            action: "Auto-Heal Volume Exclusion (Resolved in Datto)",
                            target: e.target || e.rowKey,
                            details: `Volume [${volName}] on ${devName}:${agentName} detected as protected in Datto BCDR. Posted auto-heal note to Ticket #${atTicket.ticketNumber || ticketIdNum} and removed exclusion record.`,
                            createdTime: new Date().toISOString()
                        });
                    } catch (auditErr: any) {
                        context.log.error("Failed to write auto-heal audit log:", auditErr.message || auditErr);
                    }
                }

                // Controlled inter-request pause (100ms) to ensure zero concurrency pressure on Autotask API
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (syncErr: any) {
            context.log.error("Failed during volume exclusions Autotask sync/auto-heal sweep:", syncErr.message || syncErr);
        }
    }

    // Process new native exclusions sequentially for all Active Appliances (isActive === true)
    if (isScan && !exclusionsLoadFailed) {
        for (const d of devices) {
            // Skip raising tickets for cancelled/inactive appliances (d.isActive === false)
            const isActive = isApplianceActive(d);
            if (!isActive) continue;

            const devName = d.name || "Unknown Device";

            // Skip raising tickets if the whole appliance is silenced
            if (isDeviceSilenced(exclusions, devName)) {
                context.log.info(`[Auto-Ticket Native Exclusion] Skipping appliance ${devName} because appliance is silenced.`);
                continue;
            }

            for (const asset of (d.assets || [])) {
                if (asset.isArchived) continue; // Never ticket archived agents

                const name = asset.name || asset.hostname || "Unknown Agent";

                // Skip raising tickets if the specific agent is silenced
                if (isAgentSilenced(exclusions, devName, name)) {
                    context.log.info(`[Auto-Ticket Native Exclusion] Skipping agent ${devName}:${name} because agent is silenced.`);
                    continue;
                }

                const rawUnprotected = asset.unprotectedVolumeNames || [];
                const uniqueNormalizedVolumes: string[] = Array.from(
                    new Set<string>(rawUnprotected.map((v: string) => normalizeVolumeName(v)).filter(Boolean))
                );

                for (const normalizedVol of uniqueNormalizedVolumes) {
                    const excl = isVolumeExcluded(exclusions, devName, name, normalizedVol);
                    if (!excl) {
                        context.log.info(`[Auto-Ticket Native Exclusion] Sequential processing: ${devName}:${name}:${normalizedVol}`);

                        let ticketNumber: string | null = null;
                        let ticketUrl: string | null = null;
                        let ticketLogged = false;

                        if (autotaskConfig) {
                            const ticketObj = await createComplianceTicket({
                                deviceName: devName,
                                agentName: name,
                                volumeName: normalizedVol,
                                reason: "",
                                serialNumber: d.serialNumber,
                                clientCompanyName: d.clientCompanyName || d.organizationName
                            }, autotaskConfig, { origin: "scanner", action: "Volume compliance ticket" });

                            if (ticketObj) {
                                ticketLogged = true;
                                ticketNumber = String(ticketObj.ticketId);
                                try {
                                    const baseUrl = await getAutoTaskBaseUrl(autotaskConfig.user);
                                    ticketUrl = getAutoTaskTicketUrl(baseUrl, ticketObj.ticketId);
                                    const atTicket = await getSingleTicketFromAutoTask(ticketObj.ticketId, autotaskConfig);
                                    if (atTicket && atTicket.ticketNumber) {
                                        ticketNumber = atTicket.ticketNumber;
                                    }
                                } catch (urlErr: any) {
                                    context.log.warn(`[Auto-Ticket Native Exclusion] Failed to resolve ticket details: ${urlErr.message}`);
                                }
                            }
                        }

                        // Only save to database if a ticket was successfully logged
                        if (ticketLogged) {
                            const rowKey = encodeURIComponent(`Volume:${devName}:${name}:${normalizedVol}`);
                            const expiresAtDate = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
                            const newExclEntity = {
                                partitionKey: "Exclusion",
                                rowKey: rowKey,
                                type: "Volume" as const,
                                target: `${devName}:${name}:${normalizedVol}`,
                                reason: "",
                                isPermanent: false,
                                isUnconfigured: true,
                                expiresAt: expiresAtDate,
                                ticketNumber: ticketNumber,
                                ticketUrl: ticketUrl,
                                createdTime: new Date().toISOString()
                            };

                            try {
                                const exclusionsTableClient = await getTableClient("Exclusions");
                                await exclusionsTableClient.upsertEntity(newExclEntity, "Replace");
                                exclusions.push(newExclEntity);
                            } catch (saveErr: any) {
                                context.log.error(`[Auto-Ticket Native Exclusion] Failed to save exclusion entity: ${saveErr.message}`);
                            }
                        } else {
                            context.log.warn(`[Auto-Ticket Native Exclusion] Skipping Table Storage persistence for ${devName}:${name}:${normalizedVol} because ticket creation failed or was skipped.`);
                        }
                    }
                }
            }
        }
    } else {
        if (exclusionsLoadFailed) {
            context.log.warn("[Auto-Ticket Native Exclusion] Skipping automatic ticketing because Exclusions Table failed to load.");
        } else {
            context.log.info("[Auto-Ticket Native Exclusion] Skipping automatic ticketing: dashboard loads are read-only (BW-023).");
        }
    }

    // Auto-heal notes are a write: only a scan posts them. On a dashboard load the ticket stays shown until the next scan.
    const healClient = isScan ? ticketsTableClient : null;

    // In-Memory Processing, Aggregation, and Muting
    const processedData = await Promise.all(devices.map(async (device: any) => {
        // Datto reports { size, units } (units "KB" on every appliance) – convert by unit (BW-024)
        const usedGBRaw = dattoSizeToGB(device.localStorageUsed);
        const totalGBRaw = usedGBRaw + dattoSizeToGB(device.localStorageAvailable);
        const storageUsedPercent = totalGBRaw > 0 ? (usedGBRaw / totalGBRaw) * 100 : 0;

        const usedStorageGB = parseFloat(usedGBRaw.toFixed(2));
        const totalStorageGB = parseFloat(totalGBRaw.toFixed(2));

        const deviceName = device.name || "Unknown Device";
        const serialNumber = device.serialNumber || "Unknown Serial";

        // Find tracked tickets for this appliance
        const deviceTickets = trackedTickets.filter(t => t.partitionKey === serialNumber);

        // Auto-heal check for storage alerts
        let storageTicket = deviceTickets.find(t => t.rowKey === "storage");
        if (storageTicket && storageUsedPercent <= 85 && healClient &&
            await handleAutoHeal(healClient, serialNumber, "storage", storageTicket.ticketId, `Appliance storage usage has cleared. Used: ${formatStorageGB(usedStorageGB)} of ${formatStorageGB(totalStorageGB)} (${storageUsedPercent.toFixed(1)}%).`, autotaskConfig, context, { deviceName, exclusions })) {
            const index = deviceTickets.indexOf(storageTicket);
            if (index > -1) deviceTickets.splice(index, 1);
            storageTicket = undefined;
        }

        // Auto-heal check for device offline (heartbeat)
        let offlineTicket = deviceTickets.find(t => t.rowKey === "offline");
        let lastCheckinVal: number | null = null;
        const rawCheckin = device.lastCheckin ?? device.lastSeen ?? device.lastContact ?? device.lastSeenDate ?? null;
        if (rawCheckin) {
            if (typeof rawCheckin === 'number') {
                lastCheckinVal = rawCheckin;
            } else {
                const parsed = Date.parse(rawCheckin);
                if (!isNaN(parsed)) {
                    lastCheckinVal = Math.floor(parsed / 1000);
                }
            }
        }
        const isDeviceOffline = lastCheckinVal ? (Date.now() / 1000 - lastCheckinVal > 3600) : false; // 1hr threshold
        if (offlineTicket && !isDeviceOffline && healClient &&
            await handleAutoHeal(healClient, serialNumber, "offline", offlineTicket.ticketId, `Appliance checkin has resolved. Last checkin: ${lastCheckinVal ? new Date(lastCheckinVal * 1000).toLocaleString() : "N/A"}.`, autotaskConfig, context, { deviceName, exclusions })) {
            const index = deviceTickets.indexOf(offlineTicket);
            if (index > -1) deviceTickets.splice(index, 1);
            offlineTicket = undefined;
        }

        const isApplianceSilenced = isDeviceSilenced(exclusions, deviceName);

        // Process agents
        const agents: IAgentResult[] = [];
        for (const asset of (device.assets || [])) {
            const name = asset.name || asset.hostname || "Unknown Agent";
            const isPaused = !!asset.isPaused;
            const isArchived = !!asset.isArchived;
            const isSilenced = isAgentSilenced(exclusions, deviceName, name);
            const status = isArchived ? 'Archived' : (isSilenced ? 'Silenced' : (isPaused ? 'Paused' : 'Active'));
            // Deduplicate and normalize volumes for UI mapping
            const protectedVolumeNames: string[] = Array.from(new Set<string>((asset.protectedVolumeNames || []).map((v: string) => normalizeVolumeName(v)).filter(Boolean)));
            const unprotectedVolumeNames: string[] = Array.from(new Set<string>((asset.unprotectedVolumeNames || []).map((v: string) => normalizeVolumeName(v)).filter(Boolean)));

            // Find excluded volumes
            const excludedVolumes: { name: string; reason: string }[] = [];
            const seenExcluded = new Set<string>();

            for (const volName of protectedVolumeNames) {
                const excl = isVolumeExcluded(exclusions, deviceName, name, volName);
                if (excl && !seenExcluded.has(volName)) {
                    seenExcluded.add(volName);
                    excludedVolumes.push({
                        name: volName,
                        reason: excl.reason || ""
                    });
                }
            }
            for (const volName of unprotectedVolumeNames) {
                const excl = isVolumeExcluded(exclusions, deviceName, name, volName);
                if (!seenExcluded.has(volName)) {
                    seenExcluded.add(volName);
                    excludedVolumes.push({
                        name: volName,
                        reason: excl ? (excl.reason || "") : ""
                    });
                }
            }

            const excludedVolumesCount = (isArchived || isSilenced) ? 0 : excludedVolumes.length;

            // Find agent-level tickets (preserve references so tickets remain visible on dashboard)
            let backupTicket = deviceTickets.find(t => t.rowKey === `agent:${name}:backup`);
            let screenshotTicket = deviceTickets.find(t => t.rowKey === `agent:${name}:screenshot`);
            let statusTicket = deviceTickets.find(t => t.rowKey === `agent:${name}:paused` || t.rowKey === `agent:${name}:archived`);

            // Map backup status details
            let latestBackupSuccess = true;
            let lastBackupTimeStr = "";
            let lastBackupErrorMsg = "";
            if (asset.backups && Array.isArray(asset.backups) && asset.backups.length > 0) {
                const latest = [...asset.backups].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                if (latest && latest.backup) {
                    latestBackupSuccess = latest.backup.status === 'success';
                    lastBackupTimeStr = latest.timestamp ? new Date(latest.timestamp).toLocaleString() : "";
                    lastBackupErrorMsg = latest.backup.errorMessage || "";
                }
            }

            // Map screenshot details
            const screenshotVerification = asset.screenshotVerification || (asset.lastScreenshotUrl ? {
                success: !!asset.lastScreenshotAttemptStatus,
                time: asset.lastScreenshotAttempt,
                image: asset.lastScreenshotUrl
            } : (asset.lastScreenshot ? {
                success: asset.lastScreenshot.success,
                time: asset.lastScreenshot.time,
                image: asset.lastScreenshot.image || asset.lastScreenshot.url
            } : null));

            const latestScreenshotSuccess = screenshotVerification ? screenshotVerification.success : true;

            // Auto-heal agent backup (skip if agent or appliance is silenced)
            if (!isSilenced && !isApplianceSilenced && backupTicket && latestBackupSuccess && healClient &&
                await handleAutoHeal(healClient, serialNumber, `agent:${name}:backup`, backupTicket.ticketId, `Backup Failure for agent ${name} has resolved.`, autotaskConfig, context, { deviceName, agentName: name, exclusions })) {
                const index = deviceTickets.indexOf(backupTicket);
                if (index > -1) deviceTickets.splice(index, 1);
                backupTicket = undefined;
            }

            // Auto-heal agent screenshot (skip if agent or appliance is silenced)
            if (!isSilenced && !isApplianceSilenced && screenshotTicket && latestScreenshotSuccess && healClient &&
                await handleAutoHeal(healClient, serialNumber, `agent:${name}:screenshot`, screenshotTicket.ticketId, `Screenshot verification for agent ${name} has resolved.`, autotaskConfig, context, { deviceName, agentName: name, exclusions })) {
                const index = deviceTickets.indexOf(screenshotTicket);
                if (index > -1) deviceTickets.splice(index, 1);
                screenshotTicket = undefined;
            }

            // Auto-heal agent paused status (skip if agent or appliance is silenced)
            if (!isSilenced && !isApplianceSilenced && statusTicket && !isPaused && healClient &&
                await handleAutoHeal(healClient, serialNumber, statusTicket.rowKey, statusTicket.ticketId, `Backup agent status is no longer Paused/Archived for agent ${name}.`, autotaskConfig, context, { deviceName, agentName: name, exclusions })) {
                const index = deviceTickets.indexOf(statusTicket);
                if (index > -1) deviceTickets.splice(index, 1);
                statusTicket = undefined;
            }

            agents.push({
                name,
                status,
                isPaused,
                isArchived,
                excludedVolumes,
                excludedVolumesCount,
                protectedVolumeNames,
                unprotectedVolumeNames,
                osName: asset.osName || asset.type || "Unknown OS",
                lastSnapshot: formatLastBackup(asset),
                lastBackupStatus: (asset.backups && Array.isArray(asset.backups) && asset.backups.length > 0) ? {
                    success: latestBackupSuccess,
                    time: lastBackupTimeStr || undefined,
                    errorMessage: lastBackupErrorMsg || undefined
                } : null,
                screenshotVerification,
                backupTicketReference: backupTicket ? {
                    ticketId: backupTicket.ticketId,
                    ticketNumber: backupTicket.ticketNumber || backupTicket.ticketId,
                    ticketUrl: backupTicket.ticketUrl || "",
                    status: backupTicket.status || "Active"
                } : null,
                screenshotTicketReference: screenshotTicket ? {
                    ticketId: screenshotTicket.ticketId,
                    ticketNumber: screenshotTicket.ticketNumber || screenshotTicket.ticketId,
                    ticketUrl: screenshotTicket.ticketUrl || "",
                    status: screenshotTicket.status || "Active"
                } : null,
                statusTicketReference: statusTicket ? {
                    ticketId: statusTicket.ticketId,
                    ticketNumber: statusTicket.ticketNumber || statusTicket.ticketId,
                    ticketUrl: statusTicket.ticketUrl || "",
                    status: statusTicket.status || "Active"
                } : null
            });
        }

        // Calculate appliance exclusions count
        const applianceExclusionsCount = agents
            .filter(a => !a.isArchived)
            .reduce((sum, a) => sum + a.excludedVolumesCount, 0);

        // Check if this device is fully excluded
        const deviceExclusion = exclusions.find(
            e => e.type === "Device" && e.target.toLowerCase() === deviceName.toLowerCase()
        );

        const volumeExclusions = exclusions.filter(
            e => e.type === "Volume" && e.target.toLowerCase().startsWith(`${deviceName.toLowerCase()}:`)
        );

        // Determine backup status
        let isBackupSuccess = (device.alertCount === 0);
        let backupStatus: 'Success' | 'Failed' | 'Muted' = isBackupSuccess ? "Success" : "Failed";
        let requiresAction = !isBackupSuccess;
        let exclusionReason: string | null = null;

        if (deviceExclusion) {
            backupStatus = "Muted";
            requiresAction = false;
            exclusionReason = deviceExclusion.reason || "Device alert muted by administrator.";
        } else if (volumeExclusions.length > 0) {
            backupStatus = "Muted";
            requiresAction = false;
            exclusionReason = `Muted volumes: ${volumeExclusions.map(v => {
                const parts = v.target.split(":");
                if (parts.length >= 3) {
                    return `${parts[1]} (${parts[2]})`;
                }
                return parts[1] || "unknown";
            }).join(", ")}`;
        }

        // Create flat volumes list for backward compatibility in mute/exclusion forms
        const volumesList: any[] = [];
        for (const agent of agents) {
            if (agent.isArchived) continue;
            for (const volName of agent.protectedVolumeNames) {
                volumesList.push({
                    id: `${agent.name}:${volName}`,
                    name: `${agent.name} - ${volName}`
                });
            }
            for (const volName of agent.unprotectedVolumeNames || []) {
                volumesList.push({
                    id: `${agent.name}:${volName}`,
                    name: `${agent.name} - ${volName} (Datto Excluded)`
                });
            }
        }

        // Check for offsite sync ticket
        let offsitesyncTicket = deviceTickets.find(t => t.rowKey === "offsitesync");
        const isOffsiteSyncFailed = !!(device.offsiteSyncFailed || device.offsiteStatus === 'Error' || device.offsiteSyncStatus === 'Critical' || device.offsiteSyncStatus === 'Warning');
        if (offsitesyncTicket && !isOffsiteSyncFailed && healClient &&
            await handleAutoHeal(healClient, serialNumber, "offsitesync", offsitesyncTicket.ticketId, `Appliance offsite synchronization has resolved.`, autotaskConfig, context, { deviceName, exclusions })) {
            const index = deviceTickets.indexOf(offsitesyncTicket);
            if (index > -1) deviceTickets.splice(index, 1);
            offsitesyncTicket = undefined;
        }

        return {
            deviceName,
            companyName: device.clientCompanyName || device.organizationName || "Unknown Company",
            model: device.model || "Unknown Model",
            serialNumber: device.serialNumber || "Unknown Serial",
            usedStorageGB,
            totalStorageGB,
            storageUsedPercent: parseFloat(storageUsedPercent.toFixed(1)),
            backupStatus,
            exclusionReason,
            requiresAction,
            applianceExclusionsCount,
            agents,
            volumes: volumesList,
            alertCount: device.alertCount,
            isActive: isApplianceActive(device),
            lastCheckin: lastCheckinVal,
            status: isDeviceOffline ? 'offline' : 'online',
            isOffline: isDeviceOffline,
            storageTicketReference: storageTicket ? {
                ticketId: storageTicket.ticketId,
                ticketNumber: storageTicket.ticketNumber || storageTicket.ticketId,
                ticketUrl: storageTicket.ticketUrl || "",
                status: storageTicket.status || "Active"
            } : null,
            offlineTicketReference: offlineTicket ? {
                ticketId: offlineTicket.ticketId,
                ticketNumber: offlineTicket.ticketNumber || offlineTicket.ticketId,
                ticketUrl: offlineTicket.ticketUrl || "",
                status: offlineTicket.status || "Active"
            } : null,
            offsitesyncTicketReference: offsitesyncTicket ? {
                ticketId: offsitesyncTicket.ticketId,
                ticketNumber: offsitesyncTicket.ticketNumber || offsitesyncTicket.ticketId,
                ticketUrl: offsitesyncTicket.ticketUrl || "",
                status: offsitesyncTicket.status || "Active"
            } : null
        };
    }));

    // Sort appliances in alphabetical order by deviceName (case-insensitive, numeric)
    processedData.sort((a, b) => a.deviceName.localeCompare(b.deviceName, undefined, { sensitivity: 'base', numeric: true }));

    // Save to Ephemeral Memory Cache
    cachedRawData = processedData;
    cacheTimestamp = currentTime;

    // Fetch scanStatus from Table Storage
    let scanStatus: any = null;
    try {
        const statusTableClient = await getTableClient("ScanStatus");
        scanStatus = await statusTableClient.getEntity("Status", "BCDRScanner");
    } catch (statusErr: any) { }

    let maintMode: any = null;
    try {
        maintMode = await getGlobalMaintenanceMode();
    } catch { }

    // Apply live exclusions to return fully mapped devices
    const mappedDevices = applyExclusionsToDevices(processedData, exclusions);

    return {
        appVersion: APP_VERSION,
        devices: mappedDevices,
        maintenanceMode: maintMode,
        scanStatus: scanStatus ? {
            lastScan: scanStatus.lastScan,
            nextScan: scanStatus.nextScan,
            status: scanStatus.status,
            errorMessage: scanStatus.errorMessage
        } : null,
        cacheStatus: "MISS"
    };
}

/**
 * Force Scan (Specialist/Administrator, BW-023 / D-08): a full scan now – the same work and rules as the timer scan
 * (silence, change freeze, audit) – under the scan lock. If a scan is already running, waits for it and returns fresh
 * read-only data instead of starting a second one.
 */
async function runForceScan(context: Context, userEmail: string): Promise<{ result: any; scan: "ran" | "joined" }> {
    try {
        const audit = await getTableClient("AuditLogs");
        await audit.createEntity({
            partitionKey: "AuditLog",
            rowKey: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            userEmail,
            action: "Force Scan",
            target: "All appliances",
            details: "Full scan requested from the dashboard.",
            createdTime: new Date().toISOString()
        });
    } catch (auditErr: any) {
        context.log.warn("Failed to write Force Scan audit log:", auditErr.message || auditErr);
    }

    const outcome = await withScanLock(context, `Force Scan by ${userEmail}`, async () => {
        try {
            const scanned = await runPipeline(context, true, true);
            await recordForcedScanStatus(context, "Success", "");
            return scanned;
        } catch (scanErr: any) {
            await recordForcedScanStatus(context, "Failed", scanErr.message || String(scanErr));
            throw scanErr;
        }
    });
    if (outcome.ran) return { result: outcome.result, scan: "ran" };

    await waitForScanToFinish(context);
    return { result: await runPipeline(context, true, false), scan: "joined" };
}

/** Records a Force Scan as the last scan, keeping the timer's next-scan time. */
async function recordForcedScanStatus(context: Context, status: "Success" | "Failed", errorMessage: string): Promise<void> {
    try {
        const statusClient = await getTableClient("ScanStatus");
        await statusClient.upsertEntity({
            partitionKey: "Status",
            rowKey: "BCDRScanner",
            lastScan: new Date().toLocaleString("en-GB", { timeZone: "Europe/London" }),
            status,
            errorMessage,
            updatedTime: new Date().toISOString()
        }, "Merge");
    } catch (dbErr: any) {
        context.log.error(`Failed to update scan status after Force Scan: ${dbErr.message || dbErr}`);
    }
}

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    // Every route (main dashboard GET and all ?action= admin handlers) requires an Easy Auth principal.
    const userSec = requireAuthenticatedUser(context, req);
    if (!userSec) return;

    // Admin Console actions are engineer requests: their Autotask calls go ahead of scanner calls (BW-004).
    if (req.query.action) {
        await runAsUserAction(() => handleRequest(context, req, userSec));
    } else {
        await handleRequest(context, req, userSec);
    }
};

async function handleRequest(context: Context, req: HttpRequest, userSec: NonNullable<ReturnType<typeof requireAuthenticatedUser>>): Promise<void> {
    try {
        const action = req.query.action;

        // 1. Admin Diagnostics
        if (action === "adminDiagnostics") {
            if (userSec.role !== "Administrator") {
                context.res = {
                    status: 403,
                    body: { error: "Access Denied: The System Diagnostics Console is strictly restricted to Administrators." },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }

            const diagnostics: any = {
                timestamp: new Date().toISOString(),
                nodeVersion: process.version,
                appVersion: APP_VERSION,
                environment: process.env.AZURE_FUNCTIONS_ENVIRONMENT || "Production",
                autotask: {
                    status: "Unknown",
                    latencyMs: 0,
                    baseUrl: "",
                    configured: false
                },
                datto: {
                    status: process.env.DATTO_KEY ? "Configured & Active" : "Not Configured",
                    cache: getDattoCacheStats()
                },
                storage: {
                    status: "Unknown",
                    exclusionsCount: 0,
                    trackedTicketsCount: 0,
                    auditLogsCount: 0
                },
                scanner: {
                    lastScan: null,
                    nextScan: null,
                    status: "Unknown"
                }
            };

            const atConfig = getAutoTaskConfig();
            if (atConfig) {
                diagnostics.autotask.configured = true;
                const atStart = Date.now();
                try {
                    const baseUrl = await getAutoTaskBaseUrl(atConfig.user);
                    diagnostics.autotask.baseUrl = baseUrl;
                    await pingAutotaskZone(atConfig.user);
                    diagnostics.autotask.latencyMs = Date.now() - atStart;
                    diagnostics.autotask.status = "Healthy (200 OK)";
                } catch (atErr: any) {
                    diagnostics.autotask.latencyMs = Date.now() - atStart;
                    diagnostics.autotask.status = `Degraded (${atErr.message || "Error"})`;
                }
            } else {
                diagnostics.autotask.status = "Not Configured";
            }

            try {
                const exclusionsTable = await getTableClient("Exclusions");
                let exclCount = 0;
                for await (const _ of exclusionsTable.listEntities({ queryOptions: { select: ["rowKey"] } })) { exclCount++; }
                diagnostics.storage.exclusionsCount = exclCount;

                const ticketsTable = await getTableClient("TrackedTickets");
                let ticketCount = 0;
                for await (const _ of ticketsTable.listEntities({ queryOptions: { select: ["rowKey"] } })) { ticketCount++; }
                diagnostics.storage.trackedTicketsCount = ticketCount;

                const auditTable = await getTableClient("AuditLogs");
                let auditCount = 0;
                for await (const _ of auditTable.listEntities({ queryOptions: { select: ["rowKey"] } })) { auditCount++; }
                diagnostics.storage.auditLogsCount = auditCount;
                diagnostics.storage.status = "Connected (Healthy)";
            } catch (tblErr: any) {
                diagnostics.storage.status = `Error: ${tblErr.message || "Failed to query storage"}`;
            }

            try {
                const statusTable = await getTableClient("ScanStatus");
                const statusEntity = await statusTable.getEntity<any>("Scan", "Status");
                if (statusEntity) {
                    diagnostics.scanner.lastScan = statusEntity.lastScanTime || statusEntity.lastRunTime;
                    diagnostics.scanner.status = statusEntity.status || "Healthy";
                    if (diagnostics.scanner.lastScan) {
                        const lastMs = new Date(diagnostics.scanner.lastScan).getTime();
                        diagnostics.scanner.nextScan = new Date(lastMs + 30 * 60 * 1000).toISOString();
                    }
                }
            } catch (scanErr: any) {
                diagnostics.scanner.status = "Idle / Not Initialized";
            }

            context.res = {
                status: 200,
                body: diagnostics,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-store, no-cache, must-revalidate"
                }
            };
            return;
        }

        // 2. Admin Routing
        if (action === "adminRouting") {
            if (userSec.role !== "Administrator") {
                context.res = {
                    status: 403,
                    body: { error: "Access Denied: Autotask Live Routing Configuration is strictly restricted to Administrators." },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }

            const method = req.method ? req.method.toLowerCase() : "get";
            if (method === "get") {
                const currentRouting = await getAutotaskRoutingConfig();
                const atConfig = getAutoTaskConfig();

                let queues: { value: number; label: string }[] = [];
                let categories: { value: number; label: string }[] = [];
                let priorities: { value: number; label: string }[] = [
                    { value: 1, label: "1 - Low" },
                    { value: 2, label: "2 - Medium (Default)" },
                    { value: 3, label: "3 - High" },
                    { value: 4, label: "4 - Critical (P1 Outage)" }
                ];
                let workTypes: IPicklistValue[] = [];

                let issueTypes: IPicklistValue[] = [];
                let subIssueTypes: IPicklistValue[] = [];

                const forceRefresh = req.query && (req.query.force === "true" || req.query.forceRefresh === "true");

                if (atConfig) {
                    try {
                        const [qVals, cVals, pVals, wVals, iVals, sVals] = await Promise.all([
                            getTicketFieldPicklistValues("queueID", atConfig, forceRefresh),
                            getTicketFieldPicklistValues("ticketCategory", atConfig, forceRefresh),
                            getTicketFieldPicklistValues("priority", atConfig, forceRefresh),
                            getTicketFieldPicklistValues("allocationCodeID", atConfig, forceRefresh),
                            getTicketFieldPicklistValues("issueType", atConfig, forceRefresh),
                            getTicketFieldPicklistValues("subIssueType", atConfig, forceRefresh)
                        ]);
                        if (qVals && qVals.length > 0) queues = qVals;
                        if (cVals && cVals.length > 0) categories = cVals;
                        if (pVals && pVals.length > 0) priorities = pVals;
                        if (wVals && wVals.length > 0) workTypes = wVals;
                        if (iVals && iVals.length > 0) issueTypes = iVals;
                        if (sVals && sVals.length > 0) subIssueTypes = sVals;
                    } catch (pickErr: any) {
                        context.log.warn("Failed to fetch live picklists from Autotask:", pickErr.message || pickErr);
                    }
                }

                if (queues.length === 0) {
                    queues = [
                        { value: 29683511, label: "Monitoring Testing" },
                        { value: 29682833, label: "Tier 1 Support" },
                        { value: 29682969, label: "Tier 2 Support" },
                        { value: 29683488, label: "Backup" }
                    ];
                }
                if (categories.length === 0) {
                    categories = [
                        { value: 115, label: "Standard / BCDR" },
                        { value: 103, label: "SD Incident" },
                        { value: 114, label: "Other Maintenance Alert" }
                    ];
                }
                if (priorities.length === 0) {
                    priorities = [
                        { value: 1, label: "High" },
                        { value: 2, label: "Medium" },
                        { value: 3, label: "Low" },
                        { value: 4, label: "Critical" }
                    ];
                }
                if (workTypes.length === 0) {
                    workTypes = [
                        { value: 29682804, label: "Contract - Included" },
                        { value: 1, label: "Proactive Maintenance" }
                    ];
                }
                if (issueTypes.length === 0) {
                    issueTypes = [
                        { value: 30, label: "Backup" },
                        { value: 24, label: "Availability" },
                        { value: 23, label: "Performance" },
                        { value: 26, label: "Hardware" },
                        { value: 14, label: "RMM Alert" }
                    ];
                }
                if (subIssueTypes.length === 0) {
                    subIssueTypes = [
                        { value: 289, label: "Warning", parentValue: "30" },
                        { value: 290, label: "Failure", parentValue: "30" },
                        { value: 333, label: "Other", parentValue: "30" },
                        { value: 586, label: "Report", parentValue: "30" },
                        { value: 267, label: "Service Stopped", parentValue: "24" },
                        { value: 268, label: "Device Offline", parentValue: "24" },
                        { value: 264, label: "CPU", parentValue: "23" },
                        { value: 265, label: "Disk Usage", parentValue: "23" },
                        { value: 266, label: "Memory", parentValue: "23" }
                    ];
                }

                const alertMatrix = await getAlertRoutingMatrix();

                context.res = {
                    status: 200,
                    body: {
                        currentRouting,
                        alertMatrix,
                        options: {
                            queues,
                            categories,
                            priorities,
                            workTypes,
                            issueTypes,
                            subIssueTypes
                        }
                    },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }

            if (method === "post") {
                const body = req.body;
                if (!body) {
                    context.res = {
                        status: 400,
                        body: { error: "Request body required." },
                        headers: { "Content-Type": "application/json" }
                    };
                    return;
                }

                if (body.alertMatrix) {
                    await saveAlertRoutingMatrix(body.alertMatrix, userSec.email);
                }

                if (body.queueId !== undefined || body.priorityId !== undefined || body.categoryId !== undefined || body.workTypeId !== undefined) {
                    const routingConfig = {
                        queueId: body.queueId !== undefined ? Number(body.queueId) : undefined,
                        queueName: body.queueName ? String(body.queueName) : undefined,
                        priorityId: body.priorityId !== undefined ? Number(body.priorityId) : undefined,
                        categoryId: body.categoryId !== undefined ? Number(body.categoryId) : undefined,
                        workTypeId: body.workTypeId !== undefined ? Number(body.workTypeId) : undefined
                    };
                    await saveAutotaskRoutingConfig(routingConfig, userSec.email);
                }

                const updatedMatrix = await getAlertRoutingMatrix();

                context.res = {
                    status: 200,
                    body: {
                        success: true,
                        message: "Autotask routing configuration and alert matrix saved successfully.",
                        alertMatrix: updatedMatrix,
                        updatedTime: new Date().toISOString()
                    },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }
        }

        // 3. Global Maintenance Mode / Alert Silence Blackout
        if (action === "adminMaintenance") {
            if (userSec.role !== "Administrator") {
                context.res = {
                    status: 403,
                    body: { error: "Access Denied: Global Maintenance Mode is strictly restricted to Administrators." },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }

            const method = req.method ? req.method.toLowerCase() : "get";
            if (method === "get") {
                const config = await getGlobalMaintenanceMode();
                context.res = {
                    status: 200,
                    body: config,
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }

            if (method === "post") {
                const body = req.body || {};
                const isActive = Boolean(body.isActive);
                const durationHours = Number(body.durationHours) || 2;
                const reason = body.reason ? String(body.reason).trim() : "Planned Maintenance Window";
                const expiresAt = isActive ? new Date(Date.now() + durationHours * 3600 * 1000).toISOString() : null;

                const newConfig = {
                    isActive,
                    durationHours,
                    reason,
                    expiresAt
                };

                await setGlobalMaintenanceMode(newConfig, userSec.email);

                try {
                    const auditTable = await getTableClient("AuditLogs");
                    await auditTable.createEntity({
                        partitionKey: "Audit",
                        rowKey: `Maint-${Date.now()}`,
                        userEmail: userSec.email,
                        userRole: userSec.role,
                        action: isActive ? "Activate Global Maintenance Blackout" : "Deactivate Global Maintenance Blackout",
                        target: "Global System",
                        details: isActive ? `Duration: ${durationHours}h, Expires: ${expiresAt}, Reason: ${reason}` : "Maintenance Blackout manually deactivated",
                        createdTime: new Date().toISOString()
                    });
                } catch (auditErr: any) {
                    context.log.warn("Failed to write maintenance action to audit logs:", auditErr.message || auditErr);
                }

                context.res = {
                    status: 200,
                    body: {
                        success: true,
                        maintenance: {
                            ...newConfig,
                            activatedBy: userSec.email,
                            activatedTime: new Date().toISOString()
                        }
                    },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }
        }

        // 4. Stale Ticket & Entity Cleanup Tool
        if (action === "adminCleanup") {
            if (userSec.role !== "Administrator") {
                context.res = {
                    status: 403,
                    body: { error: "Access Denied: Entity Cleanup is strictly restricted to Administrators." },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }

            const method = req.method ? req.method.toLowerCase() : "get";

            if (method === "get") {
                const activeSerials = new Set<string>();
                const activeAgentKeys = new Set<string>();

                if (cachedRawData && Array.isArray(cachedRawData)) {
                    for (const dev of cachedRawData) {
                        if (dev.serialNumber) activeSerials.add(dev.serialNumber.toLowerCase());
                        if (dev.deviceName) {
                            const dName = dev.deviceName.toLowerCase();
                            for (const ag of (dev.agents || [])) {
                                if (ag.name) activeAgentKeys.add(`${dName}:${ag.name.toLowerCase()}`);
                            }
                        }
                    }
                }

                const orphanTickets: any[] = [];
                const orphanExclusions: any[] = [];

                try {
                    const ticketsTable = await getTableClient("TrackedTickets");
                    for await (const t of ticketsTable.listEntities<any>()) {
                        const serial = (t.partitionKey || "").toLowerCase();
                        if (activeSerials.size > 0 && !activeSerials.has(serial)) {
                            orphanTickets.push({
                                partitionKey: t.partitionKey,
                                rowKey: t.rowKey,
                                ticketId: t.ticketId,
                                ticketNumber: t.ticketNumber || t.ticketId,
                                status: t.status || "Unknown",
                                createdTime: t.createdTime || t.timestamp
                            });
                        }
                    }
                } catch (tErr: any) {
                    context.log.warn("Failed to scan TrackedTickets for cleanup:", tErr.message || tErr);
                }

                try {
                    const exclTable = await getTableClient("Exclusions");
                    for await (const e of exclTable.listEntities<any>()) {
                        const type = e.type;
                        const target = (e.target || "").toLowerCase();
                        let isOrphan = false;

                        if (type === "Device") {
                            let found = false;
                            if (cachedRawData) {
                                for (const dev of cachedRawData) {
                                    if (dev.deviceName && dev.deviceName.toLowerCase() === target) {
                                        found = true;
                                        break;
                                    }
                                }
                            }
                            if (activeSerials.size > 0 && !found) isOrphan = true;
                        } else if (type === "Agent" || type === "Volume") {
                            const parts = target.split(":");
                            if (parts.length >= 2) {
                                const agKey = `${parts[0]}:${parts[1]}`;
                                if (activeAgentKeys.size > 0 && !activeAgentKeys.has(agKey)) {
                                    isOrphan = true;
                                }
                            }
                        }

                        if (isOrphan) {
                            orphanExclusions.push({
                                partitionKey: e.partitionKey,
                                rowKey: e.rowKey,
                                type: e.type,
                                target: e.target,
                                reason: e.reason || "",
                                createdTime: e.createdTime || e.timestamp
                            });
                        }
                    }
                } catch (eErr: any) {
                    context.log.warn("Failed to scan Exclusions for cleanup:", eErr.message || eErr);
                }

                context.res = {
                    status: 200,
                    body: {
                        orphanTickets,
                        orphanExclusions,
                        stats: {
                            orphanTicketsCount: orphanTickets.length,
                            orphanExclusionsCount: orphanExclusions.length,
                            activeAppliancesCount: activeSerials.size
                        }
                    },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }

            if (method === "post") {
                const body = req.body || {};
                const ticketsToPurge: { partitionKey: string; rowKey: string }[] = body.tickets || [];
                const exclusionsToPurge: { partitionKey: string; rowKey: string }[] = body.exclusions || [];

                let purgedTickets = 0;
                let purgedExclusions = 0;

                if (ticketsToPurge.length > 0) {
                    const ticketsTable = await getTableClient("TrackedTickets");
                    for (const item of ticketsToPurge) {
                        try {
                            await ticketsTable.deleteEntity(item.partitionKey, item.rowKey);
                            purgedTickets++;
                        } catch { }
                    }
                }

                if (exclusionsToPurge.length > 0) {
                    const exclTable = await getTableClient("Exclusions");
                    for (const item of exclusionsToPurge) {
                        try {
                            await exclTable.deleteEntity(item.partitionKey, item.rowKey);
                            purgedExclusions++;
                        } catch { }
                    }
                }

                try {
                    const auditTable = await getTableClient("AuditLogs");
                    await auditTable.createEntity({
                        partitionKey: "Audit",
                        rowKey: `Cleanup-${Date.now()}`,
                        userEmail: userSec.email,
                        userRole: userSec.role,
                        action: "Bulk Orphan Cleanup",
                        target: "Azure Table Storage",
                        details: `Purged ${purgedTickets} orphan tickets and ${purgedExclusions} orphan exclusions`,
                        createdTime: new Date().toISOString()
                    });
                } catch { }

                context.res = {
                    status: 200,
                    body: {
                        success: true,
                        purgedTickets,
                        purgedExclusions,
                        message: `Successfully purged ${purgedTickets} tickets and ${purgedExclusions} exclusions.`
                    },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }
        }

        // 5. Live Autotask Connection Tester & Asset Reconciliation
        if (action === "adminTestAsset") {
            if (userSec.role !== "Administrator") {
                context.res = {
                    status: 403,
                    body: { error: "Access Denied: Asset Reconciliation is strictly restricted to Administrators." },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }

            const atConfig = getAutoTaskConfig();
            if (!atConfig) {
                context.res = {
                    status: 400,
                    body: { error: "Autotask credentials are not configured on this instance." },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }

            const query = (req.body?.query || req.query.query || "").trim();
            if (!query) {
                context.res = {
                    status: 400,
                    body: { error: "Missing query parameter (hostname or serial number required)." },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }

            const start = Date.now();
            try {
                const ciResult = await lookupConfigurationItemInAutoTask({
                    serialNumber: query,
                    agentName: query,
                    deviceName: query,
                    companyID: null
                }, atConfig);
                const latency = Date.now() - start;

                let companyName = "Unknown Company";
                let contractInfo: any = null;

                if (ciResult && ciResult.companyID) {
                    try {
                        const resolvedName = await getAutotaskCompanyName(ciResult.companyID, atConfig);
                        if (resolvedName) {
                            companyName = resolvedName;
                        }

                        const contractId = await lookupContractInAutoTask(ciResult.companyID, "Datto BCDR", atConfig);
                        if (contractId) {
                            contractInfo = {
                                id: contractId,
                                name: "Datto BCDR",
                                status: "Active"
                            };
                        }
                    } catch { }
                }

                context.res = {
                    status: 200,
                    body: {
                        query,
                        latencyMs: latency,
                        matchFound: !!ciResult,
                        configurationItem: ciResult ? {
                            id: ciResult.id,
                            serialNumber: ciResult.serialNumber,
                            companyId: ciResult.companyID,
                            companyName: companyName,
                            contract: contractInfo
                        } : null
                    },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            } catch (err: any) {
                context.res = {
                    status: 500,
                    body: { error: err.message || "Failed to query Autotask." },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }
        }

        const requestedForce = req.query.refresh === 'true' || req.query.force === 'true';
        let forceRefresh = false;
        if (requestedForce) {
            if (userSec.isAuthorizedForForceRefresh) {
                forceRefresh = true;
            } else {
                context.log.warn(`[RBAC] User ${userSec.email} with role ${userSec.role} requested force refresh without Specialist/Administrator permissions. Falling back to cached data.`);
            }
        }
        // Opening the dashboard is read-only (BW-023); only a Force Scan (or the timer) writes.
        let result: any;
        let scan: "none" | "ran" | "joined" = "none";
        if (forceRefresh) {
            ({ result, scan } = await runForceScan(context, userSec.email));
        } else {
            result = await runPipeline(context, false, false);
        }
        context.res = {
            status: 200,
            // Spread so the cached pipeline result is never mutated with per-user fields.
            body: { ...result, userRole: userSec.role, userEmail: userSec.email },
            headers: {
                "Content-Type": "application/json",
                "X-Cache-Status": result.cacheStatus,
                "X-Scan": scan
            }
        };
    } catch (error: any) {
        context.log.error("Stateless Datto BCDR pipeline error: ", error.message || error);

        let exclusions: any[] = [];
        try {
            const tableClient = await getTableClient("Exclusions");
            const entities = tableClient.listEntities<IExclusionEntity>();
            for await (const entity of entities) {
                exclusions.push(entity);
            }
        } catch (e) { }

        let scanStatus: any = null;
        try {
            const statusTableClient = await getTableClient("ScanStatus");
            scanStatus = await statusTableClient.getEntity("Status", "BCDRScanner");
        } catch (statusErr: any) { }

        if (cachedRawData) {
            const mappedDevices = applyExclusionsToDevices(cachedRawData, exclusions);
            context.res = {
                status: 200,
                body: {
                    appVersion: APP_VERSION,
                    devices: mappedDevices,
                    userRole: userSec.role,
                    userEmail: userSec.email,
                    scanStatus: scanStatus ? {
                        lastScan: scanStatus.lastScan,
                        nextScan: scanStatus.nextScan,
                        status: scanStatus.status,
                        errorMessage: scanStatus.errorMessage
                    } : null
                },
                headers: {
                    "Content-Type": "application/json",
                    "X-Cache-Status": "STALE_FALLBACK"
                }
            };
        } else {
            context.res = {
                status: 500,
                body: {
                    error: "Error processing live Datto BCDR operational matrix.",
                    details: error.message || error
                },
                headers: {
                    "Content-Type": "application/json"
                }
            };
        }
    }
}

export { httpTrigger as index };
export default httpTrigger;
