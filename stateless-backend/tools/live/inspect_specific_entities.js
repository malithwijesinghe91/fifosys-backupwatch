// LIVE SCRIPT - reads production Table Storage (read-only). Requires --confirm-live. See README.md.
const { requireLiveConfirmation } = require("./liveGuard");
const connStr = requireLiveConfirmation("inspect_specific_entities.js");

const { TableClient } = require("@azure/data-tables");

async function inspectEntities() {
    try {
        console.log("Connecting to Azure Table Storage (read-only inspection)...");

        // 1. Inspect Exclusions table
        const exclusionsClient = TableClient.fromConnectionString(connStr, "Exclusions");
        console.log("\n--- EXCLUSIONS TABLE ENTITIES FOR 'WS-CZC1119JX4' ---");
        const exclusionsIter = exclusionsClient.listEntities();
        let foundExclusions = 0;
        for await (const entity of exclusionsIter) {
            const str = JSON.stringify(entity);
            if (str.includes("WS-CZC1119JX4") || str.includes("T20260907.0203") || str.includes("T20260930.0194")) {
                foundExclusions++;
                console.log({
                    partitionKey: entity.partitionKey,
                    rowKey: entity.rowKey,
                    type: entity.type,
                    target: entity.target,
                    isPermanent: entity.isPermanent,
                    ticketNumber: entity.ticketNumber,
                    ticketUrl: entity.ticketUrl,
                    reason: entity.reason,
                    expiresAt: entity.expiresAt,
                    createdTime: entity.createdTime
                });
            }
        }
        if (foundExclusions === 0) {
            console.log("No matching entities found in Exclusions table.");
        }

        // 2. Inspect TrackedTickets table
        const ticketsClient = TableClient.fromConnectionString(connStr, "TrackedTickets");
        console.log("\n--- TRACKED TICKETS TABLE ENTITIES FOR 'WS-CZC1119JX4' OR TICKET NUMBERS ---");
        const ticketsIter = ticketsClient.listEntities();
        let foundTickets = 0;
        for await (const entity of ticketsIter) {
            const str = JSON.stringify(entity);
            if (str.includes("WS-CZC1119JX4") || str.includes("T20260907.0203") || str.includes("T20260930.0194")) {
                foundTickets++;
                console.log({
                    partitionKey: entity.partitionKey,
                    rowKey: entity.rowKey,
                    ticketId: entity.ticketId,
                    ticketNumber: entity.ticketNumber,
                    status: entity.status
                });
            }
        }
        if (foundTickets === 0) {
            console.log("No matching entities found in TrackedTickets table.");
        }

    } catch (err) {
        console.error("Inspection error:", err.message || err);
    }
}

inspectEntities();
