/**
 * Live-data guard for tools/live scripts.
 * Refuses to run unless --confirm-live is passed, then prints the target storage
 * account name (AccountName only - never the key or the full connection string).
 */
const fs = require("fs");
const path = require("path");

const LOCAL_SETTINGS_PATH = path.join(__dirname, "../../local.settings.json");

/** Extracts only the AccountName from a storage connection string (never returns the key). */
function accountNameFrom(connStr) {
    if (/UseDevelopmentStorage=true/i.test(connStr || "")) return "devstoreaccount1 (local Azurite emulator)";
    const match = (connStr || "").match(/(?:^|;)\s*AccountName=([^;]+)/i);
    return match ? match[1].trim() : null;
}

function requireLiveConfirmation(scriptName) {
    if (!process.argv.includes("--confirm-live")) {
        console.error(`[LIVE GUARD] ${scriptName} reads LIVE production Table Storage.`);
        console.error(`[LIVE GUARD] Refusing to run. Re-run with --confirm-live if you really mean it:`);
        console.error(`    node tools/live/${scriptName} --confirm-live`);
        process.exit(1);
    }

    if (!fs.existsSync(LOCAL_SETTINGS_PATH)) {
        console.error(`[LIVE GUARD] ${LOCAL_SETTINGS_PATH} not found.`);
        process.exit(1);
    }
    const settings = JSON.parse(fs.readFileSync(LOCAL_SETTINGS_PATH, "utf8"));
    const connStr = (settings.Values && (settings.Values.AzureWebJobsStorage || settings.Values.DEPLOYMENT_STORAGE_CONNECTION_STRING)) || "";

    const accountName = accountNameFrom(connStr);
    if (!accountName) {
        console.error("[LIVE GUARD] Could not determine AccountName from AzureWebJobsStorage. Refusing to run.");
        process.exit(1);
    }

    console.log(`[LIVE GUARD] Target storage account: ${accountName}`);
    console.log(`[LIVE GUARD] Mode: READ-ONLY`);
    return connStr;
}

module.exports = { requireLiveConfirmation, accountNameFrom };
