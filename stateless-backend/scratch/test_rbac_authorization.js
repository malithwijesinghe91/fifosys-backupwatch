const assert = require("assert");
const { getUserSecurityContext, RBAC_GROUP_IDS } = require("../dist/shared/auth");

console.log("=== RBAC SECURITY & AUTHORIZATION TEST SUITE ===");

// 1. Test Default Role Fallback (No Principal / No Groups)
console.log("\n[1] Testing Default Fallback (Viewer):");
const emptyReq = { headers: {} };
const emptyCtx = getUserSecurityContext(emptyReq);
assert.strictEqual(emptyCtx.role, "Viewer");
assert.strictEqual(emptyCtx.isAuthorizedForModification, false);
assert.strictEqual(emptyCtx.isAuthorizedForPermanent, false);
assert.strictEqual(emptyCtx.isAuthorizedForForceRefresh, false);
assert.strictEqual(emptyCtx.isAuthorizedForAuditLogs, false);
console.log("✔ Unauthenticated / no-group requests resolve to Viewer with 0 write/escalate permissions.");

// 2. Test Contributor Role (Temporary Exclusions, Escalations, AuditLogs, but NO Permanent & NO ForceRefresh)
console.log("\n[2] Testing Contributor Role:");
const contributorClaims = {
    userId: "usr-contributor-1",
    userDetails: "support.engineer@fifosys.com",
    claims: [
        { typ: "groups", val: RBAC_GROUP_IDS.CONTRIBUTOR },
        { typ: "name", val: "Support Engineer" }
    ]
};
const contributorHeader = Buffer.from(JSON.stringify(contributorClaims)).toString("base64");
const contributorReq = {
    headers: {
        "x-ms-client-principal": contributorHeader
    }
};
const contributorCtx = getUserSecurityContext(contributorReq);
assert.strictEqual(contributorCtx.role, "Contributor");
assert.strictEqual(contributorCtx.email, "support.engineer@fifosys.com");
assert.strictEqual(contributorCtx.isAuthorizedForModification, true);
assert.strictEqual(contributorCtx.isAuthorizedForPermanent, false, "Contributor MUST NOT be authorized for permanent exclusions");
assert.strictEqual(contributorCtx.isAuthorizedForForceRefresh, false, "Contributor MUST NOT be authorized for force refresh");
assert.strictEqual(contributorCtx.isAuthorizedForAuditLogs, true, "Contributor MUST be authorized for audit logs");
console.log("✔ Contributor accurately recognized with temporary modification & audit log rights, but restricted from permanent/force.");

// 3. Test Specialist Role (Full operational rights, Permanent Exclusions, Force Refresh)
console.log("\n[3] Testing Specialist Role:");
const specialistClaims = {
    userId: "usr-specialist-1",
    userDetails: "backup.lead@fifosys.com",
    claims: [
        { typ: "groups", val: RBAC_GROUP_IDS.SPECIALIST },
        { typ: "name", val: "Backup Specialist Lead" }
    ]
};
const specialistHeader = Buffer.from(JSON.stringify(specialistClaims)).toString("base64");
const specialistReq = {
    headers: {
        "x-ms-client-principal": specialistHeader
    }
};
const specialistCtx = getUserSecurityContext(specialistReq);
assert.strictEqual(specialistCtx.role, "Specialist");
assert.strictEqual(specialistCtx.isAuthorizedForModification, true);
assert.strictEqual(specialistCtx.isAuthorizedForPermanent, true, "Specialist MUST be authorized for permanent exclusions");
assert.strictEqual(specialistCtx.isAuthorizedForForceRefresh, true, "Specialist MUST be authorized for force refresh");
assert.strictEqual(specialistCtx.isAuthorizedForAuditLogs, true);
console.log("✔ Specialist accurately recognized with permanent exclusions and force refresh authority.");

// 4. Test Administrator Role (Global authority)
console.log("\n[4] Testing Administrator Role:");
const adminClaims = {
    userId: "usr-admin-1",
    userDetails: "system.admin@fifosys.com",
    claims: [
        { typ: "groups", val: RBAC_GROUP_IDS.ADMINISTRATOR }
    ]
};
const adminHeader = Buffer.from(JSON.stringify(adminClaims)).toString("base64");
const adminReq = {
    headers: {
        "x-ms-client-principal": adminHeader
    }
};
const adminCtx = getUserSecurityContext(adminReq);
assert.strictEqual(adminCtx.role, "Administrator");
assert.strictEqual(adminCtx.isAuthorizedForPermanent, true);
assert.strictEqual(adminCtx.isAuthorizedForForceRefresh, true);
assert.strictEqual(adminCtx.isAuthorizedForModification, true);
assert.strictEqual(adminCtx.isAuthorizedForAuditLogs, true);
console.log("✔ Administrator accurately recognized with global authority.");

// 5. Test Role Hierarchy Resolution (User in multiple groups)
console.log("\n[5] Testing Hierarchy Resolution (Contributor + Specialist -> Highest Wins):");
const multiClaims = {
    claims: [
        { typ: "groups", val: RBAC_GROUP_IDS.CONTRIBUTOR },
        { typ: "groups", val: RBAC_GROUP_IDS.SPECIALIST }
    ]
};
const multiHeader = Buffer.from(JSON.stringify(multiClaims)).toString("base64");
const multiCtx = getUserSecurityContext({ headers: { "x-ms-client-principal": multiHeader } });
assert.strictEqual(multiCtx.role, "Specialist", "User in Contributor and Specialist must resolve to Specialist");
console.log("✔ Multi-group membership correctly resolves to the highest privilege level.");

console.log("\n=======================================================");
console.log("🎉 ALL RBAC AUTHORIZATION TESTS PASSED SUCCESSFULLY!");
console.log("=======================================================");
