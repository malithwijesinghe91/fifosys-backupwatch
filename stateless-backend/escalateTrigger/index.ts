import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { getTableClient } from "../shared/tableService";
import {
    getAutoTaskConfig,
    getAutoTaskBaseUrl,
    getAutoTaskTicketUrl,
    lookupConfigurationItemInAutoTask,
    lookupCompanyInAutoTask,
    lookupContractInAutoTask,
    createTicketInAutoTask,
    createTicketNoteInAutoTask,
    queryTicketsInAutoTask,
    getSingleTicketFromAutoTask
} from "../shared/autotask";
import { requireAuthenticatedUser } from "../shared/auth";
import { formatStorageGB } from "../shared/storageUnits";
import { runAsUserAction } from "../shared/autotaskGateway";
import { AutotaskWriteBlockedError, IAutotaskWriteContext } from "../shared/autotaskPolicy";
import { requireNoChangeFreeze } from "../shared/changeFreeze";
import { getAutotaskRoutingConfig } from "../shared/configService";

interface ITrackedTicketEntity {
    partitionKey: string; // SerialNumber
    rowKey: string; // IssueKey
    ticketId: string;
    ticketNumber?: string;
    ticketUrl?: string;
    status: string;
    lastSeenMessage?: string;
    createdTime?: string;
}

function computeRelativeTime(epochSeconds: number | null | undefined): string {
    if (!epochSeconds) return "Unknown";
    const nowSeconds = Math.floor(Date.now() / 1000);
    const diffSeconds = nowSeconds - epochSeconds;
    const diffMinutes = Math.floor(diffSeconds / 60);

    if (diffMinutes < 0) {
        return "Just now";
    } else if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
    } else {
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        return `${hours}h ${mins}m ago`;
    }
}

