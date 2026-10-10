/**
 * Verification test for 3-Tier Silence & Exclusion Architecture:
 * 1. Tier 1 (Appliance Silence): Total blackout for entire appliance (all agents & drives).
 * 2. Tier 2 (Agent Silence): Total blackout for targeted agent only; sibling agent on same appliance remains active.
 * 3. Tier 3 (Volume Exclusion): Scoped only to single drive letter on active agent.
 */

const { 
    normalizeVolumeName, 
    buildVolumeTargetKey, 
    isVolumeExcluded, 
    isDeviceSilenced, 
    isAgentSilenced 
} = require("../dist/shared/volumeUtils");

console.log("=== 3-TIER SILENCE ARCHITECTURE TEST SUITE ===\n");

// Simulated Database Exclusions
const testExclusions = [
    {
        type: "Device",
        target: "FIF-DATTO-BLACKOUT",
        reason: "Appliance decommissioning"
    },
    {
        type: "Agent",
        target: "FIF-DATTO-ACTIVE:SQL-DECOMMISSIONED",
        reason: "SQL Server migrated to Azure"
    },
    {
        type: "Volume",
        target: "FIF-DATTO-ACTIVE:DC-01:E",
        reason: "Log drive excluded"
    }
];

let allPassed = true;

function assert(condition, testName) {
    if (condition) {
        console.log(`✅ PASS: ${testName}`);
    } else {
        console.error(`❌ FAIL: ${testName}`);
        allPassed = false;
    }
}

// 1. Test Appliance Silence
assert(
    isDeviceSilenced(testExclusions, "FIF-DATTO-BLACKOUT") === true,
    "Appliance 'FIF-DATTO-BLACKOUT' is recognized as silenced"
);
assert(
    isDeviceSilenced(testExclusions, "FIF-DATTO-ACTIVE") === false,
    "Appliance 'FIF-DATTO-ACTIVE' is NOT silenced"
);

// 2. Test Agent Silence on Silenced Appliance (Cascade)
assert(
    isAgentSilenced(testExclusions, "FIF-DATTO-BLACKOUT", "DC-01") === true,
    "Agent on silenced appliance cascades to silenced"
);

// 3. Test Agent Silence on Active Appliance (Tier 2 Isolation)
assert(
    isAgentSilenced(testExclusions, "FIF-DATTO-ACTIVE", "SQL-DECOMMISSIONED") === true,
    "Targeted agent 'SQL-DECOMMISSIONED' is silenced"
);
assert(
    isAgentSilenced(testExclusions, "FIF-DATTO-ACTIVE", "DC-01") === false,
    "Sibling agent 'DC-01' on same active appliance remains ACTIVE"
);

// 4. Test Volume Exclusion on Active Agent (Tier 3 Scoping)
const dc01VolE = isVolumeExcluded(testExclusions, "FIF-DATTO-ACTIVE", "DC-01", "E:\\");
assert(
    dc01VolE !== undefined && dc01VolE.reason === "Log drive excluded",
    "Volume 'E:\\' on DC-01 is correctly recognized as excluded"
);

const dc01VolC = isVolumeExcluded(testExclusions, "FIF-DATTO-ACTIVE", "DC-01", "C:\\");
assert(
    dc01VolC === undefined,
    "Volume 'C:\\' on DC-01 is NOT excluded"
);

console.log("\n===============================================");
if (allPassed) {
    console.log("🎉 ALL 3-TIER SILENCE & EXCLUSION TESTS PASSED (100%)");
} else {
    console.error("💥 SOME TESTS FAILED");
    process.exit(1);
}
