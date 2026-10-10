const { TableClient } = require("@azure/data-tables");
const localSettings = require("../local.settings.json");

const connectionString = localSettings.Values.AzureWebJobsStorage;

async function checkStatus() {
    console.log("=== CHECKING LIVE SYSTEM STATUS (READ-ONLY) ===");
    try {
        const client = TableClient.fromConnectionString(connectionString, "ScanStatus");
        const entity = await client.getEntity("Status", "BCDRScanner");
        console.log("Last Scan (UK Time):", entity.lastScan);
        console.log("Next Scan (UK Time):", entity.nextScan);
        console.log("Status:             ", entity.status);
        console.log("Updated Time:       ", entity.updatedTime);
    } catch (e) {
        console.log("Could not fetch ScanStatus:", e.message);
    }

    try {
        const exclClient = TableClient.fromConnectionString(connectionString, "Exclusions");
        const entities = exclClient.listEntities();
        let count = 0;
        let withTicketUrl = 0;
        for await (const e of entities) {
            count++;
            if (e.ticketUrl && e.ticketUrl.includes("ticketId=")) {
                withTicketUrl++;
            }
        }
        console.log(`Total Exclusions in DB: ${count}`);
        console.log(`Exclusions with cached numeric ticketId: ${withTicketUrl}`);
    } catch (e) {
        console.log("Could not list Exclusions:", e.message);
    }
}

checkStatus();
