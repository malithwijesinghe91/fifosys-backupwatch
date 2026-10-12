/**
 * Azure Functions test doubles: Context, HttpRequest and Easy Auth principals.
 */
import type { Context, HttpRequest } from '@azure/functions';
import { RBAC_GROUP_IDS } from '../../shared/auth';

export type MockRole = 'Viewer' | 'Contributor' | 'Specialist' | 'Administrator';

export function createMockContext(): Context & { log: jest.Mock & Record<'info' | 'warn' | 'error' | 'verbose', jest.Mock> } {
  const log: any = jest.fn();
  log.info = jest.fn();
  log.warn = jest.fn();
  log.error = jest.fn();
  log.verbose = jest.fn();
  return { log, res: undefined } as any;
}

/** Base64 X-MS-CLIENT-PRINCIPAL header as Easy Auth would set it for a member of the role's group. */
export function principalHeaderFor(role: MockRole, email = `${role.toLowerCase()}@fifosys.com`): string {
  const groupId = {
    Viewer: RBAC_GROUP_IDS.VIEWER,
    Contributor: RBAC_GROUP_IDS.CONTRIBUTOR,
    Specialist: RBAC_GROUP_IDS.SPECIALIST,
    Administrator: RBAC_GROUP_IDS.ADMINISTRATOR,
  }[role];
  return Buffer.from(JSON.stringify({
    userId: `usr-${role.toLowerCase()}`,
    userDetails: email,
    claims: [{ typ: 'groups', val: groupId }],
  })).toString('base64');
}

export function createMockRequest(opts: {
  method?: string;
  body?: any;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  role?: MockRole;
}): HttpRequest {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.role) headers['x-ms-client-principal'] = principalHeaderFor(opts.role);
  return {
    method: opts.method || 'GET',
    headers,
    query: opts.query || {},
    params: {},
    body: opts.body,
  } as unknown as HttpRequest;
}
