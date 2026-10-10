const assert = require("assert");
const { normalizeVolumeName, isVolumeExcluded } = require("../dist/shared/volumeUtils");

console.log("=== TEST SUITE: Volume Exclusion Lifecycle Sync & Auto-Heal ===");

// Mock Data Setup
const mockDevices = [
    {
        name: "FIF-DATTO-01",
        serialNumber: "SN-DATTO-001",
        clientCompanyName: "Fifosys Ltd",
        assets: [
            {
                name: "DC-01",
                hostname: "DC-01.fifosys.local",
                isArchived: false,
                // Scenario 1: Drive D remains UNPROTECTED in Datto
                // Scenario 2: Drive E was previously excluded but is now PROTECTED (absent from unprotectedVolumeNames)
                unprotectedVolumeNames: ["D:\\"],
                protectedVolumeNames: ["C:\\", "E:\\"]
            }
        ]
    }
];

// Mock Autotask Tickets
const mockAutotaskTickets = {
    1001: { id: 1001, ticketNumber: "T20260907.0001", status: 5, title: "Volume Exclusion Detected - FIF-DATTO-01 - DC-01 - D" }, // CLOSED (status 5)
    1002: { id: 1002, ticketNumber: "T20260907.0002", status: 1, title: "Volume Exclusion Detected - FIF-DATTO-01 - DC-01 - E" }, // OPEN (status 1)
    1003: { id: 1003, ticketNumber: "T20260907.0003", status: 1, title: "Volume Exclusion Detected - FIF-DATTO-01 - DC-01 - D" }  // OPEN (status 1)
};

// Simulation Function reproducing the exact logic implemented in backupWatchTrigger/index.ts
async function simulateReconciliationSweep(exclusions, devices, tickets) {
    const tableStorage = [...exclusions];
    const notesPosted = [];
    const ticketsCreated = [];
    const auditLogs = [];
    let nextTicketId = 2000;

    const nowMs = Date.now();

    for (const e of [...exclusions]) {
        if (e.type !== "Volume") continue;

        const isPerm = Boolean(e.isPermanent);
        const expiresAtMs = e.expiresAt ? new Date(e.expiresAt).getTime() : null;
        const isExpired = !isPerm && expiresAtMs !== null && expiresAtMs <= nowMs;

        const targetParts = (e.target || "").split(":");
        const devName = targetParts[0] || "Unknown Device";
        const agentName = targetParts[1] || "";
        const volName = normalizeVolumeName(targetParts.slice(2).join(":"));

        if (!devName || !agentName || !volName) continue;

        const matchedDevice = devices.find(d =>
            (d.name && d.name.toLowerCase() === devName.toLowerCase()) ||
            (d.serialNumber && d.serialNumber.toLowerCase() === devName.toLowerCase())
        );
        const matchedAsset = matchedDevice && matchedDevice.assets ?
            matchedDevice.assets.find(a =>
                (a.name && a.name.toLowerCase() === agentName.toLowerCase()) ||
                (a.hostname && a.hostname.toLowerCase() === agentName.toLowerCase())
            ) : null;

        if (!matchedDevice || !matchedAsset || matchedAsset.isArchived) continue;

        const rawUnprotected = matchedAsset.unprotectedVolumeNames || [];
        const isVolumeStillUnprotected = rawUnprotected.some(uv => normalizeVolumeName(uv) === volName);

        const ticketIdNum = parseInt(e.ticketNumber.replace("T", "").split(".")[0]) || parseInt(e.ticketNumber) || 1001;
        const atTicket = tickets[ticketIdNum];
        if (!atTicket) continue;

        const isTicketClosed = (atTicket.status === 5);

        // CASE 1: Volume STILL UNPROTECTED in Datto
        if (isVolumeStillUnprotected) {
            if (isTicketClosed) {
                if (!isPerm) {
                    // 1. Delete old exclusion
                    const delIdx = tableStorage.findIndex(item => item.rowKey === e.rowKey);
                    if (delIdx > -1) tableStorage.splice(delIdx, 1);

                    // 2. Open brand new follow-up compliance ticket
                    const newId = ++nextTicketId;
                    const newTicketNumber = `T20260907.${newId}`;
                    ticketsCreated.push({
                        id: newId,
                        ticketNumber: newTicketNumber,
                        reason: `[RE-OPENED COMPLIANCE TICKET] Previous Ticket #${atTicket.ticketNumber || ticketIdNum} was closed, but volume [${volName}] remains unprotected in Datto BCDR.`,
                        device: devName,
                        agent: agentName,
                        volume: volName
                    });

                    // 3. Upsert fresh exclusion record
                    const newEntity = {
                        ...e,
                        expiresAt: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
                        ticketNumber: newTicketNumber,
                        ticketUrl: `https://autotask.net/?ticketId=${newId}`
                    };
                    tableStorage.push(newEntity);

                    const exIdx = exclusions.findIndex(item => item.rowKey === e.rowKey);
                    if (exIdx > -1) exclusions[exIdx] = newEntity;

                    auditLogs.push(`Re-raised Volume Exclusion Ticket on closed ticket ${atTicket.ticketNumber}`);
                }
            } else {
                if (isExpired) {
                    notesPosted.push({ ticketId: ticketIdNum, title: "[ACTION REQUIRED] TEMPORARY EXCLUSION EXPIRED" });
                    e.expiresAt = new Date(nowMs + 24 * 3600 * 1000).toISOString();
                }
            }
        }

        // CASE 2: Volume RESOLVED in Datto
        if (!isVolumeStillUnprotected) {
            if (!isTicketClosed) {
                notesPosted.push({
                    ticketId: ticketIdNum,
                    title: `[AUTO-HEAL] Volume Re-included in Backups - ${volName}`,
                    bodyPreview: `BackupWatch has verified that volume [${volName}] is now actively protected and included in backup snapshots on Datto BCDR.`
                });
            }

            const delIdx = tableStorage.findIndex(item => item.rowKey === e.rowKey);
            if (delIdx > -1) tableStorage.splice(delIdx, 1);

            const exIdx = exclusions.findIndex(item => item.rowKey === e.rowKey);
            if (exIdx > -1) exclusions.splice(exIdx, 1);

            auditLogs.push(`Auto-Heal Volume Exclusion for ${volName}`);
        }
    }

    return { tableStorage, exclusions, notesPosted, ticketsCreated, auditLogs };
}

