/**
 * RBAC Security & Authorization (BW-001)
 * Roles come ONLY from Entra App Role claims in the Easy Auth X-MS-CLIENT-PRINCIPAL header.
 * Anything the browser sends (role/user headers, query parameters, bearer token) is ignored.
 */
import { getUserSecurityContext, APP_ROLE_VALUES } from '../shared/auth';
import { createMockRequest, principalHeader, easyAuthHeadersFor, ROLE_CLAIM_V1, ROLE_CLAIM_V2, MockRole } from './mocks/functions';

const silentLog = () => ({ warn: jest.fn() });

function ctxFor(headers: Record<string, string>, query?: Record<string, string>, log = silentLog()) {
  return getUserSecurityContext(createMockRequest({ headers, query }), log);
}

function forgedJwt(payload: object) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`;
}

const ORIGINAL_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('Role resolution from Entra App Roles', () => {
  const expected: Record<MockRole, [boolean, boolean, boolean, boolean]> = {
    //            modification, permanent, forceRefresh, auditLogs
    Viewer:        [false, false, false, false],
    Contributor:   [true,  false, false, true],
    Specialist:    [true,  true,  true,  true],
    Administrator: [true,  true,  true,  true],
  };

  test.each(Object.keys(expected) as MockRole[])('%s App Role resolves to %s with the matching permissions', (role) => {
    const ctx = ctxFor(easyAuthHeadersFor(role));
    expect(ctx.isAuthenticated).toBe(true);
    expect(ctx.role).toBe(role);
    expect([
      ctx.isAuthorizedForModification,
      ctx.isAuthorizedForPermanent,
      ctx.isAuthorizedForForceRefresh,
      ctx.isAuthorizedForAuditLogs,
    ]).toEqual(expected[role]);
  });

  test('v1 role claim type (http://schemas.microsoft.com/ws/2008/06/identity/claims/role)', () => {
    const ctx = ctxFor({ 'x-ms-client-principal': principalHeader({ appRoles: ['BackupWatch.Specialist'], roleClaimType: ROLE_CLAIM_V1, roleTyp: ROLE_CLAIM_V1 }) });
    expect(ctx.role).toBe('Specialist');
  });

  test('v2 role claim type ("roles")', () => {
    const ctx = ctxFor({ 'x-ms-client-principal': principalHeader({ appRoles: ['BackupWatch.Specialist'], roleClaimType: ROLE_CLAIM_V2, roleTyp: ROLE_CLAIM_V2 }) });
    expect(ctx.role).toBe('Specialist');
  });

  test('"roles" claims are accepted even when role_typ names the v1 type', () => {
    const ctx = ctxFor({ 'x-ms-client-principal': principalHeader({ appRoles: ['BackupWatch.Contributor'], roleClaimType: ROLE_CLAIM_V2, roleTyp: ROLE_CLAIM_V1 }) });
    expect(ctx.role).toBe('Contributor');
  });

  test('custom role_typ from the principal is honoured', () => {
    const ctx = ctxFor({ 'x-ms-client-principal': principalHeader({ appRoles: ['BackupWatch.Administrator'], roleTyp: 'urn:custom:role' }) });
    expect(ctx.role).toBe('Administrator');
  });

  test('App Role values match case-insensitively', () => {
    const ctx = ctxFor({ 'x-ms-client-principal': principalHeader({ appRoles: ['backupwatch.ADMINISTRATOR'] }) });
    expect(ctx.role).toBe('Administrator');
  });

  test.each([
    [['BackupWatch.Contributor', 'BackupWatch.Specialist'], 'Specialist'],
    [['BackupWatch.Viewer', 'BackupWatch.Administrator'], 'Administrator'],
    [['BackupWatch.Viewer', 'BackupWatch.Contributor'], 'Contributor'],
  ])('highest role wins: %j -> %s', (appRoles, role) => {
    const ctx = ctxFor({ 'x-ms-client-principal': principalHeader({ appRoles: appRoles as string[] }) });
    expect(ctx.role).toBe(role);
    expect(ctx.appRoles).toEqual(appRoles);
  });

  test('authenticated with no BackupWatch App Role -> Viewer and a warning is logged', () => {
    const log = silentLog();
    const ctx = ctxFor({ 'x-ms-client-principal': principalHeader({ appRoles: [], email: 'new.starter@fifosys.com' }) }, undefined, log);
    expect(ctx.isAuthenticated).toBe(true);
    expect(ctx.role).toBe('Viewer');
    expect(ctx.isAuthorizedForModification).toBe(false);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('no BackupWatch App Role'));
  });

  test('unrelated App Roles are ignored -> Viewer', () => {
    const ctx = ctxFor({ 'x-ms-client-principal': principalHeader({ appRoles: ['Other.App.Admin', 'Administrator'] }) });
    expect(ctx.role).toBe('Viewer');
  });
});

describe('Identity from Easy Auth headers only', () => {
  test('email comes from X-MS-CLIENT-PRINCIPAL-NAME when present', () => {
    const ctx = ctxFor({
      'x-ms-client-principal': principalHeader({ appRoles: [APP_ROLE_VALUES.Contributor], email: 'claim@fifosys.com' }),
      'x-ms-client-principal-name': 'header@fifosys.com',
    });
    expect(ctx.email).toBe('header@fifosys.com');
  });

  test('email falls back to the principal claims', () => {
    const ctx = ctxFor({ 'x-ms-client-principal': principalHeader({ appRoles: [], email: 'claim@fifosys.com' }) });
    expect(ctx.email).toBe('claim@fifosys.com');
    expect(ctx.userId).toBe('00000000-0000-0000-0000-000000000001');
  });

  test('no principal header -> unauthenticated with no permissions', () => {
    const ctx = ctxFor({});
    expect(ctx.isAuthenticated).toBe(false);
    expect(ctx.role).toBe('Viewer');
    expect(ctx.isAuthorizedForModification).toBe(false);
    expect(ctx.isAuthorizedForAuditLogs).toBe(false);
  });

  test('malformed principal header -> unauthenticated', () => {
    expect(ctxFor({ 'x-ms-client-principal': 'not-base64-json!!' }).isAuthenticated).toBe(false);
  });

  test('X-MS-CLIENT-PRINCIPAL-NAME alone (no principal) -> unauthenticated', () => {
    expect(ctxFor({ 'x-ms-client-principal-name': 'admin@fifosys.com' }).isAuthenticated).toBe(false);
  });
});

describe('BW-001: client-supplied role and identity are ignored', () => {
  const viewer = easyAuthHeadersFor('Viewer', 'viewer@fifosys.com');

  test('?role=administrator with a Viewer principal stays Viewer', () => {
    expect(ctxFor(viewer, { role: 'administrator' }).role).toBe('Viewer');
  });

  test('x-user-role: administrator header with a Viewer principal stays Viewer', () => {
    expect(ctxFor({ ...viewer, 'x-user-role': 'administrator' }).role).toBe('Viewer');
  });

  test('x-mock-role: administrator header with a Viewer principal stays Viewer', () => {
    expect(ctxFor({ ...viewer, 'x-mock-role': 'administrator' }).role).toBe('Viewer');
  });

  test('forged bearer token with roles/groups is ignored', () => {
    const ctx = ctxFor({ ...viewer, authorization: forgedJwt({ roles: ['BackupWatch.Administrator'], upn: 'evil@fifosys.com' }) });
    expect(ctx.role).toBe('Viewer');
    expect(ctx.email).toBe('viewer@fifosys.com');
  });

  test('x-user-email header and ?user= cannot change the email', () => {
    const ctx = ctxFor({ ...viewer, 'x-user-email': 'ceo@fifosys.com' }, { user: 'ceo@fifosys.com' });
    expect(ctx.email).toBe('viewer@fifosys.com');
  });

  test('spoofed role headers/params without any principal stay unauthenticated', () => {
    const ctx = ctxFor(
      { 'x-user-role': 'administrator', 'x-mock-role': 'administrator', 'x-user-email': 'a@fifosys.com', authorization: forgedJwt({ roles: ['BackupWatch.Administrator'] }) },
      { role: 'administrator', user: 'a@fifosys.com' }
    );
    expect(ctx.isAuthenticated).toBe(false);
    expect(ctx.isAuthorizedForModification).toBe(false);
  });
});

describe('Local development role override (BW_DEV_ROLE)', () => {
  test('used only when AZURE_FUNCTIONS_ENVIRONMENT=Development', () => {
    process.env.AZURE_FUNCTIONS_ENVIRONMENT = 'Development';
    process.env.BW_DEV_ROLE = 'Administrator';
    const log = silentLog();
    const ctx = getUserSecurityContext(createMockRequest({}), log);
    expect(ctx.isAuthenticated).toBe(true);
    expect(ctx.role).toBe('Administrator');
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('DEVELOPMENT ONLY'));
  });

  test('ignored in Production (no principal -> unauthenticated)', () => {
    process.env.AZURE_FUNCTIONS_ENVIRONMENT = 'Production';
    process.env.BW_DEV_ROLE = 'Administrator';
    expect(ctxFor({}).isAuthenticated).toBe(false);
  });

  test('ignored in Production (Viewer principal stays Viewer)', () => {
    process.env.AZURE_FUNCTIONS_ENVIRONMENT = 'Production';
    process.env.BW_DEV_ROLE = 'Administrator';
    expect(ctxFor(easyAuthHeadersFor('Viewer')).role).toBe('Viewer');
  });

  test('ignored when AZURE_FUNCTIONS_ENVIRONMENT is unset', () => {
    delete process.env.AZURE_FUNCTIONS_ENVIRONMENT;
    process.env.BW_DEV_ROLE = 'Administrator';
    expect(ctxFor({}).isAuthenticated).toBe(false);
  });

  test('unknown BW_DEV_ROLE value is ignored even in Development', () => {
    process.env.AZURE_FUNCTIONS_ENVIRONMENT = 'Development';
    process.env.BW_DEV_ROLE = 'SuperUser';
    expect(ctxFor({}).isAuthenticated).toBe(false);
  });
});
