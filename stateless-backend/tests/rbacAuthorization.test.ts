/**
 * RBAC Authorization Tests
 * Converted from scratch/test_rbac_authorization.js
 */
import { getUserSecurityContext, RBAC_GROUP_IDS } from '../shared/auth';
import type { HttpRequest } from '@azure/functions';

function createMockRequest(headers: Record<string, string>, query?: Record<string, string>): HttpRequest {
  return {
    headers,
    query: query || {},
  } as unknown as HttpRequest;
}

function createPrincipalHeader(claims: { userId?: string; userDetails?: string; claims?: { typ: string; val: string }[]; userRoles?: string[] }) {
  return Buffer.from(JSON.stringify(claims)).toString('base64');
}

describe('RBAC Security & Authorization', () => {
  describe('Default Role Fallback (No Principal / No Groups)', () => {
    test('resolves to Viewer with 0 write/escalate permissions', () => {
      const req = createMockRequest({});
      const ctx = getUserSecurityContext(req);

      expect(ctx.role).toBe('Viewer');
      expect(ctx.isAuthorizedForModification).toBe(false);
      expect(ctx.isAuthorizedForPermanent).toBe(false);
      expect(ctx.isAuthorizedForForceRefresh).toBe(false);
      expect(ctx.isAuthorizedForAuditLogs).toBe(false);
    });
  });

  describe('Contributor Role', () => {
    test('recognized with temporary modification & audit log rights, restricted from permanent/force', () => {
      const claims = {
        userId: 'usr-contributor-1',
        userDetails: 'support.engineer@fifosys.com',
        claims: [
          { typ: 'groups', val: RBAC_GROUP_IDS.CONTRIBUTOR },
          { typ: 'name', val: 'Support Engineer' },
        ],
      };
      const req = createMockRequest({
        'x-ms-client-principal': createPrincipalHeader(claims),
      });
      const ctx = getUserSecurityContext(req);

      expect(ctx.role).toBe('Contributor');
      expect(ctx.email).toBe('support.engineer@fifosys.com');
      expect(ctx.isAuthorizedForModification).toBe(true);
      expect(ctx.isAuthorizedForPermanent).toBe(false);
      expect(ctx.isAuthorizedForForceRefresh).toBe(false);
      expect(ctx.isAuthorizedForAuditLogs).toBe(true);
    });
  });

  describe('Specialist Role', () => {
    test('recognized with permanent exclusions and force refresh authority', () => {
      const claims = {
        userId: 'usr-specialist-1',
        userDetails: 'backup.lead@fifosys.com',
        claims: [
          { typ: 'groups', val: RBAC_GROUP_IDS.SPECIALIST },
          { typ: 'name', val: 'Backup Specialist Lead' },
        ],
      };
      const req = createMockRequest({
        'x-ms-client-principal': createPrincipalHeader(claims),
      });
      const ctx = getUserSecurityContext(req);

      expect(ctx.role).toBe('Specialist');
      expect(ctx.isAuthorizedForModification).toBe(true);
      expect(ctx.isAuthorizedForPermanent).toBe(true);
      expect(ctx.isAuthorizedForForceRefresh).toBe(true);
      expect(ctx.isAuthorizedForAuditLogs).toBe(true);
    });
  });

  describe('Administrator Role', () => {
    test('recognized with global authority', () => {
      const claims = {
        userId: 'usr-admin-1',
        userDetails: 'system.admin@fifosys.com',
        claims: [
          { typ: 'groups', val: RBAC_GROUP_IDS.ADMINISTRATOR },
        ],
      };
      const req = createMockRequest({
        'x-ms-client-principal': createPrincipalHeader(claims),
      });
      const ctx = getUserSecurityContext(req);

      expect(ctx.role).toBe('Administrator');
      expect(ctx.isAuthorizedForPermanent).toBe(true);
      expect(ctx.isAuthorizedForForceRefresh).toBe(true);
      expect(ctx.isAuthorizedForModification).toBe(true);
      expect(ctx.isAuthorizedForAuditLogs).toBe(true);
    });
  });

  describe('Role Hierarchy Resolution', () => {
    test('User in multiple groups resolves to highest privilege (Contributor + Specialist = Specialist)', () => {
      const claims = {
        claims: [
          { typ: 'groups', val: RBAC_GROUP_IDS.CONTRIBUTOR },
          { typ: 'groups', val: RBAC_GROUP_IDS.SPECIALIST },
        ],
      };
      const req = createMockRequest({
        'x-ms-client-principal': createPrincipalHeader(claims),
      });
      const ctx = getUserSecurityContext(req);

      expect(ctx.role).toBe('Specialist');
    });
  });

  // Known bug test - BW-001: Backend trusts client-supplied role
  test.failing('BW-001: Request with ?role=administrator and no group claims should resolve to Viewer', () => {
    const req = createMockRequest({}, { role: 'administrator' });
    const ctx = getUserSecurityContext(req);
    // After BW-001 fix, this should be Viewer (not Administrator)
    expect(ctx.role).toBe('Viewer');
  });

  test.failing('BW-001: Request with x-user-role: administrator header and no group claims should resolve to Viewer', () => {
    const req = createMockRequest({ 'x-user-role': 'administrator' });
    const ctx = getUserSecurityContext(req);
    expect(ctx.role).toBe('Viewer');
  });

  test.failing('BW-001: Request with x-mock-role: administrator header and no group claims should resolve to Viewer', () => {
    const req = createMockRequest({ 'x-mock-role': 'administrator' });
    const ctx = getUserSecurityContext(req);
    expect(ctx.role).toBe('Viewer');
  });
});