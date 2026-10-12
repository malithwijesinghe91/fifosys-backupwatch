/**
 * Change freeze guard for user-initiated changes (BW-007, decision D-02:
 * "a change freeze or a blackout is a blackout").
 *
 * While the global blackout is active, every change endpoint (escalate, mute/exclude, unmute)
 * is blocked for Specialist, Contributor and Viewer. An Administrator may still act by sending
 * `overrideBlackout: true` and a non-empty `overrideReason` in the request body; each override is
 * written to the audit trail as "Change During Blackout".
 *
 * Admin Console settings (routing, alert matrix, blackout on/off, orphan cleanup) are already
 * Administrator-only and are how the freeze is managed, so they are not guarded here.
 */
import { Context, HttpRequest } from "@azure/functions";
import { getGlobalMaintenanceMode } from "./configService";
import { getTableClient } from "./tableService";
import type { IUserSecurityContext } from "./auth";

export interface IChangeFreezeClearance {
    /** Set when an Administrator overrode an active freeze. Pass on to Autotask write contexts. */
    overrideReason?: string;
}

/**
 * Returns a clearance if the change may proceed. Otherwise sets a 403 response on context.res
 * and returns null – the caller must stop.
 */
export async function requireNoChangeFreeze(
    context: Context,
    req: HttpRequest,
    user: IUserSecurityContext,
    actionLabel: string,
    target: string
): Promise<IChangeFreezeClearance | null> {
    const maint = await getGlobalMaintenanceMode();
    if (!maint || !maint.isActive) return {};

    const until = maint.expiresAt
        ? ` until ${new Date(maint.expiresAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}`
        : "";
    const why = maint.reason ? ` (${maint.reason})` : "";

    if (user.role !== "Administrator") {
        context.log.warn(`[Change Freeze] Blocked ${actionLabel} on ${target} by ${user.email} (${user.role}).`);
        context.res = {
            status: 403,
            body: {
                error: `Change freeze active${until}${why}. Only Administrators can make changes during a blackout.`,
                code: "CHANGE_FREEZE",
                maintenanceMode: maint
            },
            headers: { "Content-Type": "application/json" }
        };
        return null;
    }

    const body = req.body || {};
    const reason = typeof body.overrideReason === "string" ? body.overrideReason.trim() : "";
    if (body.overrideBlackout !== true || !reason) {
        context.res = {
            status: 403,
            body: {
                error: `Change freeze active${until}${why}. Administrators must give a reason to override it.`,
                code: "CHANGE_FREEZE_REASON_REQUIRED",
                maintenanceMode: maint
            },
            headers: { "Content-Type": "application/json" }
        };
        return null;
    }

    try {
        const audit = await getTableClient("AuditLogs");
        await audit.createEntity({
            partitionKey: "AuditLog",
            rowKey: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            userEmail: user.email,
            userRole: user.role,
            action: "Change During Blackout",
            target,
            details: `${actionLabel} during change freeze. Reason: ${reason}`,
            createdTime: new Date().toISOString()
        });
    } catch (err: any) {
        // The override is only allowed if it can be audited.
        context.log.error(`[Change Freeze] Failed to audit override by ${user.email}: ${err.message || err}`);
        context.res = {
            status: 500,
            body: { error: "Could not record the change-freeze override in the audit trail, so the change was not made." },
            headers: { "Content-Type": "application/json" }
        };
        return null;
    }

    context.log.info(`[Change Freeze] ${user.email} overrode the freeze for ${actionLabel} on ${target}.`);
    return { overrideReason: reason };
}
