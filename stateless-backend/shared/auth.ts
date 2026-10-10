import { HttpRequest } from "@azure/functions";

export type UserRole = "Viewer" | "Contributor" | "Specialist" | "Administrator";

export interface IUserSecurityContext {
    email: string;
    name: string;
    userId?: string;
    groups: string[];
    role: UserRole;
    isAuthorizedForPermanent: boolean;
    isAuthorizedForModification: boolean;
    isAuthorizedForForceRefresh: boolean;
    isAuthorizedForAuditLogs: boolean;
}

// Default Entra ID Object IDs configured for BackupWatch Security Groups
export const RBAC_GROUP_IDS = {
    ADMINISTRATOR: process.env.RBAC_ADMIN_GROUP_ID || "f146d61d-c629-4685-b757-5d560195a98a",
    SPECIALIST: process.env.RBAC_SPECIALIST_GROUP_ID || "ca9d0b2c-6f9f-4b94-864c-1cca786dc52d",
    CONTRIBUTOR: process.env.RBAC_CONTRIBUTOR_GROUP_ID || "d19f391a-6aba-4a25-87b3-aff059c0ff40",
    VIEWER: process.env.RBAC_VIEWER_GROUP_ID || "f17fa29e-7ea8-405e-b04a-15a6a8fe2f60"
};

/**
 * Parses Easy Auth / App Service client principal header (X-MS-CLIENT-PRINCIPAL)
 */
export function parseClientPrincipal(req: HttpRequest): {
    identityProvider?: string;
    userId?: string;
    userDetails?: string;
    userRoles?: string[];
    claims?: { typ: string; val: string }[];
} | null {
    const rawHeader = req.headers["x-ms-client-principal"] || req.headers["X-Ms-Client-Principal"];
    if (!rawHeader) return null;

    try {
        const decoded = Buffer.from(rawHeader, "base64").toString("utf-8");
        return JSON.parse(decoded);
    } catch (e) {
        return null;
    }
}

/**
 * Evaluates caller identity, claims, and role level from HttpRequest.
 */