function formatTicketDescription(issueType: string, params: {
    deviceName: string;
    agentName?: string;
    companyName: string;
    errorMessage?: string;
    lastBackupTime?: string;
    lastSeenHeartbeat?: string;
    serialNumber: string;
    model?: string;
    screenshotTime?: string;
    screenshotUrl?: string;
    usedStorageGB?: number;
    totalStorageGB?: number;
    storageUsedPercent?: number;
    lastCheckinTime?: string;
}): string {
    const divider = "==================================================";
    const sectionDivider = "--------------------------------------------------";
    const commonInfo = `Appliance Serial: ${params.serialNumber}\nAppliance Model:  ${params.model || "Unknown Model"}\nAppliance Portal:  https://partner.dattobackup.com/device/detail/${params.serialNumber}`;

    const typeLower = issueType.toLowerCase();

    if (typeLower === 'backup') {
        return `${divider}
BACKUPWATCH ALERT: BACKUP FAILURE
${divider}

Appliance:  ${params.deviceName}
Agent:      ${params.agentName || "Unknown Agent"}
Client:     ${params.companyName}

A backup job for agent ${params.agentName || "Unknown Agent"} on your backup device ${params.deviceName} has failed.

${sectionDivider}
ALERT DETAILS
${sectionDivider}
Error Message: 
${params.errorMessage || "No error message specified."}

Last Backup Attempt: ${params.lastBackupTime || "Unknown"}
Last Seen Heartbeat: ${params.lastSeenHeartbeat || "Unknown"}

${sectionDivider}
TECHNICAL SUPPORT INFO
${sectionDivider}
${commonInfo}

${sectionDivider}
RECOMMENDED STEPS
${sectionDivider}
1. Log in to the Datto Partner Portal link above.
2. Verify if the agent service (Datto Backup Agent / ShadowSnap) is running on the guest server.
3. Check VSS writers status on the guest OS if the error mentions writer failures.`;
    }

    if (typeLower === 'screenshot') {
        return `${divider}
BACKUPWATCH ALERT: SCREENSHOT BOOT FAILURE
${divider}

Appliance:  ${params.deviceName}
Agent:      ${params.agentName || "Unknown Agent"}
Client:     ${params.companyName}

The automated screenshot boot verification test has failed for agent ${params.agentName || "Unknown Agent"} on appliance ${params.deviceName}.

${sectionDivider}
ALERT DETAILS
${sectionDivider}
Screenshot Status: Verification Failed

Verification Time: ${params.screenshotTime || "Unknown"}
Last Seen Heartbeat: ${params.lastSeenHeartbeat || "Unknown"}

VIEW SCREENSHOT IMAGE:
${params.screenshotUrl || "No screenshot image link available."}

*(Open the link above to view the Windows boot screen or error code)*

${sectionDivider}
TECHNICAL SUPPORT INFO
${sectionDivider}
${commonInfo}

${sectionDivider}
RECOMMENDED STEPS
${sectionDivider}
1. Click the screenshot link above to check for standard boot issues (e.g., Windows Update loop, Blue Screen of Death, Disk Check).
2. If it is a transient issue, trigger a manual screenshot verification from the Datto portal.
3. If it failed to boot, check virtualization configurations or restore points.`;
    }

    if (typeLower === 'storage') {
        const usedGB = params.usedStorageGB !== undefined ? params.usedStorageGB : 0;
        const totalGB = params.totalStorageGB !== undefined ? params.totalStorageGB : 0;
        const percent = params.storageUsedPercent !== undefined ? params.storageUsedPercent : 0;
        const availGB = parseFloat((totalGB - usedGB).toFixed(2));

        return `${divider}
BACKUPWATCH ALERT: APPLIANCE LOW STORAGE
${divider}

Appliance:  ${params.deviceName}
Client:     ${params.companyName}

The Datto appliance ${params.deviceName} is running low on local storage capacity.

${sectionDivider}
ALERT DETAILS
${sectionDivider}
Current Storage Used: ${formatStorageGB(usedGB)} of ${formatStorageGB(totalGB)} (${percent}%)
Available Space: ${formatStorageGB(availGB)}

Heartbeat Checked-in: ${params.lastSeenHeartbeat || "Unknown"}

${sectionDivider}
TECHNICAL SUPPORT INFO
${sectionDivider}
${commonInfo}

${sectionDivider}
RECOMMENDED STEPS
${sectionDivider}
1. Click the portal link above to inspect local storage usage.
2. Navigate to the local Web Admin console -> Protect tab -> check size of recovery points.
3. If necessary, adjust backup retention policies or prune old recovery points.`;
    }

    if (typeLower === 'offline') {
        return `${divider}
BACKUPWATCH ALERT: APPLIANCE OFFLINE
${divider}

Appliance:  ${params.deviceName}
Client:     ${params.companyName}

The backup appliance ${params.deviceName} has stopped communicating with Datto cloud monitoring.

${sectionDivider}
ALERT DETAILS
${sectionDivider}
Heartbeat Status: Offline (No communication)
Last Contact Time: ${params.lastCheckinTime || "Unknown"} (${params.lastSeenHeartbeat || "Unknown"} ago)

${sectionDivider}
TECHNICAL SUPPORT INFO
${sectionDivider}
${commonInfo}

${sectionDivider}
RECOMMENDED STEPS
${sectionDivider}
1. Verify if the client site is experiencing an internet outage or power outage.
2. Attempt to ping the appliance IP address locally if VPN is active.
3. If the appliance is online locally but not checking in, check local outbound firewall rules.`;
    }

    if (typeLower === 'paused') {
        return `${divider}
BACKUPWATCH ALERT: BACKUP AGENT PAUSED
${divider}

Appliance:  ${params.deviceName}
Agent:      ${params.agentName || "Unknown Agent"}
Client:     ${params.companyName}

The backup agent ${params.agentName || "Unknown Agent"} has been paused on the appliance ${params.deviceName}. Backups will not run for this agent until it is resumed.

${sectionDivider}
ALERT DETAILS
${sectionDivider}
Status: Paused
Last Seen Heartbeat: ${params.lastSeenHeartbeat || "Unknown"}

${sectionDivider}
TECHNICAL SUPPORT INFO
${sectionDivider}
${commonInfo}

${sectionDivider}
RECOMMENDED STEPS
${sectionDivider}
1. Log in to the Datto Partner Portal using the link above.
2. Check if the agent was paused intentionally for maintenance or decommissioning.
3. If it should be running, resume backups on the Datto appliance console.`;
    }

    if (typeLower === 'offsitesync') {
        return `${divider}
BACKUPWATCH ALERT: OFFSITE SYNC ISSUE
${divider}

Appliance:  ${params.deviceName}
Client:     ${params.companyName}

The appliance ${params.deviceName} is experiencing issues syncing its backup recovery points to the Datto Cloud.

${sectionDivider}
ALERT DETAILS
${sectionDivider}
Offsite Status: Sync Issues Detected
Last Seen Heartbeat: ${params.lastSeenHeartbeat || "Unknown"}

${sectionDivider}
TECHNICAL SUPPORT INFO
${sectionDivider}
${commonInfo}

${sectionDivider}
RECOMMENDED STEPS
${sectionDivider}
1. Click the portal link above to check offsite synchronization status.
2. Check if the appliance has adequate outbound internet bandwidth or if sync throttle limits are configured too low.
3. Verify if there is a massive recovery point queued for offsite sync that is blocking the queue.`;
    }

    // Fallback description
    return `${divider}
BACKUPWATCH ALERT: ${issueType.toUpperCase()}
${divider}

Appliance:  ${params.deviceName}
Client:     ${params.companyName}
${params.agentName ? `Agent:      ${params.agentName}\n` : ""}
Description:
${params.errorMessage || "No description provided."}

${sectionDivider}
TECHNICAL SUPPORT INFO
${sectionDivider}
${commonInfo}`;
}

