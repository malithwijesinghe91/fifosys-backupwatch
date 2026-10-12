/**
 * Change freeze on user changes (BW-007, decision D-02: "a blackout is a blackout")
 * Drives the real HTTP handlers for every change endpoint x every role x freeze on/off.
 */
jest.mock('axios');
jest.mock('../shared/tableService', () => require('./mocks/tableStorage').tableServiceMock);
jest.mock('../shared/autotask');
jest.mock('../shared/configService', () => ({
  ...jest.requireActual('../shared/configService'),
  getGlobalMaintenanceMode: jest.fn(),
}));

import type { AzureFunction } from '@azure/functions';
import { getGlobalMaintenanceMode } from '../shared/configService';
import exclusions from '../exclusions/index';
import escalateTrigger from '../escalateTrigger/index';
import { resetTableStorageMocks, seedTableStorage, getTableEntities } from './mocks/tableStorage';
import { createMockContext, createMockRequest, easyAuthHeadersFor, MockRole } from './mocks/functions';

const maint = getGlobalMaintenanceMode as jest.Mock;
const FREEZE = { isActive: true, reason: 'Datacentre move', expiresAt: '2099-01-01T00:00:00.000Z' };

async function call(handler: AzureFunction, role: MockRole, method: string, body: any, query: Record<string, string> = {}) {
  const context = createMockContext();
  await handler(context, createMockRequest({ method, query, body, headers: easyAuthHeadersFor(role) }));
  return context.res as { status: number; body: any };
}

const MUTE_BODY = { type: 'Volume', target: 'FIF-DATTO-01:DC-01:D', reason: 'Disk swap', ticketNumber: 'T20261012.0001' };
const ESCALATE_BODY = { companyName: 'Acme', deviceName: 'FIF-DATTO-01', serialNumber: 'SER1', issueType: 'Backup', agentName: 'DC-01', description: 'Backup failed' };
const EXCLUSION_ID = encodeURIComponent('Volume:FIF-DATTO-01:DC-01:E');

// [label, handler, method, body, query]
const CHANGE_ENDPOINTS: [string, AzureFunction, string, any, Record<string, string>][] = [
  ['Mute / exclude (exclusions POST)', exclusions, 'POST', MUTE_BODY, {}],
  ['Unmute (exclusions DELETE)', exclusions, 'DELETE', {}, { id: EXCLUSION_ID }],
  ['Escalate (escalateTrigger POST)', escalateTrigger, 'POST', ESCALATE_BODY, {}],
];

beforeEach(() => {
  jest.clearAllMocks();
  resetTableStorageMocks();
  seedTableStorage('Exclusions', [{ partitionKey: 'Exclusion', rowKey: EXCLUSION_ID, type: 'Volume', target: 'FIF-DATTO-01:DC-01:E', reason: 'old' }]);
  maint.mockResolvedValue({ isActive: false });
});

describe('No freeze: changes work as before', () => {
  for (const role of ['Contributor', 'Specialist', 'Administrator'] as MockRole[]) {
    test.each(CHANGE_ENDPOINTS)(`${role}: %s is not blocked`, async (_l, handler, method, body, query) => {
      const res = await call(handler, role, method, body, query);
      expect(res.status).not.toBe(403);
      expect(res.body?.code).toBeUndefined();
    });
  }
});

describe('Freeze active', () => {
  for (const role of ['Contributor', 'Specialist'] as MockRole[]) {
    test.each(CHANGE_ENDPOINTS)(`${role}: %s is blocked server-side, even with an override in the body`, async (_l, handler, method, body, query) => {
      maint.mockResolvedValue(FREEZE);
      const res = await call(handler, role, method, { ...body, overrideBlackout: true, overrideReason: 'please' }, query);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CHANGE_FREEZE');
      expect(res.body.error).toMatch(/Only Administrators/);
      expect(res.body.error).toMatch(/Datacentre move/);
    });
  }

  test.each(CHANGE_ENDPOINTS)('Viewer: %s is still refused (403)', async (_l, handler, method, body, query) => {
    maint.mockResolvedValue(FREEZE);
    const res = await call(handler, 'Viewer', method, body, query);
    expect(res.status).toBe(403);
  });

  test.each(CHANGE_ENDPOINTS)('Administrator without a reason: %s is blocked', async (_l, handler, method, body, query) => {
    maint.mockResolvedValue(FREEZE);
    for (const extra of [{}, { overrideBlackout: true }, { overrideBlackout: true, overrideReason: '   ' }, { overrideReason: 'no flag' }]) {
      const res = await call(handler, 'Administrator', method, { ...body, ...extra }, query);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CHANGE_FREEZE_REASON_REQUIRED');
    }
  });

  test.each(CHANGE_ENDPOINTS)('Administrator with a reason: %s goes ahead and the override is audited', async (_l, handler, method, body, query) => {
    maint.mockResolvedValue(FREEZE);
    const res = await call(handler, 'Administrator', method, { ...body, overrideBlackout: true, overrideReason: 'P1 outage at client' }, query);
    expect(res.status).not.toBe(403);
    const overrides = getTableEntities('AuditLogs').filter(a => a.action === 'Change During Blackout');
    expect(overrides).toHaveLength(1);
    expect(overrides[0]).toMatchObject({ userEmail: 'administrator@fifosys.com', userRole: 'Administrator' });
    expect(overrides[0].details).toMatch(/P1 outage at client/);
  });

  test('blocked mute leaves the exclusions table unchanged', async () => {
    maint.mockResolvedValue(FREEZE);
    const before = getTableEntities('Exclusions');
    await call(exclusions, 'Specialist', 'POST', MUTE_BODY);
    await call(exclusions, 'Specialist', 'DELETE', {}, { id: EXCLUSION_ID });
    expect(getTableEntities('Exclusions')).toEqual(before);
  });

  test('reading exclusions (GET) is still allowed for everyone', async () => {
    maint.mockResolvedValue(FREEZE);
    const res = await call(exclusions, 'Viewer', 'GET', undefined);
    expect(res.status).toBe(200);
  });
});