export function getUserSecurityContext(req: HttpRequest): IUserSecurityContext {
    const principal = parseClientPrincipal(req);
    const groups: string[] = [];

    // Fallback email extraction
    let email = req.headers["x-ms-client-principal-name"] ||
                req.headers["X-Ms-Client-Principal-Name"] ||
                req.headers["x-user-email"] ||
                "";
    let name = "";
    let userId = "";

    if (principal) {
        userId = principal.userId || "";
        if (!email && principal.userDetails) {
            email = principal.userDetails;
        }

        if (Array.isArray(principal.claims)) {
            for (const claim of principal.claims) {
                const typ = (claim.typ || "").toLowerCase();
                const val = claim.val || "";

                if (typ === "groups" || typ.endsWith("/identity/claims/groups") || typ.endsWith("/groups")) {
                    if (val && !groups.includes(val)) {
                        groups.push(val.toLowerCase());
                    }
                } else if (typ === "name" || typ.endsWith("/identity/claims/name")) {
                    if (!name) name = val;
                } else if (typ === "preferred_username" || typ.endsWith("/emailaddress") || typ.endsWith("/upn")) {
                    if (!email) email = val;
                }
            }
        }

        if (Array.isArray(principal.userRoles)) {
            for (const r of principal.userRoles) {
                if (r && !groups.includes(r.toLowerCase())) {
                    groups.push(r.toLowerCase());
                }
            }
        }
    }

    // Direct role header or query parameter passed by authenticated SPFx client
    const clientRoleHeader = (req.headers["x-user-role"] || req.headers["X-User-Role"] || (req.query && req.query.role) || "").trim().toLowerCase();
    if (clientRoleHeader) {
        if (clientRoleHeader === "administrator" || clientRoleHeader === "admin") {
            groups.push(RBAC_GROUP_IDS.ADMINISTRATOR.toLowerCase());
        } else if (clientRoleHeader === "specialist") {
            groups.push(RBAC_GROUP_IDS.SPECIALIST.toLowerCase());
        } else if (clientRoleHeader === "contributor") {
            groups.push(RBAC_GROUP_IDS.CONTRIBUTOR.toLowerCase());
        } else if (clientRoleHeader === "viewer") {
            groups.push(RBAC_GROUP_IDS.VIEWER.toLowerCase());
        }
    }

    // Direct user email passed by SPFx client (header or query param)
    const clientEmailHeader = req.headers["x-user-email"] || req.headers["X-User-Email"] || (req.query && req.query.user);
    if (clientEmailHeader && !email) {
        email = clientEmailHeader;
    }

    // Decode JWT Bearer Token if present (from AadHttpClient: Authorization: Bearer <token>)
    const authHeader = req.headers["authorization"] || req.headers["Authorization"] || "";
    if (authHeader.startsWith("Bearer ") || authHeader.startsWith("bearer ")) {
        try {
            const token = authHeader.substring(7).trim();
            const parts = token.split(".");
            if (parts.length >= 2) {
                const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                const decodedJson = Buffer.from(payloadBase64, "base64").toString("utf-8");
                const jwtPayload = JSON.parse(decodedJson);

                if (!email) {
                    email = jwtPayload.upn || jwtPayload.unique_name || jwtPayload.email || jwtPayload.preferred_username || "";
                }
                if (!name) {
                    name = jwtPayload.name || "";
                }
                if (!userId) {
                    userId = jwtPayload.oid || jwtPayload.sub || "";
                }

                // Parse groups from JWT claims
                if (Array.isArray(jwtPayload.groups)) {
                    for (const g of jwtPayload.groups) {
                        if (g && !groups.includes(String(g).toLowerCase())) {
                            groups.push(String(g).toLowerCase());
                        }
                    }
                }

                // Parse roles from JWT claims
                if (Array.isArray(jwtPayload.roles)) {
                    for (const r of jwtPayload.roles) {
                        if (r && !groups.includes(String(r).toLowerCase())) {
                            groups.push(String(r).toLowerCase());
                        }
                    }
                }
            }
        } catch (e) {
            // Ignored, fallback gracefully
        }
    }

    // Support local / testing mock headers
    const mockRoleHeader = (req.headers["x-mock-role"] || "").trim().toLowerCase();
    if (mockRoleHeader) {
        if (mockRoleHeader === "administrator" || mockRoleHeader === "admin") {
            groups.push(RBAC_GROUP_IDS.ADMINISTRATOR.toLowerCase());
        } else if (mockRoleHeader === "specialist") {
            groups.push(RBAC_GROUP_IDS.SPECIALIST.toLowerCase());
        } else if (mockRoleHeader === "contributor") {
            groups.push(RBAC_GROUP_IDS.CONTRIBUTOR.toLowerCase());
        } else if (mockRoleHeader === "viewer") {
            groups.push(RBAC_GROUP_IDS.VIEWER.toLowerCase());
        }
    }

    const adminId = RBAC_GROUP_IDS.ADMINISTRATOR.toLowerCase();
    const specialistId = RBAC_GROUP_IDS.SPECIALIST.toLowerCase();
    const contributorId = RBAC_GROUP_IDS.CONTRIBUTOR.toLowerCase();

    // Resolve Highest Role
    let role: UserRole = "Viewer";

    if (groups.includes(adminId)) {
        role = "Administrator";
    } else if (groups.includes(specialistId)) {
        role = "Specialist";
    } else if (groups.includes(contributorId)) {
        role = "Contributor";
    } else {
        role = "Viewer";
    }

    if (!email) {
        email = "unknown@fifosys.com";
    }
    if (!name) {
        name = email.split("@")[0] || "User";
    }

    return {
        email,
        name,
        userId,
        groups,
        role,
        isAuthorizedForPermanent: role === "Specialist" || role === "Administrator",
        isAuthorizedForModification: role === "Contributor" || role === "Specialist" || role === "Administrator",
        isAuthorizedForForceRefresh: role === "Specialist" || role === "Administrator",
        isAuthorizedForAuditLogs: role === "Contributor" || role === "Specialist" || role === "Administrator"
    };
}