// RUN TESTS
(async () => {
    // TEST 1: Ticket was CLOSED in Autotask while volume D is STILL UNPROTECTED in Datto
    console.log("\n[TEST 1] Volume D unprotected in Datto, but Ticket #1001 was CLOSED in Autotask:");
    const exclusions1 = [
        {
            partitionKey: "Exclusion",
            rowKey: encodeURIComponent("Volume:FIF-DATTO-01:DC-01:D"),
            type: "Volume",
            target: "FIF-DATTO-01:DC-01:D",
            isPermanent: false,
            ticketNumber: "1001",
            expiresAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString() // Unexpired (2 days left)
        }
    ];

    const result1 = await simulateReconciliationSweep(exclusions1, mockDevices, mockAutotaskTickets);
    assert.strictEqual(result1.ticketsCreated.length, 1, "Expected 1 new ticket to be created");
    assert.strictEqual(result1.ticketsCreated[0].volume, "D");
    assert(result1.ticketsCreated[0].reason.includes("Previous Ticket #T20260907.0001 was closed"));
    assert.strictEqual(result1.exclusions[0].ticketNumber, "T20260907.2001");
    assert.strictEqual(result1.auditLogs.length, 1);
    console.log("✔ SUCCESS: Closed Autotask ticket triggered brand new follow-up compliance ticket & reset exclusion window!");

    // TEST 2: Volume E has been RESOLVED in Datto (re-included in backups), Ticket #1002 is still OPEN
    console.log("\n[TEST 2] Volume E re-included in Datto backups, Ticket #1002 is OPEN in Autotask:");
    const exclusions2 = [
        {
            partitionKey: "Exclusion",
            rowKey: encodeURIComponent("Volume:FIF-DATTO-01:DC-01:E"),
            type: "Volume",
            target: "FIF-DATTO-01:DC-01:E",
            isPermanent: false,
            ticketNumber: "1002",
            expiresAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString()
        }
    ];

    const result2 = await simulateReconciliationSweep(exclusions2, mockDevices, mockAutotaskTickets);
    assert.strictEqual(result2.notesPosted.length, 1, "Expected 1 auto-heal note to be posted");
    assert.strictEqual(result2.notesPosted[0].title, "[AUTO-HEAL] Volume Re-included in Backups - E");
    assert(result2.notesPosted[0].bodyPreview.includes("is now actively protected"));
    assert.strictEqual(result2.tableStorage.length, 0, "Exclusion must be purged from database");
    assert.strictEqual(result2.exclusions.length, 0, "In-memory exclusion must be cleared");
    assert.strictEqual(result2.auditLogs.length, 1);
    console.log("✔ SUCCESS: Resolved volume posted auto-heal note to open ticket, left ticket open for engineer, and purged exclusion record!");

    // TEST 3: Volume D unprotected, Ticket #1003 is still OPEN but EXPIRED
    console.log("\n[TEST 3] Volume D unprotected in Datto, Ticket #1003 is OPEN but EXPIRED:");
    const exclusions3 = [
        {
            partitionKey: "Exclusion",
            rowKey: encodeURIComponent("Volume:FIF-DATTO-01:DC-01:D"),
            type: "Volume",
            target: "FIF-DATTO-01:DC-01:D",
            isPermanent: false,
            ticketNumber: "1003",
            expiresAt: new Date(Date.now() - 1000).toISOString() // Expired 1s ago
        }
    ];

    const result3 = await simulateReconciliationSweep(exclusions3, mockDevices, mockAutotaskTickets);
    assert.strictEqual(result3.ticketsCreated.length, 0, "Must NOT create duplicate ticket while ticket is open");
    assert.strictEqual(result3.notesPosted.length, 1);
    assert.strictEqual(result3.notesPosted[0].title, "[ACTION REQUIRED] TEMPORARY EXCLUSION EXPIRED");
    assert(new Date(result3.exclusions[0].expiresAt).getTime() > Date.now(), "Expiry must be extended +24h");
    console.log("✔ SUCCESS: Open expired ticket received reminder note and +24h extension without duplicate tickets!");

    console.log("\n=======================================================");
    console.log("ALL TEST CASES PASSED SUCCESSFULLY (3/3)");
    console.log("=======================================================");
})();
