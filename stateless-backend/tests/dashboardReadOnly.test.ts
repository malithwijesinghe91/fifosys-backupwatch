/**
 * Read-only dashboard loads and Force Scan (BW-023, decisions D-07 / D-08)
 *
 * One scenario where a scan has work to do: a new unprotected volume (compliance ticket), an excluded volume that is
 * now protected (sweep auto-heal note), an offline ticket for an appliance that is back online (auto-heal note) and a
 * completed tracked ticket (pruned). Opening the dashboard must do none of it and still show the same information;
 * a Force Scan (Specialist/Administrator) must do all of it under the scan lock.
 */
jest.mock('axios');
jest.mock('../shared/tableService', () => require('./mocks/tableStorage').tableServiceMock);
jest.mock('../shared/autotask');
jest.mock('../shared/configService', () => ({
  ...jest.requireActual('../shared/configService'),
  getGlobalMaintenanceMode: jest.fn(async () => ({ isActive: false })),
  getAutotaskRoutingConfig: jest.fn(async () => ({})),
}));

import axios from 'axios';
import * as at from '../shared/autotask';
import backupWatchTrigger, { __resetDashboardCacheForTests } from '../backupWatchTrigger/index';
import { __setScanLockTimingForTests } from '../shared/scanLock';
import { invalidateSilenceCache } from '../shared/autotaskPolicy';
import { resetTableStorageMocks, seedTableStorage, getTableEntities } from './mocks/tableStorage';
import { createMockContext, createMockRequest, easyAuthHeadersFor, MockRole } from './mocks/functions';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mocked = at as jest.Mocked<typeof at>;

const DEVICE = {
  name: 'APP-1',
  serialNumber: 'SN-1',
  clientCompanyName: 'Acme Ltd',
  model: 'S5-3',
  isActive: true,
  lastCheckin: new Date().toISOString(),
  localStorageUsed: { size: 100, units: 'GB' },
  localStorageAvailable: { size: 900, units: 'GB' },
};
const ASSETS = [{
  name: 'SRV-1',
  hostname: 'srv-1.acme.local',
  isArchived: false,
  isPaused: false,
  protectedVolumeNames: ['C:\\', 'D:\\'],   // D was excluded and is now protected -> sweep auto-heal
  unprotectedVolumeNames: ['E:\\'],         // E is new and not excluded -> compliance ticket
  backups: [],
}];

const AUTOTASK_WRITES = ['createComplianceTicket', 'createTicketNoteInAutoTask', 'updateTicketStatusInAutoTask', 'createTicketInAutoTask'] as const;

function seedScenario() {
  seedTableStorage('Exclusions', [{
    partitionKey: 'Exclusion',
    rowKey: encodeURIComponent('Volume:APP-1:SRV-1:D'),
    type: 'Volume',
    target: 'APP-1:SRV-1:D',
    reason: 'Data drive moved',
    isPermanent: false,
    expiresAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
    ticketNumber: 'T111',
    ticketUrl: 'https://ww16.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc/Index?ticketId=111',
  }]);
  seedTableStorage('TrackedTickets', [
    { partitionKey: 'SN-1', rowKey: 'offline', ticketId: '222', ticketNumber: 'T222' },  // appliance back online -> auto-heal
    { partitionKey: 'SN-1', rowKey: 'storage', ticketId: '333', ticketNumber: 'T333' },  // completed in Autotask -> pruned
  ]);
}

function installMocks() {
  process.env.DATTO_KEY = 'test-key:test-secret';
  mockedAxios.get.mockImplementation(async (url: string) => {
    if (url.includes('/asset')) return { data: ASSETS } as any;
    if (url.includes('/bcdr/device')) return { data: { items: [DEVICE] } } as any;
    throw new Error(`unexpected GET ${url}`);
  });
  mocked.getAutoTaskConfig.mockReturnValue({ user: 'u', secret: 's', integrationCode: 'i' } as any);
  mocked.getAutoTaskBaseUrl.mockResolvedValue('https://webservices16.autotask.net/atservicesrest/v1.0/');
  mocked.getAutoTaskTicketUrl.mockImplementation((_b: string, id: string | number) => `https://ww16.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc/Index?ticketId=${id}`);
  mocked.getTicketStatusPicklistValues.mockResolvedValue([{ value: 1, label: 'New' }] as any);
  mocked.queryTicketsInAutoTask.mockResolvedValue([
    { id: 222, status: 1, ticketNumber: 'T222' },
    { id: 333, status: 5, ticketNumber: 'T333' },
  ] as any);
  mocked.getSingleTicketFromAutoTask.mockImplementation(async (id: number) => ({ id, status: 1, ticketNumber: `T${id}` }) as any);
  mocked.createComplianceTicket.mockResolvedValue({ ticketId: 500 } as any);
  mocked.createTicketNoteInAutoTask.mockResolvedValue(true as any);
  mocked.updateTicketStatusInAutoTask.mockResolvedValue(true as any);
}

