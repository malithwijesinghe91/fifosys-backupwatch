const assert = require("assert");
const { normalizeVolumeName, buildVolumeTargetKey, isVolumeExcluded } = require("../dist/shared/volumeUtils");

console.log("=== TEST SUITE: Volume Normalization & Deduplication ===");

// 1. Test canonical volume normalization across multiple OS formats
console.log("\n[1] Testing Volume Normalization Edge Cases:");
const rawVariations = ["D", "d", "D:", "d:", "D:\\", "d:\\", "D:/", "d:/", "D:\\\\", "D://"];
for (const v of rawVariations) {
    const normalized = normalizeVolumeName(v);
    assert.strictEqual(normalized, "D", `Expected "${v}" to normalize to "D", but got "${normalized}"`);
}
console.log(`✔ All ${rawVariations.length} drive variations normalized to "D"`);

// 2. Test array deduplication
console.log("\n[2] Testing Array Deduplication:");
const testArray = ["D", "D:\\", "E:", "e:\\", "E", "D:/", "F:\\Data\\", "F:/Data"];
const deduplicated = Array.from(new Set(testArray.map(v => normalizeVolumeName(v)).filter(Boolean)));
console.log("Input Array: ", testArray);
console.log("Deduplicated:", deduplicated);
assert.deepStrictEqual(deduplicated, ["D", "E", "F:/DATA"]);
console.log("✔ Array deduplicated properly with 0 redundant items");

// 3. Test volume exclusion matching between raw and normalized targets
console.log("\n[3] Testing isVolumeExcluded Matching across variations:");
const mockExclusions = [
    {
        type: "Volume",
        target: "PEN-DATTO-01:WS-CZC1119JX4:D",
        ticketNumber: "T20260814.0187"
    }
];

// Querying with different variations should all match the stored exclusion
assert(isVolumeExcluded(mockExclusions, "PEN-DATTO-01", "WS-CZC1119JX4", "D") !== undefined);
assert(isVolumeExcluded(mockExclusions, "PEN-DATTO-01", "WS-CZC1119JX4", "D:\\") !== undefined);
assert(isVolumeExcluded(mockExclusions, "PEN-DATTO-01", "WS-CZC1119JX4", "d:") !== undefined);
assert(isVolumeExcluded(mockExclusions, "PEN-DATTO-01", "WS-CZC1119JX4", "d:/") !== undefined);
assert.strictEqual(isVolumeExcluded(mockExclusions, "PEN-DATTO-01", "WS-CZC1119JX4", "E"), undefined);
console.log("✔ Volume exclusion matches accurately regardless of query string formatting");

// 4. Test simulated background loop deduplication behavior
console.log("\n[4] Testing Simulated Auto-Ticket Loop:");
const incomingAssetVolumes = ["D", "D:\\", "d:", "D:/"];
const uniqueVols = Array.from(new Set(incomingAssetVolumes.map(v => normalizeVolumeName(v)).filter(Boolean)));

let createdTickets = [];
const dynamicExclusions = [];

for (const normalizedVol of uniqueVols) {
    const excl = isVolumeExcluded(dynamicExclusions, "PEN-DATTO-01", "WS-CZC1119JX4", normalizedVol);
    if (!excl) {
        // Mock createComplianceTicket
        const newTicketId = 1000 + createdTickets.length + 1;
        createdTickets.push({
            ticketId: newTicketId,
            title: `Volume Exclusion Detected - PEN-DATTO-01 - WS-CZC1119JX4 - ${normalizedVol}`,
            volume: normalizedVol
        });
        dynamicExclusions.push({
            type: "Volume",
            target: `PEN-DATTO-01:WS-CZC1119JX4:${normalizedVol}`,
            ticketNumber: `T20260902.${newTicketId}`
        });
    }
}

assert.strictEqual(createdTickets.length, 1, `Expected exactly 1 ticket to be created, but created ${createdTickets.length}`);
assert.strictEqual(createdTickets[0].volume, "D");
assert.strictEqual(createdTickets[0].title, "Volume Exclusion Detected - PEN-DATTO-01 - WS-CZC1119JX4 - D");
console.log("✔ Loop processing only created exactly 1 ticket for all variations of volume D:", createdTickets[0]);

console.log("\n=======================================================");
console.log("🎉 ALL VOLUME DEDUPLICATION TESTS PASSED SUCCESSFULLY!");
console.log("=======================================================");
