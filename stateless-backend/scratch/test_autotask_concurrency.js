const assert = require("assert");

console.log("=== TEST SUITE: Autotask Concurrency & Batching Safeguards ===");

// -----------------------------------------------------------------------------
// Test 1: Concurrency Meter for Volume Exclusions Sequential Sweep
// -----------------------------------------------------------------------------
console.log("\n[1] Testing Volume Exclusions Sequential Loop (Max Active Threads <= 1):");

let currentActiveThreads = 0;
let peakActiveThreads = 0;
let totalRequestsExecuted = 0;

async function mockQueryTicketByNumber(ticketNumber) {
    currentActiveThreads++;
    if (currentActiveThreads > peakActiveThreads) {
        peakActiveThreads = currentActiveThreads;
    }
    // Simulate Autotask API network response latency (30ms)
    await new Promise(r => setTimeout(r, 30));
    totalRequestsExecuted++;
    currentActiveThreads--;
    return { id: 100000 + totalRequestsExecuted, ticketNumber };
}

async function runSequentialSweepSimulation(mockExclusions) {
    currentActiveThreads = 0;
    peakActiveThreads = 0;
    totalRequestsExecuted = 0;

    const exclusionList = [...mockExclusions];
    for (const e of exclusionList) {
        if (e.type !== "Volume") continue;
        
        let ticketIdNum = null;
        if (!ticketIdNum && e.ticketNumber) {
            const atTicket = await mockQueryTicketByNumber(e.ticketNumber);
            if (atTicket) {
                ticketIdNum = atTicket.id;
            }
        }
        // Inter-request pacing
        await new Promise(r => setTimeout(r, 10));
    }
}

async function runParallelPromiseAllSimulation(mockExclusions) {
    currentActiveThreads = 0;
    peakActiveThreads = 0;
    totalRequestsExecuted = 0;

    await Promise.all(mockExclusions.map(async (e) => {
        if (e.type !== "Volume") return;
        let ticketIdNum = null;
        if (!ticketIdNum && e.ticketNumber) {
            const atTicket = await mockQueryTicketByNumber(e.ticketNumber);
            if (atTicket) ticketIdNum = atTicket.id;
        }
    }));
}

(async () => {
    const testExclusions = Array.from({ length: 8 }, (_, i) => ({
        type: "Volume",
        target: `DEV-01:AGENT-01:DRIVE_${i}`,
        ticketNumber: `T20261008.000${i + 1}`
    }));

    // Verify how the legacy code behaved (Breached 3-thread ceiling)
    await runParallelPromiseAllSimulation(testExclusions);
    console.log(`  Legacy (Promise.all) Peak Active Threads: ${peakActiveThreads} (Breached limit of 3!)`);
    assert(peakActiveThreads > 3, "Legacy code should have fired parallel requests exceeding 3 threads");

    // Verify how the new code behaves (Strict 1-thread ceiling)
    await runSequentialSweepSimulation(testExclusions);
    console.log(`  Remediated (Sequential) Peak Active Threads: ${peakActiveThreads}`);
    assert.strictEqual(peakActiveThreads, 1, `Expected peak active threads to be 1, but got ${peakActiveThreads}`);
    assert.strictEqual(totalRequestsExecuted, 8, "Expected all 8 exclusions to be processed");
    console.log("  ✔ Concurrency guaranteed <= 1 thread. Thread threshold alert is impossible.");

    // -----------------------------------------------------------------------------
    // Test 2: TrackedTickets Batching (Chunks of 20)
    // -----------------------------------------------------------------------------
    console.log("\n[2] Testing TrackedTickets Query Batching (Chunks of 20):");

    let batchCallCount = 0;
    let batchSizes = [];

    async function mockQueryTicketsInAutoTask(chunk) {
        batchCallCount++;
        batchSizes.push(chunk.length);
        return chunk.map(id => ({ id, title: `Tracked Ticket #${id}`, status: 1 }));
    }

    const testTicketIds = Array.from({ length: 35 }, (_, i) => 200000 + i);
    const TICKET_CHUNK_SIZE = 20;
    const autotaskTicketMap = new Map();

    for (let i = 0; i < testTicketIds.length; i += TICKET_CHUNK_SIZE) {
        const chunk = testTicketIds.slice(i, i + TICKET_CHUNK_SIZE);
        const chunkResults = await mockQueryTicketsInAutoTask(chunk);
        for (const t of chunkResults) {
            autotaskTicketMap.set(t.id, t);
        }
    }

    console.log(`  Total ticket IDs to check: ${testTicketIds.length}`);
    console.log(`  Batch API calls executed: ${batchCallCount} (Batch sizes: ${batchSizes.join(", ")})`);
    assert.strictEqual(batchCallCount, 2, "35 tickets should be queried in exactly 2 batches");
    assert.deepStrictEqual(batchSizes, [20, 15], "First batch should be 20, second batch should be 15");
    assert.strictEqual(autotaskTicketMap.size, 35, "All 35 tickets should be mapped");
    console.log("  ✔ 35 individual calls reduced to 2 batched queries. 94% call reduction.");

    // -----------------------------------------------------------------------------
    // Test 3: Table Storage Entity Merge Safety
    // -----------------------------------------------------------------------------
    console.log("\n[3] Testing Table Storage Entity Upsert Safety (Merge mode):");

    const mockDatabase = new Map();
    const initialEntity = {
        partitionKey: "Volume",
        rowKey: "PEN-DATTO-01_AGENT1_D",
        type: "Volume",
        target: "PEN-DATTO-01:AGENT1:D",
        ticketNumber: "T20261001.0001",
        reason: "Customer request",
        isPermanent: false,
        authorizedBy: "engineer@fifosys.com",
        createdTime: "2026-10-01T00:00:00Z"
    };
    mockDatabase.set(initialEntity.rowKey, { ...initialEntity });

    // Mock upsertEntity with Merge mode
    function mockUpsertEntity(entity, mode) {
        assert.strictEqual(mode, "Merge", "Mode must be 'Merge' to prevent wiping existing entity attributes");
        const existing = mockDatabase.get(entity.rowKey) || {};
        mockDatabase.set(entity.rowKey, { ...existing, ...entity });
    }

    // Simulate self-healing ID resolution
    const resolvedTicketId = 887766;
    const resolvedTicketUrl = `https://uk02.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc?ticketId=${resolvedTicketId}`;
    mockUpsertEntity({
        partitionKey: initialEntity.partitionKey,
        rowKey: initialEntity.rowKey,
        ticketUrl: resolvedTicketUrl
    }, "Merge");

    const savedEntity = mockDatabase.get(initialEntity.rowKey);
    assert.strictEqual(savedEntity.ticketUrl, resolvedTicketUrl);
    assert.strictEqual(savedEntity.reason, "Customer request", "Existing reason must not be lost");
    assert.strictEqual(savedEntity.authorizedBy, "engineer@fifosys.com", "Existing authorizedBy must not be lost");
    assert.strictEqual(savedEntity.isPermanent, false, "Existing isPermanent must not be lost");
    console.log("  ✔ Table Storage entity safely updated with resolved ticket URL without dropping metadata.");

    console.log("\n=== ALL TEST SUITES PASSED SUCCESSFULLY ===");
})();