async function load(role: MockRole, query: Record<string, string> = {}) {
  const context = createMockContext();
  await backupWatchTrigger(context, createMockRequest({ method: 'GET', query, headers: easyAuthHeadersFor(role) }));
  return { context, res: context.res as { status: number; body: any; headers: Record<string, string> } };
}

const tables = () => ({
  exclusions: getTableEntities('Exclusions'),
  tracked: getTableEntities('TrackedTickets'),
  scanStatus: getTableEntities('ScanStatus'),
});

function expectNoAutotaskWrites() {
  for (const fn of AUTOTASK_WRITES) expect(mocked[fn]).not.toHaveBeenCalled();
}

beforeEach(() => {
  jest.clearAllMocks();
  resetTableStorageMocks();
  __resetDashboardCacheForTests();
  invalidateSilenceCache();
  __setScanLockTimingForTests(5, 60);
  installMocks();
  seedScenario();
});

describe('Opening the dashboard is read-only', () => {
  test.each(['Viewer', 'Contributor', 'Specialist', 'Administrator'] as MockRole[])('%s: no Autotask writes, no table changes', async role => {
    const before = tables();
    const { res } = await load(role);

    expect(res.status).toBe(200);
    expect(res.headers['X-Scan']).toBe('none');
    expectNoAutotaskWrites();
    expect(tables()).toEqual(before);
  });

  test('still shows the same information: tickets, exclusions, storage, status', async () => {
    const { res } = await load('Viewer');
    const device = res.body.devices.find((d: any) => d.deviceName === 'APP-1');

    expect(device).toBeDefined();
    expect(device.isOffline).toBe(false);
    expect(device.storageUsedPercent).toBe(10);
    // The offline ticket is shown until a scan posts its auto-heal note
    expect(device.offlineTicketReference).toMatchObject({ ticketId: '222', ticketNumber: 'T222' });
    // A ticket completed in Autotask is not shown (the scan prunes its record)
    expect(device.storageTicketReference).toBeNull();
    // The excluded volume and the unprotected volume are both listed
    const agent = device.agents.find((a: any) => a.name === 'SRV-1');
    expect(agent.excludedVolumes.map((v: any) => v.name).sort()).toEqual(['D', 'E']);
  });

  test('Autotask reads still happen (live ticket status)', async () => {
    await load('Viewer');
    expect(mocked.queryTicketsInAutoTask).toHaveBeenCalled();
  });

  test('Viewer/Contributor asking for refresh=true get a read-only load', async () => {
    for (const role of ['Viewer', 'Contributor'] as MockRole[]) {
      __resetDashboardCacheForTests();
      const before = tables();
      const { res } = await load(role, { refresh: 'true' });
      expect(res.headers['X-Scan']).toBe('none');
      expectNoAutotaskWrites();
      expect(tables()).toEqual(before);
    }
    expect(getTableEntities('AuditLogs').filter(e => e.action === 'Force Scan')).toHaveLength(0);
  });
});

