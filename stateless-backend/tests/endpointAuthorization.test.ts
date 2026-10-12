/**
 * Endpoint Authorization (BW-001)
 * Drives the real HTTP handlers: no Easy Auth principal -> 401 everywhere; role checks use the
 * server-resolved role; audit entries and the dashboard payload carry the server-resolved identity.
 */
jest.mock('axios');
jest.mock('../shared/tableService', () => require('./mocks/tableStorage').tableServiceMock);
jest.mock('../shared/autotask');

import axios from 'axios';
import type { AzureFunction } from '@azure/functions';
import backupWatchTrigger from '../backupWatchTrigger/index';
import exclusions from '../exclusions/index';
import escalateTrigger from '../escalateTrigger/index';
import auditLogs from '../auditLogs/index';
import adminRouting from '../adminRouting/index';
import adminDiagnostics from '../adminDiagnostics/index';
import { resetTableStorageMocks, getTableEntities } from './mocks/tableStorage';
import { createMockContext, createMockRequest, MockRole } from './mocks/functions';

const mockedAxios = axios as jest.Mocked<typeof axios>;

async function call(handler: AzureFunction, opts: Parameters<typeof createMockRequest>[0]) {
  const context = createMockContext();
  await handler(context, createMockRequest(opts));
  return context.res as { status: number; body: any };
}

const SPOOFED = {
  headers: { 'x-user-role': 'administrator', 'x-mock-role': 'administrator', 'x-user-email': 'spoof@fifosys.com' },
  query: { role: 'administrator', user: 'spoof@fifosys.com' },
};

// [label, handler, method, query]
const PROTECTED: [string, AzureFunction, string, Record<string, string>][] = [
  ['backupWatchTrigger GET (dashboard)', backupWatchTrigger, 'GET', {}],
  ['backupWatchTrigger GET ?refresh=true', backupWatchTrigger, 'GET', { refresh: 'true' }],
  ['backupWatchTrigger ?action=adminDiagnostics', backupWatchTrigger, 'GET', { action: 'adminDiagnostics' }],
  ['backupWatchTrigger ?action=adminRouting', backupWatchTrigger, 'POST', { action: 'adminRouting' }],
  ['backupWatchTrigger ?action=adminMaintenance', backupWatchTrigger, 'POST', { action: 'adminMaintenance' }],
  ['backupWatchTrigger ?action=adminCleanup', backupWatchTrigger, 'POST', { action: 'adminCleanup' }],
  ['backupWatchTrigger ?action=adminTestAsset', backupWatchTrigger, 'GET', { action: 'adminTestAsset' }],
  ['exclusions GET', exclusions, 'GET', {}],
  ['exclusions POST', exclusions, 'POST', {}],
  ['exclusions DELETE', exclusions, 'DELETE', {}],
  ['escalateTrigger POST', escalateTrigger, 'POST', {}],
  ['auditLogs GET', auditLogs, 'GET', {}],
  ['adminRouting GET', adminRouting, 'GET', {}],
  ['adminDiagnostics GET', adminDiagnostics, 'GET', {}],
];

beforeEach(() => {
  resetTableStorageMocks();
  jest.resetAllMocks();
});

