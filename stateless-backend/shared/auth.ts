import { Context, HttpRequest } from "@azure/functions";

export type UserRole = "Viewer" | "Contributor" | "Specialist" | "Administrator";

export interface IUserSecurityContext {
    isAuthenticated: boolean;
    email: string;
    name: string;
    userId?: string;
    /** Raw App Role claim values from the Easy Auth principal (e.g. "BackupWatch.Specialist"). */
    appRoles: string[];
    role: UserRole;
    isAuthorizedForPermanent: boolean;
    isAuthorizedForModification: boolean;
    isAuthorizedForForceRefresh: boolean;
    isAuthorizedForAuditLogs: boolean;
}

/** Entra App Role values defined on the BackupWatch-Backend-API app registration. */
export const APP_ROLE_VALUES: Record<UserRole, string> = {
    Administrator: "BackupWatch.Administrator",
    Specialist: "BackupWatch.Specialist",
    Contributor: "BackupWatch.Contributor",
    Viewer: "BackupWatch.Viewer"
};

// Highest privilege first
const ROLE_PRIORITY: UserRole[] = ["Administrator", "Specialist", "Contributor", "Viewer"];

// Claim types Easy Auth uses for App Roles: v2 tokens ("roles") and v1 / WS-Fed mapped type.
const ROLE_CLAIM_TYPES = ["roles", "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];

const EMAIL_CLAIM_TYPES = [
    "preferred_username",
    "upn",
    "email",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
];
const NAME_CLAIM_TYPES = ["name"];
const OBJECT_ID_CLAIM_TYPES = ["oid", "http://schemas.microsoft.com/identity/claims/objectidentifier"];

export interface IClientPrincipal {
    auth_typ?: string;
    name_typ?: string;
    role_typ?: string;
    claims?: { typ: string; val: string }[];
}

type LogLike = { warn: (...args: any[]) => void };

function header(req: HttpRequest, name: string): string {
    const headers: any = req.headers || {};
    const value = headers[name.toLowerCase()];
    return typeof value === "string" ? value : "";
}

/**
 * Parses the Easy Auth X-MS-CLIENT-PRINCIPAL header (base64 JSON).
 * Azure App Service sets this after validating the token and strips any client-supplied copy.
 */
export function parseClientPrincipal(req: HttpRequest): IClientPrincipal | null {
    const raw = header(req, "x-ms-client-principal");
    if (!raw) return null;
    try {
        const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
}

function claimValues(principal: IClientPrincipal, types: string[]): string[] {
    const wanted = types.filter(Boolean).map(t => t.toLowerCase());
    return (Array.isArray(principal.claims) ? principal.claims : [])
        .filter(c => c && typeof c.typ === "string" && wanted.includes(c.typ.toLowerCase()))
        .map(c => String(c.val || "").trim())
        .filter(Boolean);
}

function roleFromAppRole(value: string): UserRole | null {
    const v = value.trim().toLowerCase();
    return ROLE_PRIORITY.find(r => APP_ROLE_VALUES[r].toLowerCase() === v) || null;
}

function buildContext(isAuthenticated: boolean, role: UserRole, email: string, name: string, userId: string, appRoles: string[]): IUserSecurityContext {
    return {
        isAuthenticated,
        email,
        name,
        userId,
        appRoles,
        role,
        isAuthorizedForPermanent: isAuthenticated && (role === "Specialist" || role === "Administrator"),
        isAuthorizedForModification: isAuthenticated && (role === "Contributor" || role === "Specialist" || role === "Administrator"),
        isAuthorizedForForceRefresh: isAuthenticated && (role === "Specialist" || role === "Administrator"),
        isAuthorizedForAuditLogs: isAuthenticated && (role === "Contributor" || role === "Specialist" || role === "Administrator")
    };
}

/**
 * Resolves the caller's identity and role from the Easy Auth headers ONLY.
 * Nothing the browser sends (custom headers, query parameters, the bearer token itself) is trusted.
 *
 * - No principal header -> unauthenticated (callers must return 401).
 * - Role = highest BackupWatch.* App Role claim; authenticated with no BackupWatch role -> Viewer (warning logged).
 * - Local development only: AZURE_FUNCTIONS_ENVIRONMENT === "Development" and BW_DEV_ROLE set -> that role.
 */
export function getUserSecurityContext(req: HttpRequest, log: LogLike = console): IUserSecurityContext {
    const devRole = resolveDevRole();
    if (devRole) {
        log.warn(`[RBAC] DEVELOPMENT ONLY: using BW_DEV_ROLE=${devRole}. This override is ignored outside AZURE_FUNCTIONS_ENVIRONMENT=Development.`);
        return buildContext(true, devRole, "dev.user@localhost", "Local Developer", "local-dev", [APP_ROLE_VALUES[devRole]]);
    }

    const principal = parseClientPrincipal(req);
    if (!principal) {
        return buildContext(false, "Viewer", "", "", "", []);
    }

    const appRoles = Array.from(new Set(claimValues(principal, [principal.role_typ || "", ...ROLE_CLAIM_TYPES])));
    const matched = appRoles.map(roleFromAppRole).filter((r): r is UserRole => r !== null);
    const role = ROLE_PRIORITY.find(r => matched.includes(r)) || "Viewer";

    const email = header(req, "x-ms-client-principal-name")
        || claimValues(principal, [principal.name_typ || "", ...EMAIL_CLAIM_TYPES])[0]
        || "unknown@fifosys.com";
    const name = claimValues(principal, NAME_CLAIM_TYPES)[0] || email.split("@")[0] || "User";
    const userId = claimValues(principal, OBJECT_ID_CLAIM_TYPES)[0] || "";

    if (matched.length === 0) {
        log.warn(`[RBAC] Authenticated user ${email} has no BackupWatch App Role claim; defaulting to Viewer. Check the Enterprise App role assignment.`);
    }

    return buildContext(true, role, email, name, userId, appRoles);
}

function resolveDevRole(): UserRole | null {
    if (process.env.AZURE_FUNCTIONS_ENVIRONMENT !== "Development") return null;
    const raw = (process.env.BW_DEV_ROLE || "").trim().toLowerCase();
    if (!raw) return null;
    return ROLE_PRIORITY.find(r => r.toLowerCase() === raw || APP_ROLE_VALUES[r].toLowerCase() === raw) || null;
}

/**
 * Resolves the caller and enforces authentication. Sets a 401 response and returns null
 * when there is no Easy Auth principal; otherwise returns the server-resolved context.
 */
export function requireAuthenticatedUser(context: Context, req: HttpRequest): IUserSecurityContext | null {
    const userSec = getUserSecurityContext(req, context.log);
    if (!userSec.isAuthenticated) {
        context.res = {
            status: 401,
            body: { error: "Unauthorized: sign-in required." },
            headers: { "Content-Type": "application/json" }
        };
        return null;
    }
    return userSec;
}