const handle = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log.info("Processing ticket escalation request...");

    const userSec = requireAuthenticatedUser(context, req);
    if (!userSec) return;
    if (!userSec.isAuthorizedForModification) {
        context.res = {
            status: 403,
            body: { error: "Access Denied: Your assigned role (Viewer) does not have permission to escalate tickets." },
            headers: { "Content-Type": "application/json" }
        };
        return;
    }

    // 1. Parse and Validate Request Payload
    const {
        companyName,
        deviceName,
        serialNumber,
        issueType,
        agentName,
        description,
        lastSeenMessage,
        
        // Rich Payload Fields
        errorMessage,
        screenshotUrl,
        lastBackupTime,
        screenshotTime,
        usedStorageGB,
        totalStorageGB,
        storageUsedPercent,
        lastCheckin,
        model
    } = req.body || {};

    if (!companyName || !deviceName || !serialNumber || !issueType || !description) {
        context.res = {
            status: 400,
            body: {
                error: "Missing required fields in request body: companyName, deviceName, serialNumber, issueType, and description are required."
            },
            headers: { "Content-Type": "application/json" }
        };
        return;
    }

    // Change freeze (BW-007 / D-02): only Administrators, with a reason, may escalate during a blackout
    const escalationTarget = `${companyName} - ${deviceName}${agentName ? ` - ${agentName}` : ""}`;
    const freeze = await requireNoChangeFreeze(context, req, userSec, `Escalate ${issueType}`, escalationTarget);
    if (!freeze) return;
    const writeCtx: IAutotaskWriteContext = {
        origin: "user",
        action: "Manual escalation",
        deviceName,
        agentName,
        user: { email: userSec.email, role: userSec.role },
        blackoutOverrideReason: freeze.overrideReason
    };

    // 2. Resolve AutoTask Credentials
    const autotaskConfig = getAutoTaskConfig();
    if (!autotaskConfig) {
        context.res = {
            status: 500,
            body: {
                error: "AutoTask credentials are not configured on the server. Please define AUTOTASK_USER, AUTOTASK_SECRET, and AUTOTASK_INTEGRATION_CODE."
            },
            headers: { "Content-Type": "application/json" }
        };
        return;
    }

    try {
        const ticketsTableClient = await getTableClient("TrackedTickets");
        
        // 3. Compute IssueKey
        let issueKey = "";
        const issueTypeLower = issueType.toLowerCase();
        if (agentName) {
            issueKey = `agent:${agentName}:${issueTypeLower}`;
        } else {
            issueKey = issueTypeLower; // e.g. "storage" or "offline"
        }

        // 4. Check for Existing Active Ticket
        let existingEntity: ITrackedTicketEntity | null = null;
        try {
            existingEntity = await ticketsTableClient.getEntity<ITrackedTicketEntity>(serialNumber, issueKey);
        } catch (tableErr: any) {
            // 404 is expected if no ticket has been tracked yet
            if (tableErr.statusCode !== 404) {
                context.log.error("Failed to check Table Storage for existing ticket:", tableErr.message || tableErr);
            }
        }

        if (existingEntity) {
            // Verify if the ticket is still open in AutoTask
            const ticketIdNum = parseInt(existingEntity.ticketId);
            if (!isNaN(ticketIdNum)) {
                const atTickets = await queryTicketsInAutoTask([ticketIdNum], autotaskConfig);
                const atTicket = atTickets && atTickets[0];

                if (atTicket && atTicket.status !== 5) {
                    // Ticket is still active in AutoTask! Prevent duplicate.
                    context.log.info(`Active ticket already exists in AutoTask: TicketID=${existingEntity.ticketId}, Status=${atTicket.status}`);
                    
                    // Add update note if error message changed
                    if (lastSeenMessage && lastSeenMessage !== existingEntity.lastSeenMessage) {
                        const noteAdded = await createTicketNoteInAutoTask(ticketIdNum, {
                            title: "BackupWatch Alert Update",
                            description: `The alert details have changed.\n\nNew Message:\n${lastSeenMessage}`
                        }, autotaskConfig, writeCtx);

                        if (noteAdded) {
                            existingEntity.lastSeenMessage = lastSeenMessage;
                            await ticketsTableClient.updateEntity(existingEntity);
                            context.log.info(`Successfully added update note to ticket #${existingEntity.ticketId}`);
                        }
                    }

                    context.res = {
                        status: 200,
                        body: {
                            ticketId: existingEntity.ticketId,
                            status: "Active",
                            message: "Active ticket already exists in AutoTask. Duplicate creation skipped."
                        },
                        headers: { "Content-Type": "application/json" }
                    };
                    return;
                } else if (atTicket && atTicket.status === 5) {
                    // Ticket was closed in AutoTask! Prune our record.
                    await ticketsTableClient.deleteEntity(serialNumber, issueKey);
                    context.log.info(`Pruned completed ticket #${existingEntity.ticketId} from tracking table.`);
                }
            }
        }

        // 5. Look up Mapped Company and Configuration Item (Asset)
        let companyID: number | null = null;
        let configurationItemID: number | undefined = undefined;

        // Try mapping the company by name first (case-insensitive & fuzzy fallback)
        companyID = await lookupCompanyInAutoTask(companyName, autotaskConfig);
        if (companyID !== null && companyID !== undefined && !isNaN(companyID)) {
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
        if (companyID === null || companyID === undefined || isNaN(companyID)) {
            const catchAllId = process.env.AUTOTASK_CATCHALL_COMPANY_ID;
            if (catchAllId !== null && catchAllId !== undefined && catchAllId.trim() !== "") {
                companyID = parseInt(catchAllId);
                context.log.warn(`Company lookup failed. Using Catch-all Company ID: ${companyID}`);
            } else {
                throw new Error(`Could not resolve company mapping in AutoTask for "${companyName}" (Serial: ${serialNumber}) and no AUTOTASK_CATCHALL_COMPANY_ID is configured.`);
            }
        }

        // 6. Dynamic Contract lookup for active "Datto BCDR"
        let contractID: number | undefined = undefined;
        if (companyID !== null && companyID !== undefined && !isNaN(companyID)) {
            const resolvedContractId = await lookupContractInAutoTask(companyID, "Datto BCDR", autotaskConfig);
            if (resolvedContractId) {
                contractID = resolvedContractId;
                context.log.info(`Found active "Datto BCDR" contract for CompanyID=${companyID}: ContractID=${contractID}`);
            } else {
                context.log.warn(`No active "Datto BCDR" contract found for CompanyID=${companyID}. Escalating without contract...`);
            }
        }

        // 7. Format Jargon-Free Description using templates
        const relativeHeartbeat = computeRelativeTime(lastCheckin);
        const lastCheckinTime = lastCheckin ? new Date(lastCheckin * 1000).toLocaleString() : undefined;

        const ticketDescription = formatTicketDescription(issueType, {
            deviceName,
            agentName,
            companyName,
            errorMessage: errorMessage || description,
            lastBackupTime,
            lastSeenHeartbeat: relativeHeartbeat,
            serialNumber,
            model,
            screenshotTime,
            screenshotUrl,
            usedStorageGB,
            totalStorageGB,
            storageUsedPercent,
            lastCheckinTime
        });

        // 8. Create Ticket in AutoTask with extended field categorizations
        let ticketTitle = "";
        if (issueType.toLowerCase() === "screenshot") {
            ticketTitle = agentName
                ? `SCREENSHOT FAILED for ${agentName} on ${deviceName}`
                : `SCREENSHOT FAILED for ${deviceName}`;
        } else {
            ticketTitle = agentName
                ? `CRITICAL ERROR for ${agentName} on ${deviceName}`
                : `CRITICAL ERROR for ${deviceName}`;
        }

        const routing = await getAutotaskRoutingConfig();

        const queueID = routing.queueId !== undefined ? routing.queueId : (process.env.AUTOTASK_QUEUE_ID ? parseInt(process.env.AUTOTASK_QUEUE_ID) : undefined);
        const ticketCategory = routing.categoryId !== undefined ? routing.categoryId : (process.env.AUTOTASK_CATEGORY_ID ? parseInt(process.env.AUTOTASK_CATEGORY_ID) : undefined);
        const priority = routing.priorityId !== undefined ? routing.priorityId : 2;
        const ticketType = process.env.AUTOTASK_TICKET_TYPE_ID ? parseInt(process.env.AUTOTASK_TICKET_TYPE_ID) : undefined;
        const source = process.env.AUTOTASK_SOURCE_ID ? parseInt(process.env.AUTOTASK_SOURCE_ID) : undefined;
        const allocationCodeID = routing.workTypeId !== undefined ? routing.workTypeId : (process.env.AUTOTASK_WORK_TYPE_ID ? parseInt(process.env.AUTOTASK_WORK_TYPE_ID) : undefined);
        const issueTypeID = routing.issueTypeId !== undefined ? routing.issueTypeId : (process.env.AUTOTASK_ISSUE_TYPE_ID ? parseInt(process.env.AUTOTASK_ISSUE_TYPE_ID) : undefined);
        const subIssueTypeID = routing.subIssueTypeId !== undefined ? routing.subIssueTypeId : (process.env.AUTOTASK_SUB_ISSUE_TYPE_ID ? parseInt(process.env.AUTOTASK_SUB_ISSUE_TYPE_ID) : undefined);

        const newTicketId = await createTicketInAutoTask({
            title: ticketTitle,
            description: ticketDescription,
            companyID,
            configurationItemID,
            queueID: queueID && !isNaN(queueID) ? queueID : undefined,
            ticketCategory: ticketCategory && !isNaN(ticketCategory) ? ticketCategory : undefined,
            priority: priority,
            ticketType: ticketType && !isNaN(ticketType) ? ticketType : undefined,
            source: source && !isNaN(source) ? source : undefined,
            allocationCodeID: allocationCodeID && !isNaN(allocationCodeID) ? allocationCodeID : undefined,
            issueType: issueTypeID && !isNaN(issueTypeID) ? issueTypeID : undefined,
            subIssueType: subIssueTypeID && !isNaN(subIssueTypeID) ? subIssueTypeID : undefined,
            contractID
        }, autotaskConfig, writeCtx);

        if (!newTicketId) {
            throw new Error("AutoTask API returned a null or empty Ticket ID.");
        }

        context.log.info(`Successfully created AutoTask Ticket #${newTicketId}`);

        // 9. Resolve ticketNumber and ticketUrl
        let ticketNumber: string = String(newTicketId);
        let ticketUrl: string = "";
        try {
            const baseUrl = await getAutoTaskBaseUrl(autotaskConfig.user);
            ticketUrl = getAutoTaskTicketUrl(baseUrl, newTicketId);
            const atTicket = await getSingleTicketFromAutoTask(newTicketId, autotaskConfig);
            if (atTicket && atTicket.ticketNumber) {
                ticketNumber = atTicket.ticketNumber;
            }
        } catch (lookupErr: any) {
            context.log.warn(`Could not resolve ticketNumber for #${newTicketId}: ${lookupErr.message}`);
        }

        // 10. Record State in Table Storage
        const newEntity: ITrackedTicketEntity = {
            partitionKey: serialNumber,
            rowKey: issueKey,
            ticketId: String(newTicketId),
            ticketNumber,
            ticketUrl,
            status: "New",
            lastSeenMessage: lastSeenMessage || "",
            createdTime: new Date().toISOString()
        };

        await ticketsTableClient.createEntity(newEntity);
        context.log.info(`Successfully recorded ticket #${newTicketId} (${ticketNumber}) in TrackedTickets table.`);

        try {
            const auditTableClient = await getTableClient("AuditLogs");
            const userEmail = userSec.email;
            const logEntity = {
                partitionKey: "AuditLog",
                rowKey: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                userEmail: userEmail,
                userRole: userSec.role,
                action: "Manual Escalation",
                target: `${companyName} - ${deviceName}${agentName ? ` - ${agentName}` : ""}`,
                details: `[Role: ${userSec.role}] Ticket: ${ticketNumber} (ID: ${newTicketId}), Issue: ${issueType}, Msg: ${description}`,
                createdTime: new Date().toISOString()
            };
            await auditTableClient.createEntity(logEntity);
        } catch (auditErr: any) {
            context.log.error("Failed to write escalation audit log:", auditErr.message || auditErr);
        }

        context.res = {
            status: 201,
            body: {
                ticketId: String(newTicketId),
                ticketNumber,
                ticketUrl,
                status: "New",
                message: "Ticket created and tracked successfully."
            },
            headers: { "Content-Type": "application/json" }
        };

    } catch (err: any) {
        if (err instanceof AutotaskWriteBlockedError) {
            context.res = {
                status: 403,
                body: { error: err.message, code: err.code },
                headers: { "Content-Type": "application/json" }
            };
            return;
        }
        context.log.error("Failed to escalate issue to AutoTask:", err.message || err);
        context.res = {
            status: 500,
            body: {
                error: "Failed to escalate issue to AutoTask.",
                details: err.message || err
            },
            headers: { "Content-Type": "application/json" }
        };
    }
};

// Engineer actions: their Autotask calls go ahead of background scanner calls (BW-004).
const httpTrigger: AzureFunction = (context: Context, req: HttpRequest) => runAsUserAction(() => handle(context, req));

export default httpTrigger;