describe('No Easy Auth principal -> 401 on every protected endpoint', () => {
  test.each(PROTECTED)('%s', async (_label, handler, method, query) => {
    const res = await call(handler, { method, query, body: {} });
    expect(res.status).toBe(401);
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  test.each(PROTECTED)('%s - spoofed role headers/params still 401', async (_label, handler, method, query) => {
    const res = await call(handler, { method, query: { ...query, ...SPOOFED.query }, headers: SPOOFED.headers, body: {} });
    expect(res.status).toBe(401);
  });
});

describe('Role checks use the server-resolved role', () => {
  const ADMIN_ONLY: [string, AzureFunction, string, Record<string, string>][] = [
    ['backupWatchTrigger ?action=adminDiagnostics', backupWatchTrigger, 'GET', { action: 'adminDiagnostics' }],
    ['backupWatchTrigger ?action=adminRouting', backupWatchTrigger, 'POST', { action: 'adminRouting' }],
    ['backupWatchTrigger ?action=adminMaintenance', backupWatchTrigger, 'POST', { action: 'adminMaintenance' }],
    ['backupWatchTrigger ?action=adminCleanup', backupWatchTrigger, 'POST', { action: 'adminCleanup' }],
    ['backupWatchTrigger ?action=adminTestAsset', backupWatchTrigger, 'GET', { action: 'adminTestAsset' }],
    ['adminRouting GET', adminRouting, 'GET', {}],
    ['adminDiagnostics GET', adminDiagnostics, 'GET', {}],
  ];

  test.each(ADMIN_ONLY)('%s: Specialist with ?role=administrator spoof -> 403', async (_l, handler, method, query) => {
    const res = await call(handler, { method, role: 'Specialist', query: { ...query, ...SPOOFED.query }, headers: SPOOFED.headers, body: {} });
    expect(res.status).toBe(403);
  });

  const CONTRIBUTOR_PLUS: [string, AzureFunction, string][] = [
    ['exclusions POST', exclusions, 'POST'],
    ['exclusions DELETE', exclusions, 'DELETE'],
    ['escalateTrigger POST', escalateTrigger, 'POST'],
    ['auditLogs GET', auditLogs, 'GET'],
  ];

  test.each(CONTRIBUTOR_PLUS)('%s: Viewer with spoofed admin headers -> 403', async (_l, handler, method) => {
    const res = await call(handler, { method, role: 'Viewer', query: SPOOFED.query, headers: SPOOFED.headers, body: {} });
    expect(res.status).toBe(403);
  });

  test('exclusions GET is allowed for an authenticated Viewer', async () => {
    const res = await call(exclusions, { method: 'GET', role: 'Viewer' });
    expect(res.status).toBe(200);
  });

  test('permanent exclusion: Contributor -> 403, Specialist -> 201', async () => {
    const body = { type: 'Device', target: 'DEV-1', reason: 'Decommissioned', isPermanent: true, ticketNumber: 'T20261012.0001' };
    expect((await call(exclusions, { method: 'POST', role: 'Contributor', body })).status).toBe(403);
    expect((await call(exclusions, { method: 'POST', role: 'Specialist', body })).status).toBe(201);
  });
});

describe('Audit log uses the server-resolved email and role', () => {
  test('mute audit entry ignores x-user-email / ?user= and records the principal identity', async () => {
    const res = await call(exclusions, {
      method: 'POST',
      role: 'Contributor',
      headers: SPOOFED.headers,
      query: SPOOFED.query,
      body: { type: 'Device', target: 'DEV-1', reason: 'Maintenance', ticketNumber: 'T20261012.0001' },
    });
    expect(res.status).toBe(201);

    const [entry] = getTableEntities('AuditLogs');
    expect(entry).toMatchObject({ userEmail: 'contributor@fifosys.com', userRole: 'Contributor', action: 'Mute Device' });
  });

  test('auditLogs GET returns userRole alongside userEmail', async () => {
    await call(exclusions, {
      method: 'POST', role: 'Specialist',
      body: { type: 'Device', target: 'DEV-2', reason: 'x', ticketNumber: 'T20261012.0002' },
    });
    const res = await call(auditLogs, { method: 'GET', role: 'Contributor' });
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ userEmail: 'specialist@fifosys.com', userRole: 'Specialist' });
  });
});

describe('Dashboard payload carries the server-resolved user (additive)', () => {
  test('GET returns existing fields plus userRole and userEmail', async () => {
    process.env.DATTO_KEY = 'fake-key-for-tests';
    mockedAxios.get.mockResolvedValue({ data: { items: [] } });
    try {
      const res = await call(backupWatchTrigger, { method: 'GET', role: 'Contributor', query: SPOOFED.query, headers: SPOOFED.headers });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('appVersion');
      expect(res.body).toHaveProperty('devices');
      expect(res.body).toHaveProperty('cacheStatus');
      expect(res.body.userRole).toBe('Contributor');
      expect(res.body.userEmail).toBe('contributor@fifosys.com');
      // Only api.datto.com was called (mocked) - nothing else.
      for (const [url] of mockedAxios.get.mock.calls) expect(String(url)).toMatch(/^https:\/\/api\.datto\.com\//);
    } finally {
      delete process.env.DATTO_KEY;
    }
  });
});