describe('Force Scan (Specialist/Administrator)', () => {
  test.each(['Specialist', 'Administrator'] as MockRole[])('%s: runs the full scan with all its writes', async role => {
    const { res } = await load(role, { refresh: 'true' });

    expect(res.status).toBe(200);
    expect(res.headers['X-Scan']).toBe('ran');
    // New unprotected volume -> compliance ticket
    expect(mocked.createComplianceTicket).toHaveBeenCalledTimes(1);
    expect(mocked.createComplianceTicket.mock.calls[0][0]).toMatchObject({ deviceName: 'APP-1', agentName: 'SRV-1', volumeName: 'E' });
    // Auto-heal notes: the swept volume exclusion (111) and the offline ticket (222)
    const notedTickets = mocked.createTicketNoteInAutoTask.mock.calls.map(c => c[0]).sort();
    expect(notedTickets).toEqual([111, 222]);
    for (const call of mocked.createTicketNoteInAutoTask.mock.calls) expect(call[3]).toMatchObject({ origin: 'scanner' });

    const after = tables();
    expect(after.tracked).toEqual([]);                                   // 222 healed, 333 pruned
    expect(after.exclusions.map(e => e.target)).toEqual(['APP-1:SRV-1:E']); // D healed, E added
    expect(after.scanStatus.find(e => e.rowKey === 'BCDRScanner')).toMatchObject({ status: 'Success' });
    expect(after.scanStatus.find(e => e.partitionKey === 'Lock')).toBeUndefined();   // lock released

    const audit = getTableEntities('AuditLogs').filter(e => e.action === 'Force Scan');
    expect(audit).toHaveLength(1);
    expect(audit[0].userEmail).toBe(`${role.toLowerCase()}@fifosys.com`);

    // The updated dashboard comes back in the same response
    const device = res.body.devices.find((d: any) => d.deviceName === 'APP-1');
    expect(device.offlineTicketReference).toBeNull();
  });

  test('keeps the timer\'s next-scan time', async () => {
    seedTableStorage('ScanStatus', [{ partitionKey: 'Status', rowKey: 'BCDRScanner', lastScan: 'old', nextScan: '18/10/2026, 15:00:00', status: 'Success', errorMessage: '' }]);
    await load('Specialist', { refresh: 'true' });
    const status = getTableEntities('ScanStatus').find(e => e.rowKey === 'BCDRScanner')!;
    expect(status.nextScan).toBe('18/10/2026, 15:00:00');
    expect(status.lastScan).not.toBe('old');
  });

  test('a scan already running: waits, then returns fresh read-only data without scanning again', async () => {
    seedTableStorage('ScanStatus', [{
      partitionKey: 'Lock', rowKey: 'BCDRScanner', owner: 'Timer scan',
      acquiredAt: new Date().toISOString(), lockedUntil: new Date(Date.now() + 60000).toISOString(),
    }]);
    const before = tables();
    const { res } = await load('Specialist', { refresh: 'true' });

    expect(res.status).toBe(200);
    expect(res.headers['X-Scan']).toBe('joined');
    expectNoAutotaskWrites();
    expect(tables().exclusions).toEqual(before.exclusions);
    expect(tables().tracked).toEqual(before.tracked);
    expect(getTableEntities('ScanStatus').find(e => e.partitionKey === 'Lock')).toMatchObject({ owner: 'Timer scan' });
  });

  test('an expired lock (crashed scan) does not block a Force Scan', async () => {
    seedTableStorage('ScanStatus', [{
      partitionKey: 'Lock', rowKey: 'BCDRScanner', owner: 'Timer scan',
      acquiredAt: new Date(Date.now() - 3600000).toISOString(), lockedUntil: new Date(Date.now() - 1000).toISOString(),
    }]);
    const { res } = await load('Administrator', { refresh: 'true' });
    expect(res.headers['X-Scan']).toBe('ran');
    expect(mocked.createComplianceTicket).toHaveBeenCalledTimes(1);
  });
});

describe('Guard rail: only a locked scan may run the pipeline in scan (write) mode', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const root = path.resolve(__dirname, '..');
  const sources: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      if (['node_modules', 'dist', 'tests', 'scratch', 'tools'].includes(name)) continue;
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.ts')) sources.push(full);
    }
  };
  walk(root);

  test('every runPipeline(…, true) call sits inside withScanLock', () => {
    const offenders: string[] = [];
    let found = 0;
    for (const file of sources) {
      const text = fs.readFileSync(file, 'utf8');
      const re = /runPipeline\(\s*context\s*,[^,()]+,\s*true\s*\)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        found++;
        if (!text.slice(Math.max(0, m.index - 300), m.index).includes('withScanLock(')) {
          offenders.push(`${path.relative(root, file)}:${text.slice(0, m.index).split('\n').length}`);
        }
      }
    }
    expect(found).toBeGreaterThanOrEqual(2); // timer + Force Scan
    expect(offenders).toEqual([]);
  });
});
