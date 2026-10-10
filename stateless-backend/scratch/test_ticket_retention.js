const assert = require("assert");
const { normalizeVolumeName, buildVolumeTargetKey, isVolumeExcluded } = require("../dist/shared/volumeUtils");

console.log("=== Testing Exclusions Ticket Number Retention ===");

// Simulate Azure Table Storage DB
const mockTableStorage = new Map();

// Helper simulating the backend POST /api/exclusions logic
async function mockPostExclusion(reqBody) {
    const { type, target, reason, isPermanent, durationDays, ticketNumber: reqTicketNumber } = reqBody;
    
    let ticketNumber = reqTicketNumber || null;
    let ticketUrl = null;
    let newTicketCreated = false;
    let notePushed = false;

    let normalizedTarget = target;
    if (type === "Volume") {
        const targetParts = target.split(":");
        const deviceName = targetParts[0] || "Unknown";
        const agentName = targetParts[1] || "";
        const volumeName = normalizeVolumeName(targetParts.slice(2).join(":"));
        normalizedTarget = `${deviceName}:${agentName}:${volumeName}`;
    }

    const rowKey = encodeURIComponent(`${type}:${normalizedTarget}`);

    // Lookup existing entity in DB
    let existingEntity = mockTableStorage.get(rowKey) || null;

    if (existingEntity) {
        if (!ticketNumber && existingEntity.ticketNumber) {
            ticketNumber = existingEntity.ticketNumber;
        }
        if (!ticketUrl && existingEntity.ticketUrl) {
            ticketUrl = existingEntity.ticketUrl;
        }
    }

    if (type === "Volume") {
        if (!ticketNumber) {
            // Brand new volume exclusion - creates compliance ticket
            newTicketCreated = true;
            ticketNumber = "T20260817.0001";
            ticketUrl = `https://ww16.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc/Index?ticketId=99999`;
        } else {
            // Existing ticket - pushes worklog note
            notePushed = true;
        }
    }

    const entity = {
        partitionKey: "Exclusion",
        rowKey: rowKey,
        type: type,
        target: normalizedTarget,
        reason: reason,
        isPermanent: Boolean(isPermanent),
        ticketNumber: ticketNumber,
        ticketUrl: ticketUrl
    };

    mockTableStorage.set(rowKey, entity);

    return { entity, newTicketCreated, notePushed };
}

async function runTests() {
    // 1. Initial exclusion creation (e.g. from background scanner or user dashboard)
    const initialRes = await mockPostExclusion({
        type: "Volume",
        target: "FIF-DATTO-01:FIF-DC-02:F:\\",
        reason: "",
        isPermanent: false,
        durationDays: 3
    });

    assert.strictEqual(initialRes.newTicketCreated, true, "Initial creation should create a ticket");
    assert.strictEqual(initialRes.notePushed, false);
    assert.strictEqual(initialRes.entity.ticketNumber, "T20260817.0001");
    console.log("✔ Step 1: Initial volume exclusion created ticket #T20260817.0001");

    // 2. User edits the note in the dashboard (simulating frontend update without passing ticketNumber)
    const updateResWithoutTicket = await mockPostExclusion({
        type: "Volume",
        target: "FIF-DATTO-01:FIF-DC-02:F", // Normalized target variation
        reason: "Decommissioned log partition",
        isPermanent: true
    });

    assert.strictEqual(updateResWithoutTicket.newTicketCreated, false, "Editing note MUST NOT create a new ticket!");
    assert.strictEqual(updateResWithoutTicket.notePushed, true, "Editing note MUST push a note to existing ticket!");
    assert.strictEqual(updateResWithoutTicket.entity.ticketNumber, "T20260817.0001", "Ticket number must be retained!");
    assert.strictEqual(updateResWithoutTicket.entity.reason, "Decommissioned log partition");
    console.log("✔ Step 2: Editing note without ticket in payload correctly retained ticket #T20260817.0001 and pushed update note without creating a new ticket!");

    // 3. User edits note again with ticket passed by updated frontend
    const updateResWithTicket = await mockPostExclusion({
        type: "Volume",
        target: "FIF-DATTO-01:FIF-DC-02:F:\\",
        reason: "Decommissioned log partition - final archive",
        isPermanent: true,
        ticketNumber: "T20260817.0001"
    });

    assert.strictEqual(updateResWithTicket.newTicketCreated, false);
    assert.strictEqual(updateResWithTicket.notePushed, true);
    assert.strictEqual(updateResWithTicket.entity.ticketNumber, "T20260817.0001");
    console.log("✔ Step 3: Editing note with ticket in payload correctly pushed update note!");

    // 4. A different, genuinely new volume is excluded
    const newVolRes = await mockPostExclusion({
        type: "Volume",
        target: "FIF-DATTO-01:FIF-DC-02:E:\\",
        reason: "Pagefile drive",
        isPermanent: true
    });

    assert.strictEqual(newVolRes.newTicketCreated, true, "Genuinely new volume should create a ticket");
    console.log("✔ Step 4: Genuinely new volume created ticket normally!");

    console.log("\n🎉 ALL UNIT INTEGRATION TESTS PASSED!");
}

runTests().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
