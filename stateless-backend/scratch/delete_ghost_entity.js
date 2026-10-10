const { TableClient } = require("@azure/data-tables");
const fs = require("fs");
const path = require("path");

async function deleteDuplicateEntity() {
    try {
        const localSettingsPath = path.join(__dirname, "../local.settings.json");
        const settings = JSON.parse(fs.readFileSync(localSettingsPath, "utf8"));
        const connStr = settings.Values.AzureWebJobsStorage || settings.Values.DEPLOYMENT_STORAGE_CONNECTION_STRING;

        console.log("Connecting to Azure Table Storage to delete ghost exclusion entity...");
        const exclusionsClient = TableClient.fromConnectionString(connStr, "Exclusions");

        const partitionKey = "Exclusion";
        const rowKeyToDelete = "Volume%3APEN-DATTO-01%3AWS-CZC1119JX4%3AD%3A%5C";

        // Double check existence before delete
        try {
            const entity = await exclusionsClient.getEntity(partitionKey, rowKeyToDelete);
            console.log("Found entity to delete:", {
                rowKey: entity.rowKey,
                target: entity.target,
                ticketNumber: entity.ticketNumber
            });

            await exclusionsClient.deleteEntity(partitionKey, rowKeyToDelete);
            console.log(`[SUCCESS] Deleted entity with RowKey: ${rowKeyToDelete}`);
        } catch (fetchErr) {
            console.error("Entity not found or already deleted:", fetchErr.message || fetchErr);
        }

        // Log to AuditLogs table for compliance
        try {
            const auditClient = TableClient.fromConnectionString(connStr, "AuditLogs");
            const auditEntity = {
                partitionKey: "AuditLog",
                rowKey: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                userEmail: "system@fifosys.com",
                action: "Cleaned Ghost Volume Exclusion Record",
                target: "PEN-DATTO-01:WS-CZC1119JX4:D:\\",
                details: "Deleted un-normalized twin entity for Ticket #T20260930.0194 to resolve conflict with permanent exclusion #T20260907.0203.",
                createdTime: new Date().toISOString()
            };
            await auditClient.createEntity(auditEntity);
            console.log("[SUCCESS] Audit log recorded.");
        } catch (auditErr) {
            console.warn("Could not write audit log:", auditErr.message);
        }

    } catch (err) {
        console.error("Error executing delete:", err.message || err);
    }
}

deleteDuplicateEntity();
