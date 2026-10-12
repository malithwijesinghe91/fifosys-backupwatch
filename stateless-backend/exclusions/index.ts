import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { getTableClient } from "../shared/tableService";
import { 
    getAutoTaskConfig, 
    lookupConfigurationItemInAutoTask, 
    createTicketInAutoTask, 
    getAutoTaskBaseUrl, 
    getAutoTaskTicketUrl, 
    queryTicketsInAutoTask,
    queryTicketByNumber,
    getSingleTicketFromAutoTask,
    createComplianceTicket,
    createTicketNoteInAutoTask,
    getTicketStatusPicklistValues
} from "../shared/autotask";
import { normalizeVolumeName, isAgentSilenced, isDeviceSilenced } from "../shared/volumeUtils";
import { requireAuthenticatedUser } from "../shared/auth";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const method = (req.method || "").toLowerCase();

    const userSec = requireAuthenticatedUser(context, req);
    if (!userSec) return;
    
    try {
        const tableClient = await getTableClient();

        if (method === "get") {
            // Log & persist Autotask status picklists
            const autotaskConfig = getAutoTaskConfig();
            if (autotaskConfig) {
                try {
                    const statusPicklists = await getTicketStatusPicklistValues(autotaskConfig);
                    const statusTableClient = await getTableClient("ScanStatus");
                    await statusTableClient.upsertEntity({
                        partitionKey: "Status",
                        rowKey: "AutotaskPicklistProof",
                        picklistsJson: JSON.stringify(statusPicklists),
                        updatedTime: new Date().toISOString()
                    }, "Replace");
                } catch (eErr: any) {}
            }

            // GET: Retrieve all active exclusions
            const exclusions: any[] = [];
            const entities = tableClient.listEntities();
            for await (const entity of entities) {
                exclusions.push({
                    id: entity.rowKey,
                    type: entity.type,
                    target: entity.target,
                    reason: entity.reason,
                    isPermanent: entity.isPermanent !== undefined ? entity.isPermanent : true,
                    expiresAt: entity.expiresAt || null,
                    ticketNumber: entity.ticketNumber || null,
                    ticketUrl: entity.ticketUrl || null,
                    createdTime: entity.createdTime
                });
            }
            context.res = {
                status: 200,
                body: exclusions,
                headers: { "Content-Type": "application/json" }
            };
            return;
        }

        if (method === "post") {
            if (!userSec.isAuthorizedForModification) {
                context.res = {
                    status: 403,
                    body: { error: "Access Denied: Your assigned role (Viewer) does not have permission to create or modify exclusions." },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }

            // POST: Create or update an exclusion
            const { type, target, reason, isPermanent, durationDays, ticketNumber: reqTicketNumber, isEmergencyOverride } = req.body || {};

            if (!type || !target) {
                context.res = {
                    status: 400,
                    body: { error: "Parameters 'type' and 'target' are required." }
                };
                return;
            }

            if (type !== "Device" && type !== "Agent" && type !== "Volume") {
                context.res = {
                    status: 400,
                    body: { error: "Parameter 'type' must be 'Device', 'Agent', or 'Volume'." }
                };
                return;
            }

            const perm = isPermanent !== undefined ? Boolean(isPermanent) : false;
            if (perm && !userSec.isAuthorizedForPermanent) {
                context.res = {
                    status: 403,
                    body: { error: "Access Denied: Creating permanent exclusions requires Specialist or Administrator permissions." },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }

            // Reason / Business Justification is strictly mandatory for permanent exclusions, but optional for temporary troubleshooting
            if (perm && (!reason || !reason.trim())) {
                context.res = {
                    status: 400,
                    body: { error: "A business justification / reason is mandatory for permanent exclusions." },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }

            const cleanedReason = (reason && reason.trim()) ? reason.trim() : (perm ? "" : "None provided (Temporary exclusion)");

            const days = (typeof durationDays === "number" && durationDays > 0) ? durationDays : 3;
            const expiresAt = perm ? null : new Date(Date.now() + days * 86400000).toISOString();

            let ticketNumber: string | null = reqTicketNumber || null;
            let ticketUrl: string | null = null;

            let normalizedTarget = target;
            if (type === "Volume") {
                const targetParts = target.split(":");
                const deviceName = targetParts[0] || "Unknown";
                const agentName = targetParts[1] || "";
                const volumeName = normalizeVolumeName(targetParts.slice(2).join(":"));
                normalizedTarget = `${deviceName}:${agentName}:${volumeName}`;
            } else if (type === "Agent") {
                const targetParts = target.split(":");
                const deviceName = (targetParts[0] || "Unknown").trim();
                const agentName = (targetParts[1] || "").trim();
                normalizedTarget = `${deviceName}:${agentName}`;
            } else if (type === "Device") {
                normalizedTarget = target.trim();
            }

            // Create a safe, unique RowKey from type and normalizedTarget
            const rowKey = encodeURIComponent(`${type}:${normalizedTarget}`);

            // Fetch existing exclusion from DB to reuse ticket number and URL if already tracked
            let existingEntity: any = null;
            try {
                existingEntity = await tableClient.getEntity("Exclusion", rowKey);
            } catch (fetchErr: any) {
                // If not found by encoded rowKey, try unencoded / raw rowKey fallback
                try {
                    existingEntity = await tableClient.getEntity("Exclusion", `${type}:${normalizedTarget}`);
                } catch (fallbackErr: any) {
                    existingEntity = null;
                }
            }

            // Clean up any legacy un-normalized twin entities in Table Storage (e.g. D:\ vs D)
            if (type === "Volume") {
                const targetParts = normalizedTarget.split(":");
                const dev = targetParts[0] || "";
                const agt = targetParts[1] || "";
                const vol = targetParts[2] || "";
                const candidateTwinTargets = [
                    `${dev}:${agt}:${vol}:\\`,
                    `${dev}:${agt}:${vol}:/`,
                    `${dev}:${agt}:${vol}:`,
                    `${dev}:${agt}:${vol}\\`,
                    `${dev}:${agt}:${vol}/`
                ];
                for (const rawTwin of candidateTwinTargets) {
                    const encodedTwinKey = encodeURIComponent(`Volume:${rawTwin}`);
                    if (encodedTwinKey !== rowKey) {
                        try {
                            const twin = await tableClient.getEntity("Exclusion", encodedTwinKey);
                            if (twin) {
                                if (!existingEntity) {
                                    existingEntity = twin;
                                }
                                await tableClient.deleteEntity("Exclusion", encodedTwinKey);
                                context.log.info(`[Exclusions API Cleanup] Cleaned up legacy un-normalized twin entity: ${encodedTwinKey}`);
                            }
                        } catch (tErr) { }
                    }
                }
            }

            if (existingEntity) {
                if (!ticketNumber && existingEntity.ticketNumber) {
                    ticketNumber = existingEntity.ticketNumber;
                }
                // Only reuse existing ticketUrl if no new ticket number was provided or if the ticket number is unchanged
                if (!ticketUrl && existingEntity.ticketUrl) {
                    const isSameTicket = !reqTicketNumber || (existingEntity.ticketNumber && String(reqTicketNumber).trim().toLowerCase() === String(existingEntity.ticketNumber).trim().toLowerCase());
                    if (isSameTicket) {
                        ticketUrl = existingEntity.ticketUrl;
                    }
                }
            }

            const isEmergency = Boolean(isEmergencyOverride) || ticketNumber === "[OVERRIDE: EMERGENCY OUTAGE]";
            if (isEmergency) {
                if (userSec.role !== "Administrator") {
                    context.res = {
                        status: 403,
                        body: { error: "Access Denied: Emergency override of mandatory ticket requirement is restricted to Administrators." }
                    };
                    return;
                }
                ticketNumber = "[OVERRIDE: EMERGENCY OUTAGE]";
            } else {
                // Ticket Number is mandatory for all exclusions/silences
                if (!ticketNumber || !ticketNumber.trim()) {
                    context.res = {
                        status: 400,
                        body: { error: "Autotask Ticket Number ('ticketNumber') is mandatory for all silence and exclusion requests." }
                    };
                    return;
                }
                ticketNumber = ticketNumber.trim();
            }

            // Fetch all active exclusions to evaluate parent silence status
            let allExclusions: any[] = [];
            try {
                const entities = tableClient.listEntities<any>();
                for await (const ent of entities) {
                    allExclusions.push(ent);
                }
            } catch (e) { }

            const autotaskConfig = getAutoTaskConfig();
            if (autotaskConfig) {
                try {
                    // CASE 1: Volume Exclusion WITHOUT a ticket -> Auto-create compliance ticket
                    if (type === "Volume" && !ticketNumber) {
                        const targetParts = normalizedTarget.split(":");
                        const deviceName = targetParts[0] || "Unknown";
                        const agentName = targetParts[1] || "";
                        const volumeName = targetParts[2] || "";

                        const isSilenced = isAgentSilenced(allExclusions, deviceName, agentName);
                        if (isSilenced) {
                            context.log.info(`[Exclusions API] Appliance or Agent ${deviceName}:${agentName} is Silenced. Suppressing Autotask ticket creation & note pushes for Volume ${volumeName}.`);
                        } else {
                            context.log.info(`[Exclusions Auto-Ticket] Creating compliance ticket for Device: ${deviceName}, Agent: ${agentName}, Volume: ${volumeName}`);
                            
                            const ticketObj = await createComplianceTicket({
                                deviceName: deviceName,
                                agentName: agentName,
                                volumeName: volumeName,
                                reason: cleanedReason,
                                serialNumber: deviceName, // fallback serial
                                clientCompanyName: undefined
                            }, autotaskConfig);

                            if (ticketObj) {
                                context.log.info(`[Exclusions Auto-Ticket] Successfully created compliance ticket #${ticketObj.ticketId}`);
                                ticketNumber = String(ticketObj.ticketId);
                                try {
                                    const baseUrl = await getAutoTaskBaseUrl(autotaskConfig.user);
                                    ticketUrl = getAutoTaskTicketUrl(baseUrl, ticketObj.ticketId);
                                    const atTicket = await getSingleTicketFromAutoTask(ticketObj.ticketId, autotaskConfig);
                                    if (atTicket && atTicket.ticketNumber) {
                                        ticketNumber = atTicket.ticketNumber;
                                    }
                                } catch (urlErr: any) {
                                    context.log.warn(`[Exclusions Auto-Ticket] Failed to resolve ticket details: ${urlErr.message}`);
                                }
                            }
                        }
                    } 
                    // CASE 2: Engineer explicitly provided an existing Ticket Number (Device, Agent, or Volume)
                    else if (ticketNumber) {
                        const match = ticketUrl ? ticketUrl.match(/ticketId=(\d+)/) : null;
                        let ticketIdNum: number | null = match ? parseInt(match[1], 10) : (!isNaN(parseInt(ticketNumber, 10)) && !ticketNumber.startsWith("T") ? parseInt(ticketNumber, 10) : null);

                        if (!ticketIdNum) {
                            try {
                                context.log.info(`[Exclusions Note Push] Querying AutoTask to resolve internal ID for ticketNumber: "${ticketNumber}"`);
                                const atTicket = await queryTicketByNumber(ticketNumber, autotaskConfig);
                                if (atTicket) {
                                    ticketIdNum = atTicket.id;
                                    if (atTicket.ticketNumber) {
                                        ticketNumber = atTicket.ticketNumber;
                                    }
                                    const baseUrl = await getAutoTaskBaseUrl(autotaskConfig.user);
                                    ticketUrl = getAutoTaskTicketUrl(baseUrl, atTicket.id);
                                    context.log.info(`[Exclusions Note Push] Resolved ticketNumber "${ticketNumber}" to internal ID ${ticketIdNum}`);
                                }
                            } catch (queryErr: any) {
                                context.log.warn(`[Exclusions Note Push] Failed to query Autotask by ticketNumber: ${queryErr.message}`);
                            }
                        }

                        if (ticketIdNum && !isNaN(ticketIdNum)) {
                            let noteTargetLabel = normalizedTarget;
                            if (type === "Device") noteTargetLabel = `Appliance [${normalizedTarget}]`;
                            else if (type === "Agent") noteTargetLabel = `Backup Agent [${normalizedTarget}]`;
                            else if (type === "Volume") noteTargetLabel = `Volume [${normalizedTarget}]`;

                            const noteTitle = perm 
                                ? `[NOTE] BackupWatch ${type} Silenced: PERMANENT` 
                                : `[NOTE] BackupWatch ${type} Silenced: TEMPORARY (${days} Days)`;

                            const noteDesc = `Silence/Exclusion details updated via BackupWatch Dashboard:\n\n` +
                                `Target: ${noteTargetLabel}\n` +
                                `Type: ${perm ? "Permanent Exclusion" : `Temporary Exclusion (${days} Days)`}\n` +
                                `Expiry Date: ${expiresAt ? new Date(expiresAt).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "Never"}\n` +
                                `Reason/Note: ${cleanedReason}`;
                            
                            const noteResult = await createTicketNoteInAutoTask(ticketIdNum, {
                                title: noteTitle,
                                description: noteDesc
                            }, autotaskConfig);
                            if (noteResult) {
                                context.log.info(`[Exclusions Note Push] Successfully posted update note to Autotask Ticket #${ticketNumber} (ID: ${ticketIdNum})`);
                            } else {
                                context.log.warn(`[Exclusions Note Push] createTicketNoteInAutoTask returned false for Ticket #${ticketNumber} (ID: ${ticketIdNum})`);
                            }
                        } else {
                            context.log.warn(`[Exclusions Note Push] Could not resolve numeric ticketId for ticketNumber "${ticketNumber}". Skipping note push.`);
                        }
                    }
                    // CASE 3: Device or Agent with NO ticket number -> 0 Autotask API calls made (Silent mode)
                } catch (ticketErr: any) {
                    context.log.error(`[Exclusions Auto-Ticket/Note] Autotask interaction failed: ${ticketErr.message}`);
                }
            }

            const entity = {
                partitionKey: "Exclusion",
                rowKey: rowKey,
                type: type,
                target: normalizedTarget,
                reason: cleanedReason,
                isPermanent: perm,
                expiresAt: expiresAt,
                ticketNumber: ticketNumber,
                ticketUrl: ticketUrl,
                createdTime: existingEntity?.createdTime || new Date().toISOString()
            };

            await tableClient.upsertEntity(entity, "Replace");

            try {
                const auditTableClient = await getTableClient("AuditLogs");
                const userEmail = userSec.email;
                const action = isEmergency ? `Emergency Override Mute ${type}` : `Mute ${type}`;
                const logEntity = {
                    partitionKey: "AuditLog",
                    rowKey: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    userEmail: userEmail,
                    userRole: userSec.role,
                    action: action,
                    target: normalizedTarget,
                    details: isEmergency ? `[EMERGENCY OVERRIDE: NO TICKET] ${cleanedReason}` : `[Ticket #${ticketNumber}] ${cleanedReason}`,
                    createdTime: new Date().toISOString()
                };
                await auditTableClient.createEntity(logEntity);
            } catch (auditErr: any) {
                context.log.error("Failed to write mute audit log:", auditErr.message || auditErr);
            }

            context.res = {
                status: 201,
                body: {
                    message: "Exclusion created successfully.",
                    exclusion: {
                        id: rowKey,
                        type,
                        target,
                        reason: cleanedReason,
                        ticketNumber,
                        ticketUrl,
                        createdTime: entity.createdTime
                    }
                },
                headers: { "Content-Type": "application/json" }
            };
            return;
        }

        if (method === "delete") {
            if (!userSec.isAuthorizedForModification) {
                context.res = {
                    status: 403,
                    body: { error: "Access Denied: Your assigned role (Viewer) does not have permission to remove exclusions or unmute." },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }

            // DELETE: Remove an exclusion
            const id = req.query.id || (req.body && req.body.id);

            if (!id) {
                context.res = {
                    status: 400,
                    body: { error: "Parameter 'id' (RowKey) is required to delete an exclusion." }
                };
                return;
            }

            let target = "";
            let type = "";
            let reason = "";
            try {
                const existingExclusion = await tableClient.getEntity<any>("Exclusion", id);
                if (existingExclusion) {
                    target = existingExclusion.target || "";
                    type = existingExclusion.type || "";
                    reason = existingExclusion.reason || "";
                }
            } catch (fetchErr: any) {
                const encodedId = encodeURIComponent(id);
                if (encodedId !== id) {
                    try {
                        const existingExclusion = await tableClient.getEntity<any>("Exclusion", encodedId);
                        if (existingExclusion) {
                            target = existingExclusion.target || "";
                            type = existingExclusion.type || "";
                            reason = existingExclusion.reason || "";
                        }
                    } catch (innerFetchErr: any) {
                        context.log.warn(`Could not fetch existing exclusion for auditing: ${innerFetchErr.message}`);
                    }
                } else {
                    context.log.warn(`Could not fetch existing exclusion for auditing: ${fetchErr.message}`);
                }
            }

            try {
                await tableClient.deleteEntity("Exclusion", id);
            } catch (err: any) {
                const encodedId = encodeURIComponent(id);
                if (encodedId !== id) {
                    try {
                        await tableClient.deleteEntity("Exclusion", encodedId);
                    } catch (innerErr: any) {
                        if (innerErr.statusCode === 404 || innerErr.code === "ResourceNotFound" || (innerErr.message && innerErr.message.indexOf("ResourceNotFound") !== -1)) {
                            context.res = {
                                status: 404,
                                body: { error: `Exclusion with ID '${id}' not found.` },
                                headers: { "Content-Type": "application/json" }
                            };
                            return;
                        }
                        throw innerErr;
                    }
                } else {
                    if (err.statusCode === 404 || err.code === "ResourceNotFound" || (err.message && err.message.indexOf("ResourceNotFound") !== -1)) {
                        context.res = {
                            status: 404,
                            body: { error: `Exclusion with ID '${id}' not found.` },
                            headers: { "Content-Type": "application/json" }
                        };
                        return;
                    }
                    throw err;
                }
            }

            try {
                const auditTableClient = await getTableClient("AuditLogs");
                const userEmail = userSec.email;
                const action = `Unmute ${type || "Item"}`;
                const logEntity = {
                    partitionKey: "AuditLog",
                    rowKey: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    userEmail: userEmail,
                    userRole: userSec.role,
                    action: action,
                    target: target || id,
                    details: reason ? `Previously: ${reason}` : "",
                    createdTime: new Date().toISOString()
                };
                await auditTableClient.createEntity(logEntity);
            } catch (auditErr: any) {
                context.log.error("Failed to write unmute audit log:", auditErr.message || auditErr);
            }

            context.res = {
                status: 200,
                body: { message: "Exclusion deleted successfully." },
                headers: { "Content-Type": "application/json" }
            };
            return;
        }

        context.res = {
            status: 405,
            body: { error: `Method ${req.method} not allowed.` }
        };

    } catch (error: any) {
        context.log.error("Exclusions function error: ", error.message || error);
        context.res = {
            status: 500,
            body: {
                error: "Internal server error in exclusions manager.",
                details: error.message || error
            },
            headers: { "Content-Type": "application/json" }
        };
    }
};

export default httpTrigger;
