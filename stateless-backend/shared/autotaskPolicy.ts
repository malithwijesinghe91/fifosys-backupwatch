/**
 * Autotask write policy (BW-006 / BW-007, decisions D-01 and D-02).
 *
 * Every Autotask write (new ticket, ticket note, ticket status change) carries an
 * IAutotaskWriteContext and is checked here before it is sent:
 *
 * 1. Global blackout / change freeze (D-02):
 *    - automatic (scanner) writes are suppressed;
 *    - user writes are allowed only for an Administrator who gave an override reason.
 * 2. Silence (D-01): automatic writes for a silenced appliance or agent are suppressed.
 *    User actions are not blocked by silence – the engineer is acting on purpose (for example,
 *    the note recording a mute is posted to the mute's own ticket).
 *
 * Suppressed automatic writes are logged and written to the audit trail ("Suppressed Autotask
 * Write"), at most once per item every 6 hours so a 30-minute scan doesn't flood the log.
 * Callers that change table state after a write (auto-heal, expiry sweep) check
 * getScannerSuppression() first, so nothing is deleted while its Autotask write is held back.
 */
import { getGlobalMaintenanceMode } from "./configService";
import { getTableClient } from "./tableService";
import { isAgentSilenced, isDeviceSilenced, IExclusionEntityLike } from "./volumeUtils";
import type { UserRole } from "./auth";

export interface IAutotaskWriteContext {
    origin: "scanner" | "user";
    /** Short label for logs and the audit trail, e.g. "Auto-heal note". */
    action: string;
    deviceName?: string;
    agentName?: string;
    /** Required when origin is "user". */
    user?: { email: string; role: UserRole };
    /** Administrator's reason for acting during a change freeze. */
    blackoutOverrideReason?: string;
}

export type AutotaskWriteDecision =
    | { allowed: true }
    | { allowed: false; code: "CHANGE_FREEZE" | "SILENCED"; reason: string };

export class AutotaskWriteBlockedError extends Error {
    readonly code: "CHANGE_FREEZE";
    constructor(message: string) {
        super(message);
        this.name = "AutotaskWriteBlockedError";
        this.code = "CHANGE_FREEZE";
    }
}

type IExclusionLike = IExclusionEntityLike;

const SILENCE_CACHE_TTL_MS = 10 * 1000;
let silenceCache: { exclusions: IExclusionLike[]; loadedAt: number } | null = null;

async function loadExclusions(): Promise<IExclusionLike[]> {
    const now = Date.now();
    if (silenceCache && now - silenceCache.loadedAt < SILENCE_CACHE_TTL_MS) return silenceCache.exclusions;
    const list: IExclusionLike[] = [];
    const table = await getTableClient("Exclusions");
    for await (const e of table.listEntities<any>()) {
        list.push({ type: e.type, target: e.target });
    }
    silenceCache = { exclusions: list, loadedAt: now };
    return list;
}

/** Call after a mute/unmute so the next write sees the change immediately. */
export function invalidateSilenceCache(): void {
    silenceCache = null;
}

/**
 * Decides whether a write may be sent. `exclusions` can be passed by callers that already hold
 * the current list (the scanner); otherwise it is read from Table Storage (10 s cache).
 */
export async function evaluateAutotaskWrite(ctx: IAutotaskWriteContext, exclusions?: IExclusionLike[]): Promise<AutotaskWriteDecision> {
    const maint = await getGlobalMaintenanceMode();
    if (maint && maint.isActive) {
        const until = maint.expiresAt ? ` until ${new Date(maint.expiresAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}` : "";
        if (ctx.origin === "scanner") {
            return { allowed: false, code: "CHANGE_FREEZE", reason: `Change freeze (global blackout) active${until}` };
        }
        const isAdmin = ctx.user && ctx.user.role === "Administrator";
        const hasReason = !!(ctx.blackoutOverrideReason && ctx.blackoutOverrideReason.trim());
        if (!isAdmin || !hasReason) {
            return {
                allowed: false,
                code: "CHANGE_FREEZE",
                reason: isAdmin
                    ? `Change freeze active${until}. A reason is required to override it.`
                    : `Change freeze active${until}. Only Administrators can make changes.`
            };
        }
    }

    if (ctx.origin === "scanner" && ctx.deviceName) {
        let list = exclusions;
        if (!list) {
            try {
                list = await loadExclusions();
            } catch (err: any) {
                // Can't confirm the item isn't silenced: hold the write back rather than risk it.
                return { allowed: false, code: "SILENCED", reason: `Silence status unavailable (${err.message || err})` };
            }
        }
        const silenced = ctx.agentName
            ? isAgentSilenced(list, ctx.deviceName, ctx.agentName)
            : isDeviceSilenced(list, ctx.deviceName);
        if (silenced) {
            const what = ctx.agentName && !isDeviceSilenced(list, ctx.deviceName) ? "Agent" : "Appliance";
            return { allowed: false, code: "SILENCED", reason: `${what} is silenced` };
        }
    }

    return { allowed: true };
}

/** Same decision, for scanner code that must skip table changes when the write is held back. */
export async function getScannerSuppression(deviceName: string, agentName: string | undefined, exclusions?: IExclusionLike[]): Promise<AutotaskWriteDecision> {
    return evaluateAutotaskWrite({ origin: "scanner", action: "check", deviceName, agentName }, exclusions);
}

const AUDIT_DEDUPE_MS = 6 * 60 * 60 * 1000;
const lastAudited = new Map<string, number>();

async function recordSuppressed(ctx: IAutotaskWriteContext, reason: string): Promise<void> {
    const target = [ctx.deviceName, ctx.agentName].filter(Boolean).join(":") || "Global";
    console.log(`[Autotask Policy] Suppressed ${ctx.action} for ${target}: ${reason}`);

    const key = `${ctx.action}|${target}|${reason}`.toLowerCase();
    const now = Date.now();
    const last = lastAudited.get(key);
    if (last && now - last < AUDIT_DEDUPE_MS) return;
    lastAudited.set(key, now);

    try {
        const audit = await getTableClient("AuditLogs");
        await audit.createEntity({
            partitionKey: "AuditLog",
            rowKey: `${now}-${Math.random().toString(36).substring(2, 9)}`,
            userEmail: "system@fifosys.com",
            action: "Suppressed Autotask Write",
            target,
            details: `${ctx.action} held back: ${reason}. It will be sent on a later scan once allowed.`,
            createdTime: new Date(now).toISOString()
        });
    } catch (err: any) {
        console.warn(`[Autotask Policy] Failed to write suppression audit entry: ${err.message || err}`);
    }
}

/**
 * Applies the policy for one write. Returns true if the write may go ahead.
 * Automatic writes that are not allowed return false (and are recorded); user writes that are
 * not allowed throw AutotaskWriteBlockedError so the endpoint can report it.
 */
export async function guardAutotaskWrite(ctx: IAutotaskWriteContext): Promise<boolean> {
    const decision = await evaluateAutotaskWrite(ctx);
    if (decision.allowed) return true;
    if (ctx.origin === "user") throw new AutotaskWriteBlockedError(decision.reason);
    await recordSuppressed(ctx, decision.reason);
    return false;
}

/** Test hook: clear caches and audit de-duplication. */
export function __resetAutotaskPolicyForTests(): void {
    silenceCache = null;
    lastAudited.clear();
}
