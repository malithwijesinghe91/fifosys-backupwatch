import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { getUserSecurityContext } from "../shared/auth";
import { getAutoTaskConfig, getTicketFieldPicklistValues, IPicklistValue } from "../shared/autotask";
import { getAutotaskRoutingConfig, saveAutotaskRoutingConfig, getAlertRoutingMatrix, saveAlertRoutingMatrix } from "../shared/configService";
import { getTableClient } from "../shared/tableService";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const userSec = getUserSecurityContext(req);
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
        const alertMatrix = await getAlertRoutingMatrix();
        const atConfig = getAutoTaskConfig();

        let queues: IPicklistValue[] = [];
        let categories: IPicklistValue[] = [];
        let priorities: IPicklistValue[] = [
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
                context.log.warn("Failed to fetch live picklists from Autotask, returning fallbacks:", pickErr.message || pickErr);
            }
        }

        // Live verified Autotask defaults if picklists were empty or unavailable
        if (queues.length === 0) {
            queues = [
                { value: 29683488, label: "Backup" },
                { value: 29683489, label: "Backup - IRM" },
                { value: 29682833, label: "Tier 1 Support" },
                { value: 29682969, label: "Tier 2 Support" },
                { value: 29683511, label: "Monitoring Testing" },
                { value: 29683519, label: "Service Delivery" }
            ];
        }
        if (categories.length === 0) {
            categories = [
                { value: 115, label: "Other Backup Alert" },
                { value: 103, label: "SD Incident" },
                { value: 114, label: "Other Maintenance Alert" }
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
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store, no-cache, must-revalidate"
            }
        };
        return;
    }

    if (method === "post") {
        const { queueId, queueName, priorityId, categoryId, workTypeId, issueTypeId, subIssueTypeId, alertMatrix } = req.body || {};

        if (queueId !== undefined && isNaN(Number(queueId))) {
            context.res = {
                status: 400,
                body: { error: "Invalid queueId provided." }
            };
            return;
        }

        const newConfig = {
            queueId: queueId !== undefined ? Number(queueId) : undefined,
            queueName: queueName ? String(queueName) : undefined,
            priorityId: priorityId !== undefined ? Number(priorityId) : 2,
            categoryId: categoryId !== undefined ? Number(categoryId) : undefined,
            workTypeId: workTypeId !== undefined ? Number(workTypeId) : undefined,
            issueTypeId: issueTypeId !== undefined ? Number(issueTypeId) : undefined,
            subIssueTypeId: subIssueTypeId !== undefined ? Number(subIssueTypeId) : undefined
        };

        await saveAutotaskRoutingConfig(newConfig, userSec.email);

        if (alertMatrix && typeof alertMatrix === "object") {
            await saveAlertRoutingMatrix(alertMatrix, userSec.email);
        }

        const updatedMatrix = await getAlertRoutingMatrix();

        // Audit Trail entry
        try {
            const auditTable = await getTableClient("AuditLogs");
            await auditTable.createEntity({
                partitionKey: "AuditLog",
                rowKey: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                userEmail: userSec.email,
                action: "Update Autotask Live Routing",
                target: "Autotask/SystemConfig",
                details: `Queue: ${newConfig.queueName || newConfig.queueId || "Default"} (ID: ${newConfig.queueId}), Priority: ${newConfig.priorityId}, Category: ${newConfig.categoryId}`,
                createdTime: new Date().toISOString()
            });
        } catch (auditErr: any) {
            context.log.warn("Failed to log audit entry for routing update:", auditErr.message || auditErr);
        }

        context.res = {
            status: 200,
            body: {
                message: "Autotask routing configuration saved successfully.",
                currentRouting: newConfig,
                alertMatrix: updatedMatrix
            },
            headers: { "Content-Type": "application/json" }
        };
        return;
    }

    context.res = {
        status: 405,
        body: { error: `Method ${method} not allowed.` }
    };
};

export default httpTrigger;

