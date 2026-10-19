/**
 * Exclusions on archived agents (BW-025, Option A)
 *
 * Found live: KUI-DATTO-05:KSLCARPEDIEM01 was archived in Datto, so the sweep skipped its exclusions silently and the
 * closed ticket was never noticed. Datto also lists archived and live copies of an agent under the same name, and the
 * sweep used whichever came first. Now: the live copy is preferred; an agent whose every copy is archived has its
 * exclusion retired (note on an open ticket, then removed, audited); anything else skipped is logged.
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
import { invalidateSilenceCache } from '../shared/autotaskPolicy';
import { resetTableStorageMocks, seedTableStorage, getTableEntities } from './mocks/tableStorage';
import { createMockContext, createMockRequest, easyAuthHeadersFor, MockRole } from './mocks/functions';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mocked = at as jest.Mocked<typeof at>;

const DEVICE = {
  name: 'KUI-DATTO-05', serialNumber: 'SN-KUI', clientCompanyName: 'KUI Ltd', model: 'S5-X', isActive: true,
  lastCheckin: new Date().toISOString(), localStorageUsed: { size: 1, units: 'GB' }, localStorageAvailable: { size: 9, units: 'GB' },
};
const agent = (name: string, isArchived: boolean, protectedVols: string[], unprotectedVols: string[] = []) =>
  ({ name, hostname: `${name.toLowerCase()}.kui.local`, isArchived, isPaused: false, protectedVolumeNames: protectedVols, unprotectedVolumeNames: unprotectedVols, backups: [] });

let assets: any[] = [];
let assetsFail = false;
const tickets: Record<number, any> = {};

const exclusion = (agentName: string, vol: string, ticketId: number | null, extra: Record<string, any> = {}) => ({
  partitionKey: 'Exclusion',
  rowKey: encodeURIComponent(`Volume:KUI-DATTO-05:${agentName}:${vol}`),
  type: 'Volume',
  target: `KUI-DATTO-05:${agentName}:${vol}`,
  reason: '',
  isPermanent: false,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  ticketNumber: ticketId ? `T${ticketId}` : null,
  ticketUrl: ticketId ? `https://ww16.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc/Index?ticketId=${ticketId}` : null,
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  resetTableStorageMocks();
  __resetDashboardCacheForTests();
  invalidateSilenceCache();
  assets = [];
  assetsFail = false;
  for (const k of Object.keys(tickets)) delete tickets[+k];
  process.env.DATTO_KEY = 'test-key:test-secret';
  mockedAxios.get.mockImplementation(async (url: string) => {
    if (url.includes('/asset')) {
      if (assetsFail) throw new Error('Request failed with status code 500');
      return { data: assets } as any;
    }
    if (url.includes('/bcdr/device')) return { data: { items: [DEVICE] } } as any;
    throw new Error(`unexpected GET ${url}`);
  });
  mocked.getAutoTaskConfig.mockReturnValue({ user: 'u', secret: 's', integrationCode: 'i' } as any);
  mocked.getAutoTaskBaseUrl.mockResolvedValue('https://webservices16.autotask.net/atservicesrest/v1.0/');
  mocked.getAutoTaskTicketUrl.mockImplementation((_b: string, id: string | number) => `https://x/?ticketId=${id}`);
  mocked.getTicketStatusPicklistValues.mockResolvedValue([] as any);
  mocked.queryTicketsInAutoTask.mockResolvedValue([] as any);
  mocked.getSingleTicketFromAutoTask.mockImplementation(async (id: number) => tickets[id] || null);
  mocked.createTicketNoteInAutoTask.mockResolvedValue(true as any);
  mocked.createComplianceTicket.mockResolvedValue({ ticketId: 900 } as any);
  mocked.updateTicketStatusInAutoTask.mockResolvedValue(true as any);
});

async function call(role: MockRole, query: Record<string, string>) {
  const context = createMockContext();
  await backupWatchTrigger(context, createMockRequest({ method: 'GET', query, headers: easyAuthHeadersFor(role) }));
  return { context, res: context.res as { status: number; body: any } };
}
const scan = () => call('Administrator', { refresh: 'true' });
const exclusionTargets = () => getTableEntities('Exclusions').map(e => e.target).sort();
const audits = (action: string) => getTableEntities('AuditLogs').filter(e => e.action === action);
const logged = (context: any, level: 'info' | 'warn', text: string) =>
  context.log[level].mock.calls.some((c: any[]) => String(c[0]).includes(text));

describe('Agent archived in Datto (every copy)', () => {
  beforeEach(() => {
    assets = [agent('KSLCARPEDIEM01', true, ['C:\\']), agent('KSLCARPEDIEM01', true, ['C:\\', 'E:\\', 'H:\\']), agent('KSLDC02', false, ['C:\\'])];
  });

  test('closed ticket: exclusion removed, no note, audited', async () => {
    tickets[149337] = { id: 149337, status: 5, ticketNumber: 'T20260827.0293' };
    seedTableStorage('Exclusions', [exclusion('KSLCARPEDIEM01', 'G', 149337, { expiresAt: '2026-09-10T16:43:10.757Z' })]);

    const { context } = await scan();

    expect(exclusionTargets()).toEqual([]);
    expect(mocked.createTicketNoteInAutoTask).not.toHaveBeenCalled();
    expect(mocked.createComplianceTicket).not.toHaveBeenCalled();
    const [audit] = audits('Removed Exclusion (Agent Archived)');
    expect(audit).toMatchObject({ userEmail: 'system@fifosys.com', target: 'KUI-DATTO-05:KSLCARPEDIEM01:G' });
    expect(audit.details).toContain('was closed');
    expect(logged(context, 'info', 'is archived in Datto')).toBe(true);
  });

  test('open ticket: one note posted on it, then the exclusion is removed', async () => {
    tickets[149336] = { id: 149336, status: 1, ticketNumber: 'T20260827.0292' };
    seedTableStorage('Exclusions', [exclusion('KSLCARPEDIEM01', 'F', 149336)]);

    await scan();

    expect(mocked.createTicketNoteInAutoTask).toHaveBeenCalledTimes(1);
    const [ticketId, note, , ctx] = mocked.createTicketNoteInAutoTask.mock.calls[0];
    expect(ticketId).toBe(149336);
    expect(note.title).toContain('Agent archived in Datto');
    expect(note.description).toContain('KSLCARPEDIEM01');
    expect(ctx).toMatchObject({ origin: 'scanner', deviceName: 'KUI-DATTO-05', agentName: 'KSLCARPEDIEM01' });
    expect(exclusionTargets()).toEqual([]);
    expect(audits('Removed Exclusion (Agent Archived)')[0].details).toContain('note posted');
  });

  test('note not posted (Autotask error or held back): nothing removed, retried next scan', async () => {
    tickets[149336] = { id: 149336, status: 1, ticketNumber: 'T20260827.0292' };
    seedTableStorage('Exclusions', [exclusion('KSLCARPEDIEM01', 'F', 149336)]);
    mocked.createTicketNoteInAutoTask.mockResolvedValue(false as any);

    const { context } = await scan();

    expect(exclusionTargets()).toEqual(['KUI-DATTO-05:KSLCARPEDIEM01:F']);
    expect(audits('Removed Exclusion (Agent Archived)')).toHaveLength(0);
    expect(logged(context, 'warn', 'will retry next scan')).toBe(true);
  });

  test('no ticket on the exclusion: removed and audited', async () => {
    seedTableStorage('Exclusions', [exclusion('KSLCARPEDIEM01', 'G', null)]);
    await scan();
    expect(exclusionTargets()).toEqual([]);
    expect(mocked.createTicketNoteInAutoTask).not.toHaveBeenCalled();
    expect(audits('Removed Exclusion (Agent Archived)')).toHaveLength(1);
  });

  test('ticket cannot be fetched: nothing removed (tried again next scan)', async () => {
    seedTableStorage('Exclusions', [exclusion('KSLCARPEDIEM01', 'G', 149337)]);
    mocked.getSingleTicketFromAutoTask.mockRejectedValue(new Error('timeout'));
    await scan();
    expect(exclusionTargets()).toEqual(['KUI-DATTO-05:KSLCARPEDIEM01:G']);
  });

  test('a dashboard load (read-only) leaves it alone', async () => {
    tickets[149337] = { id: 149337, status: 5, ticketNumber: 'T20260827.0293' };
    seedTableStorage('Exclusions', [exclusion('KSLCARPEDIEM01', 'G', 149337)]);
    await call('Administrator', {});
    expect(exclusionTargets()).toEqual(['KUI-DATTO-05:KSLCARPEDIEM01:G']);
    expect(mocked.createTicketNoteInAutoTask).not.toHaveBeenCalled();
  });

  test('silenced appliance: left alone (silence wins, D-01)', async () => {
    tickets[149337] = { id: 149337, status: 5, ticketNumber: 'T20260827.0293' };
    seedTableStorage('Exclusions', [
      exclusion('KSLCARPEDIEM01', 'G', 149337),
      { partitionKey: 'Exclusion', rowKey: 'Device%3AKUI-DATTO-05', type: 'Device', target: 'KUI-DATTO-05', reason: 'Migration' },
    ]);
    await scan();
    expect(exclusionTargets()).toContain('KUI-DATTO-05:KSLCARPEDIEM01:G');
  });
});

describe('Same agent name listed archived and live', () => {
  test('the live copy is used: a volume now protected on the live server auto-heals', async () => {
    // Archived copy first (as Datto returned it for KSLSQL01), live copy second with F now protected
    assets = [agent('KSLSQL01', true, ['E:\\'], ['F:\\']), agent('KSLSQL01', false, ['C:\\', 'E:\\', 'F:\\'])];
    tickets[500] = { id: 500, status: 1, ticketNumber: 'T500' };
    seedTableStorage('Exclusions', [exclusion('KSLSQL01', 'F', 500)]);

    await scan();

    expect(mocked.createTicketNoteInAutoTask).toHaveBeenCalledTimes(1);
    expect(mocked.createTicketNoteInAutoTask.mock.calls[0][1].title).toContain('AUTO-HEAL');
    expect(exclusionTargets()).toEqual([]);
    expect(audits('Removed Exclusion (Agent Archived)')).toHaveLength(0);
  });

  test('the live copy is used: a volume still unprotected on the live server is not retired', async () => {
    assets = [agent('KSLSQL01', true, ['C:\\']), agent('KSLSQL01', false, ['C:\\'], ['F:\\'])];
    tickets[500] = { id: 500, status: 1, ticketNumber: 'T500' };
    seedTableStorage('Exclusions', [exclusion('KSLSQL01', 'F', 500)]);

    await scan();

    expect(exclusionTargets()).toEqual(['KUI-DATTO-05:KSLSQL01:F']);
    expect(mocked.createTicketNoteInAutoTask).not.toHaveBeenCalled();
    expect(audits('Removed Exclusion (Agent Archived)')).toHaveLength(0);
  });
});

describe('Never treat missing data as "archived"', () => {
  test('agent list could not be fetched: untouched, reason logged', async () => {
    assetsFail = true;
    tickets[149337] = { id: 149337, status: 5, ticketNumber: 'T20260827.0293' };
    seedTableStorage('Exclusions', [exclusion('KSLCARPEDIEM01', 'G', 149337)]);

    const { context } = await scan();

    expect(exclusionTargets()).toEqual(['KUI-DATTO-05:KSLCARPEDIEM01:G']);
    expect(logged(context, 'info', 'could not be fetched this scan')).toBe(true);
  });

  test('agent not found at all (renamed or removed): untouched, warning logged', async () => {
    assets = [agent('KSLDC02', false, ['C:\\'])];
    tickets[149337] = { id: 149337, status: 5, ticketNumber: 'T20260827.0293' };
    seedTableStorage('Exclusions', [exclusion('KSLCARPEDIEM01', 'G', 149337)]);

    const { context } = await scan();

    expect(exclusionTargets()).toEqual(['KUI-DATTO-05:KSLCARPEDIEM01:G']);
    expect(logged(context, 'warn', 'not found on KUI-DATTO-05')).toBe(true);
  });
});

describe('Admin Console Cleanup', () => {
  beforeEach(() => {
    assets = [agent('KSLCARPEDIEM01', true, ['C:\\']), agent('KSLDC02', false, ['C:\\'])];
    seedTableStorage('Exclusions', [exclusion('KSLCARPEDIEM01', 'G', 149337), exclusion('KSLDC02', 'D', 600)]);
  });

  test('lists an archived agent\'s exclusion as an orphan, even straight after a restart', async () => {
    // Nothing in memory (fresh instance): the cleanup loads the data itself
    const { res } = await call('Administrator', { action: 'adminCleanup' });

    expect(res.status).toBe(200);
    expect(res.body.orphanExclusions.map((o: any) => o.target)).toEqual(['KUI-DATTO-05:KSLCARPEDIEM01:G']);
    // Listing is read-only
    expect(exclusionTargets()).toHaveLength(2);
    expect(mocked.createTicketNoteInAutoTask).not.toHaveBeenCalled();
  });
});
