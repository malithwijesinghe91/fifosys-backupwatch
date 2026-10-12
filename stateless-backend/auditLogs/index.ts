import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { getTableClient } from "../shared/tableService";
import { getAutoTaskConfig, getTicketStatusPicklistValues } from "../shared/autotask";
import { requireAuthenticatedUser } from "../shared/auth";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const userSec = requireAuthenticatedUser(context, req);
    if (!userSec) return;
    if (!userSec.isAuthorizedForAuditLogs) {
        context.res = {
            status: 403,
            body: { error: "Access Denied: Your assigned role (Viewer) does not have permission to view audit logs." },
            headers: { "Content-Type": "application/json" }
        };
        return;
    }

    try {
        const tableClient = await getTableClient("AuditLogs");
        const logs: any[] = [];
        const entities = tableClient.listEntities();
        
        for await (const entity of entities) {
            logs.push({
                id: entity.rowKey,
                userEmail: entity.userEmail || "unknown@fifosys.com",
                userRole: entity.userRole || null,
                action: entity.action,
                target: entity.target,
                details: entity.details || "",
                createdTime: entity.createdTime || entity.timestamp
            });
        }
        
        // Sort descending by createdTime
        logs.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

        // Query and persist Autotask status picklists immediately on call
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

        context.res = {
            status: 200,
            body: logs,
            headers: { "Content-Type": "application/json" }
        };
    } catch (err: any) {
        context.log.error("Failed to fetch audit logs:", err.message || err);
        context.res = {
            status: 500,
            body: { error: err.message || "Failed to fetch audit logs." }
        };
    }
};

export default httpTrigger;
