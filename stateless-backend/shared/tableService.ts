import { TableClient } from "@azure/data-tables";

const connectionString = process.env.AzureWebJobsStorage || "UseDevelopmentStorage=true";

// Helper to get TableClient. It automatically creates the table if it doesn't exist.
const clientInstances: { [key: string]: TableClient } = {};

export async function getTableClient(customTableName?: string): Promise<TableClient> {
    const tableName = customTableName || "Exclusions";
    
    if (clientInstances[tableName]) {
        return clientInstances[tableName];
    }

    try {
        const client = TableClient.fromConnectionString(connectionString, tableName);
        await client.createTable();
        clientInstances[tableName] = client;
        return client;
    } catch (err: any) {
        // Table may already exist, ignore and return client
        if (err.statusCode === 409 || err.message?.includes("TableAlreadyExists")) {
            const client = TableClient.fromConnectionString(connectionString, tableName);
            clientInstances[tableName] = client;
            return client;
        }
        console.error(`Failed to initialize Azure Table Client for ${tableName}:`, err.message || err);
        throw err;
    }
}

