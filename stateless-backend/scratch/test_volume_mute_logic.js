const { normalizeVolumeName, buildVolumeTargetKey, isVolumeExcluded, isDeviceMuted } = require("../dist/shared/volumeUtils");

const assert = require("assert");

console.log("=== Testing Volume Normalization ===");
assert.strictEqual(normalizeVolumeName("F:\\"), "F");
assert.strictEqual(normalizeVolumeName("F:"), "F");
assert.strictEqual(normalizeVolumeName("F"), "F");
assert.strictEqual(normalizeVolumeName("f"), "F");
assert.strictEqual(normalizeVolumeName("f:/"), "F");
assert.strictEqual(normalizeVolumeName("C:\\Data\\"), "C:/DATA");
assert.strictEqual(normalizeVolumeName("/var/log/"), "/VAR/LOG");
console.log("✔ All volume normalization tests passed!");

console.log("\n=== Testing Target Key Construction ===");
assert.strictEqual(
    buildVolumeTargetKey("FIF-DATTO-01", "FIF-DC-02", "F:\\"),
    "fif-datto-01:fif-dc-02:f"
);
assert.strictEqual(
    buildVolumeTargetKey("FIF-DATTO-01", "FIF-DC-02", "F"),
    "fif-datto-01:fif-dc-02:f"
);
console.log("✔ Target key construction tests passed!");

console.log("\n=== Testing Volume Exclusion Matching ===");
const exclusions = [
    {
        type: "Volume",
        target: "FIF-DATTO-01:FIF-DC-02:F:\\",
        reason: "Test exclusion",
        ticketNumber: "12345"
    }
];

// Querying with "F" should match "F:\"
const matchF = isVolumeExcluded(exclusions, "FIF-DATTO-01", "FIF-DC-02", "F");
assert(matchF !== undefined, "Failed to match F with F:\\ in exclusions");
assert.strictEqual(matchF.ticketNumber, "12345");

// Querying with "F:\" should match
const matchFSlash = isVolumeExcluded(exclusions, "FIF-DATTO-01", "FIF-DC-02", "F:\\");
assert(matchFSlash !== undefined, "Failed to match F:\\ with F:\\ in exclusions");

// Querying different volume should return undefined
const matchC = isVolumeExcluded(exclusions, "FIF-DATTO-01", "FIF-DC-02", "C:\\");
assert.strictEqual(matchC, undefined, "C:\\ should not match F:\\ exclusion");
console.log("✔ Volume exclusion matching tests passed!");

console.log("\n=== Testing Strict Separation of Device Mute vs Volume Exclusion ===");
const deviceMutedExclusions = [
    {
        type: "Device",
        target: "ICE-DATTO2",
        reason: "Entire appliance muted"
    }
];

// 1. isDeviceMuted should return the device mute entity
const devMute = isDeviceMuted(deviceMutedExclusions, "ICE-DATTO2");
assert(devMute !== undefined, "isDeviceMuted should match ICE-DATTO2");
assert.strictEqual(devMute.reason, "Entire appliance muted");

// 2. isVolumeExcluded MUST NOT return the device mute (drives must NOT be counted as volume exclusions)
const volOnMutedDev = isVolumeExcluded(deviceMutedExclusions, "ICE-DATTO2", "MEMSYS3", "C:\\");
assert.strictEqual(volOnMutedDev, undefined, "Volume exclusion lookup must return undefined for device-only mute!");

console.log("✔ Device mute and volume exclusion separation verified!");
console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");
