/**
 * Scan lock (BW-023, decision D-08).
 *
 * Only a scan writes to Autotask: the 30-minute timer scan and the Force Scan button. Flex
 * Consumption runs the timer on its own instance, separate from the dashboard's HTTP instance, so an
 * in-memory flag can't stop the two overlapping. This lock is one Table Storage row
 * (ScanStatus / Lock / BCDRScanner) taken with optimistic concurrency (create, or replace an expired
 * lock by ETag), so exactly one scan holds it at a time across instances.
 *
 * The lock expires after LOCK_TTL_MS so a crashed scan can't block scanning for ever.
 */
import { Context } from "@azure/functions";
import { getTableClient } from "./tableService";

const LOCK_TABLE = "ScanStatus";
const LOCK_PK = "Lock";
const LOCK_RK = "BCDRScanner";

/** Longest a scan may hold the lock. Scans take about 7 s (95% under 16 s); this only matters if one crashes. */
export const LOCK_TTL_MS = 15 * 60 * 1000;

let waitPollMs = 2000;
let waitMaxMs = 120 * 1000;

export interface IScanLockHolder {
    owner: string;
    acquiredAt: string;
}

export type ScanLockOutcome<T> =
    | { ran: true; result: T }
    | { ran: false; busy: IScanLockHolder | null };

const statusOf = (err: any): number | undefined => err && (err.statusCode ?? (err.response && err.response.status));

/** Takes the lock. Returns its ETag, or null when another scan holds it. Throws on storage errors. */
async function acquire(owner: string): Promise<{ etag: string } | { busy: IScanLockHolder | null }> {
    const client = await getTableClient(LOCK_TABLE);
    const now = Date.now();
    const entity = {
        partitionKey: LOCK_PK,
        rowKey: LOCK_RK,
        owner,
        acquiredAt: new Date(now).toISOString(),
        lockedUntil: new Date(now + LOCK_TTL_MS).toISOString()
    };

    try {
        const created: any = await client.createEntity(entity);
        return { etag: created && created.etag };
    } catch (err: any) {
        if (statusOf(err) !== 409) throw err;
    }

    // Someone holds (or held) the lock – take it over only if it has expired.
    let current: any;
    try {
        current = await client.getEntity(LOCK_PK, LOCK_RK);
    } catch (err: any) {
        if (statusOf(err) === 404) return { busy: null }; // released between our create and read – treat as busy, retry later
        throw err;
    }
    const holder: IScanLockHolder = { owner: current.owner || "unknown", acquiredAt: current.acquiredAt || "" };
    const until = Date.parse(current.lockedUntil || "");
    if (!isNaN(until) && until > now) return { busy: holder };

    try {
        const replaced: any = await client.updateEntity(entity, "Replace", { etag: current.etag });
        return { etag: replaced && replaced.etag };
    } catch (err: any) {
        if (statusOf(err) === 412 || statusOf(err) === 409) return { busy: holder };
        throw err;
    }
}

async function release(etag: string, context: Context): Promise<void> {
    try {
        const client = await getTableClient(LOCK_TABLE);
        await client.deleteEntity(LOCK_PK, LOCK_RK, { etag });
    } catch (err: any) {
        const s = statusOf(err);
        // 404: already gone; 412: expired and taken over by another scan – not ours to delete.
        if (s !== 404 && s !== 412) context.log.warn(`[Scan Lock] Could not release the scan lock: ${err.message || err}`);
    }
}

/**
 * Runs `scan` while holding the lock. If another scan holds it, does not run and reports who.
 * If the lock store itself fails, the scan still runs (fail open) – alerts matter more than the
 * small chance of an overlap (D-07).
 */
export async function withScanLock<T>(context: Context, owner: string, scan: () => Promise<T>): Promise<ScanLockOutcome<T>> {
    let lock: { etag: string } | { busy: IScanLockHolder | null };
    try {
        lock = await acquire(owner);
    } catch (err: any) {
        context.log.warn(`[Scan Lock] Lock store unavailable (${err.message || err}); running the scan without the lock.`);
        return { ran: true, result: await scan() };
    }

    if ("busy" in lock) {
        context.log.info(`[Scan Lock] A scan is already running${lock.busy ? ` (${lock.busy.owner}, started ${lock.busy.acquiredAt})` : ""}; ${owner} not started.`);
        return { ran: false, busy: lock.busy };
    }

    try {
        return { ran: true, result: await scan() };
    } finally {
        await release(lock.etag, context);
    }
}

/** Waits until no scan holds the lock (or the wait cap passes). Returns true if the lock was released. */
export async function waitForScanToFinish(context: Context): Promise<boolean> {
    const deadline = Date.now() + waitMaxMs;
    while (Date.now() < deadline) {
        try {
            const client = await getTableClient(LOCK_TABLE);
            const current: any = await client.getEntity(LOCK_PK, LOCK_RK);
            const until = Date.parse(current.lockedUntil || "");
            if (isNaN(until) || until <= Date.now()) return true;
        } catch (err: any) {
            if (statusOf(err) === 404) return true;
            context.log.warn(`[Scan Lock] Could not read the scan lock: ${err.message || err}`);
            return false;
        }
        await new Promise(r => setTimeout(r, waitPollMs));
    }
    return false;
}

/** Test hook: shorten the wait loop. */
export function __setScanLockTimingForTests(pollMs: number, maxMs: number): void {
    waitPollMs = pollMs;
    waitMaxMs = maxMs;
}
