const assert = require('assert');

function simulateExclusionPost(reqBody, existingEntity) {
    const { type, target, reason, isPermanent, durationDays, ticketNumber: reqTicketNumber } = reqBody || {};

    if (!type || !target || !reason) {
        return { status: 400, error: "Parameters 'type', 'target', and 'reason' are required." };
    }

    if (type !== "Device" && type !== "Agent" && type !== "Volume") {
        return { status: 400, error: "Parameter 'type' must be 'Device', 'Agent', or 'Volume'." };
    }

    let ticketNumber = reqTicketNumber || null;
    let ticketUrl = null;

    if (existingEntity) {
        if (!ticketNumber && existingEntity.ticketNumber) {
            ticketNumber = existingEntity.ticketNumber;
        }
        if (!ticketUrl && existingEntity.ticketUrl) {
            ticketUrl = existingEntity.ticketUrl;
        }
    }

    // Ticket Number is mandatory for all exclusions/silences
    if (!ticketNumber || !ticketNumber.trim()) {
        return {
            status: 400,
            error: "Autotask Ticket Number ('ticketNumber') is mandatory for all silence and exclusion requests."
        };
    }
    ticketNumber = ticketNumber.trim();

    return {
        status: 201,
        entity: {
            type,
            target,
            reason,
            ticketNumber,
            ticketUrl
        }
    };
}

console.log("--- TEST 1: POST Device Silence without ticketNumber ---");
const res1 = simulateExclusionPost({
    type: "Device",
    target: "TestDevice",
    reason: "Maintenance",
    ticketNumber: ""
}, null);
assert.strictEqual(res1.status, 400);
assert.strictEqual(res1.error, "Autotask Ticket Number ('ticketNumber') is mandatory for all silence and exclusion requests.");
console.log("PASS: Rejected missing ticketNumber for Device silence.");

console.log("--- TEST 2: POST Agent Silence with whitespace ticketNumber ---");
const res2 = simulateExclusionPost({
    type: "Agent",
    target: "TestDevice:VM1",
    reason: "Maintenance",
    ticketNumber: "   "
}, null);
assert.strictEqual(res2.status, 400);
console.log("PASS: Rejected whitespace ticketNumber for Agent silence.");

console.log("--- TEST 3: POST Volume Exclusion with valid ticketNumber ---");
const res3 = simulateExclusionPost({
    type: "Volume",
    target: "TestDevice:VM1:C:\\",
    reason: "Temporary drive exclusion",
    ticketNumber: "T20260820.0001"
}, null);
assert.strictEqual(res3.status, 201);
assert.strictEqual(res3.entity.ticketNumber, "T20260820.0001");
console.log("PASS: Successfully accepted valid ticketNumber for Volume exclusion.");

console.log("--- TEST 4: POST Note Update retaining existing ticketNumber ---");
const res4 = simulateExclusionPost({
    type: "Volume",
    target: "TestDevice:VM1:C:\\",
    reason: "Updated note"
}, { ticketNumber: "T20260820.0001", ticketUrl: "https://autotask.net/..." });
assert.strictEqual(res4.status, 201);
assert.strictEqual(res4.entity.ticketNumber, "T20260820.0001");
console.log("PASS: Successfully retained existing ticketNumber on note update.");

console.log("\nALL TESTS PASSED SUCCESSFULLY!");
