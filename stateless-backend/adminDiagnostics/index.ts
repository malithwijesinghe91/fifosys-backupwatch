import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import axios from "axios";
import { getUserSecurityContext } from "../shared/auth";
import { getTableClient } from "../shared/tableService";

import { APP_VERSION } from "../shared/version";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const userSec = getUserSecurityContext(req);
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
        envConfig: {
            dattoKey:       process.env.DATTO_KEY          ? "Set" : "Missing",
            autotaskUser:   process.env.AT_USER            ? "Set" : "Missing",
            autotaskSecret: process.env.AT_SECRET          ? "Set" : "Missing",
            storageConn:    process.env.AzureWebJobsStorage ? "Set" : "Missing",
        },
        autotask: {
            status: "Unknown",
            latencyMs: null,
            configured: false
        },
        datto: {
            status: process.env.DATTO_KEY ? "Configured" : "Not Configured"
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

    // 1. Autotask API health — inline lightweight ping, no shared module dependency
    const atUser = process.env.AT_USER;
    if (atUser) {
        diagnostics.autotask.configured = true;
        const atStart = Date.now();
        try {
            await axios.get(
                `https://webservices.autotask.net/atservicesrest/v1.0/zoneInformation?user=${encodeURIComponent(atUser)}`,
                { timeout: 8000 }
            );
            diagnostics.autotask.latencyMs = Date.now() - atStart;
            diagnostics.autotask.status = "Healthy (200 OK)";
        } catch (atErr: any) {
            diagnostics.autotask.latencyMs = Date.now() - atStart;
            diagnostics.autotask.status = `Degraded (${atErr.message || "Error"})`;
        }
    } else {
        diagnostics.autotask.status = "Not Configured";
    }

    // 2. Azure Table Storage entity counts
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

    // 3. Background scanner heartbeat
    try {
        const statusTable = await getTableClient("ScanStatus");
        const statusEntity = await statusTable.getEntity<any>("Scan", "Status");
        if (statusEntity) {
            diagnostics.scanner.lastScan = statusEntity.lastScanTime || statusEntity.lastRunTime || null;
            diagnostics.scanner.status = statusEntity.status || "Healthy";
            if (diagnostics.scanner.lastScan) {
                const lastMs = new Date(diagnostics.scanner.lastScan).getTime();
                diagnostics.scanner.nextScan = new Date(lastMs + 30 * 60 * 1000).toISOString();
            }
        }
    } catch {
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
};

export default httpTrigger;

