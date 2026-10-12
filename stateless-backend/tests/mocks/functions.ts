/**
 * Azure Functions test doubles: Context, HttpRequest and Easy Auth principals.
 */
import type { Context, HttpRequest } from '@azure/functions';
import { APP_ROLE_VALUES } from '../../shared/auth';

export type MockRole = 'Viewer' | 'Contributor' | 'Specialist' | 'Administrator';

export const ROLE_CLAIM_V1 = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
export const ROLE_CLAIM_V2 = 'roles';

export function createMockContext(): Context & { log: jest.Mock & Record<'info' | 'warn' | 'error' | 'verbose', jest.Mock> } {
  const log: any = jest.fn();
  log.info = jest.fn();
  log.warn = jest.fn();
  log.error = jest.fn();
  log.verbose = jest.fn();
  return { log, res: undefined } as any;
}

/**
 * Base64 X-MS-CLIENT-PRINCIPAL in the App Service Easy Auth format
 * ({ auth_typ, name_typ, role_typ, claims[] }), carrying the given App Role values.
 */
export function principalHeader(opts: {
  appRoles?: string[];
  email?: string;
  roleClaimType?: string;
  roleTyp?: string;
  extraClaims?: { typ: string; val: string }[];
} = {}): string {
  const roleTyp = opts.roleTyp ?? ROLE_CLAIM_V1;
  const roleClaimType = opts.roleClaimType ?? roleTyp;
  const claims = [
    ...(opts.email ? [{ typ: 'preferred_username', val: opts.email }] : []),
    { typ: 'name', val: 'Test User' },
    { typ: 'http://schemas.microsoft.com/identity/claims/objectidentifier', val: '00000000-0000-0000-0000-000000000001' },
    ...(opts.appRoles || []).map(val => ({ typ: roleClaimType, val })),
    ...(opts.extraClaims || []),
  ];
  return Buffer.from(JSON.stringify({
    auth_typ: 'aad',
    name_typ: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    role_typ: roleTyp,
    claims,
  })).toString('base64');
}

/** Easy Auth headers for a member of the given BackupWatch role. */
export function easyAuthHeadersFor(role: MockRole, email = `${role.toLowerCase()}@fifosys.com`): Record<string, string> {
  return {
    'x-ms-client-principal': principalHeader({ appRoles: [APP_ROLE_VALUES[role]], email }),
    'x-ms-client-principal-name': email,
  };
}

export function createMockRequest(opts: {
  method?: string;
  body?: any;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  role?: MockRole;
}): HttpRequest {
  const headers: Record<string, string> = {
    ...(opts.role ? easyAuthHeadersFor(opts.role) : {}),
    ...(opts.headers || {}),
  };
  return {
    method: opts.method || 'GET',
    headers,
    query: opts.query || {},
    params: {},
    body: opts.body,
  } as unknown as HttpRequest;
}
