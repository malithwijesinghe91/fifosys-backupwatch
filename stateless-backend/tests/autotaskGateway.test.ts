/**
 * Autotask gateway (BW-004)
 * Drives the real gateway with axios mocked: one request at a time per instance, user actions
 * ahead of scanner calls, retry rules, queue wait cap, safe logging – and the scanner's auto-heal
 * path never exceeding one Autotask request at a time.
 */
jest.mock('axios');
jest.mock('../shared/tableService', () => require('./mocks/tableStorage').tableServiceMock);
jest.mock('../shared/configService', () => ({
  ...jest.requireActual('../shared/configService'),
  getGlobalMaintenanceMode: jest.fn(async () => ({ isActive: false })),
}));

import axios from 'axios';
import {
  autotaskRequest,
  runAsUserAction,
  getAutotaskGatewayStats,
  __configureAutotaskGatewayForTests,
  AutotaskQueueTimeoutError,
  AUTOTASK_MAX_CONCURRENT,
} from '../shared/autotaskGateway';
import { __resetAutotaskPolicyForTests } from '../shared/autotaskPolicy';
import { handleAutoHeal } from '../backupWatchTrigger/index';
import { resetTableStorageMocks, seedTableStorage, getTableEntities } from './mocks/tableStorage';
import { createMockContext } from './mocks/functions';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const CONFIG = { user: 'api@test', secret: 'TOP-SECRET-VALUE', integrationCode: 'INTEGRATION-CODE' };
const BASE = 'https://webservices16.autotask.net/atservicesrest/v1.0/';

let inFlight = 0;
let peak = 0;
let order: string[] = [];

/** Each mocked request takes `ms`, records its label and tracks how many run at once. */
function slowOk(ms = 15) {
  return async (url: string) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise(r => setTimeout(r, ms));
    inFlight--;
    order.push(String(url).split('/').pop() || url);
    return { status: 200, data: { url: BASE, items: [], item: { id: 1, ticketNumber: 'T1' } } };
  };
}

function httpError(status: number, data?: any) {
  return Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });
}

beforeEach(() => {
  jest.resetAllMocks();
  resetTableStorageMocks();
  __resetAutotaskPolicyForTests();
  __configureAutotaskGatewayForTests({ retryDelaysMs: [5, 5, 5], maxQueueWaitMs: 60_000, resetStats: true });
  inFlight = 0;
  peak = 0;
  order = [];
  const ok = slowOk();
  mockedAxios.get.mockImplementation(ok as any);
  mockedAxios.post.mockImplementation(ok as any);
  mockedAxios.patch.mockImplementation(ok as any);
  require('../shared/configService').getGlobalMaintenanceMode.mockResolvedValue({ isActive: false });
});

describe('Concurrency', () => {
  test('limit is 1 request per instance', () => {
    expect(AUTOTASK_MAX_CONCURRENT).toBe(1);
  });

  test('10 parallel requests reach Autotask one at a time, all complete', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => autotaskRequest(CONFIG, { method: 'get', kind: 'read', url: `${BASE}Tickets/${i}` }))
    );
    expect(results).toHaveLength(10);
    expect(peak).toBe(1);
    expect(mockedAxios.get).toHaveBeenCalledTimes(10);
    expect(getAutotaskGatewayStats().peakInFlight).toBe(1);
    expect(getAutotaskGatewayStats().inFlight).toBe(0);
  });

  test('reads and writes share the same single slot', async () => {
    await Promise.all([
      autotaskRequest(CONFIG, { method: 'get', kind: 'read', url: `${BASE}Tickets/1` }),
      autotaskRequest(CONFIG, { method: 'post', kind: 'write', url: `${BASE}Tickets/1/Notes`, data: {} }),
      autotaskRequest(CONFIG, { method: 'patch', kind: 'write', url: `${BASE}Tickets`, data: {} }),
      autotaskRequest(CONFIG, { method: 'post', kind: 'read', url: `${BASE}Tickets/query`, data: {} }),
    ]);
    expect(peak).toBe(1);
  });
});

describe('Priority: engineer actions go ahead of scanner calls', () => {
  test('a user request queued behind scanner requests is served next', async () => {
    const scanner = Array.from({ length: 5 }, (_, i) =>
      autotaskRequest(CONFIG, { method: 'get', kind: 'read', url: `${BASE}scan${i}` }));
    // Let scan0 start, then the engineer clicks Escalate.
    await new Promise(r => setTimeout(r, 2));
    const user = runAsUserAction(() => autotaskRequest(CONFIG, { method: 'post', kind: 'write', url: `${BASE}user`, data: {} }));
    await Promise.all([...scanner, user]);
    expect(order[0]).toBe('scan0');
    expect(order[1]).toBe('user');
    expect(order.slice(2)).toEqual(['scan1', 'scan2', 'scan3', 'scan4']);
  });

  test('requests of the same priority keep their arrival order', async () => {
    await Promise.all(Array.from({ length: 4 }, (_, i) =>
      runAsUserAction(() => autotaskRequest(CONFIG, { method: 'get', kind: 'read', url: `${BASE}u${i}` }))));
    expect(order).toEqual(['u0', 'u1', 'u2', 'u3']);
  });
});

describe('Retries', () => {
  test('429 is retried, including for writes, and then succeeds', async () => {
    mockedAxios.post.mockRejectedValueOnce(httpError(429)).mockImplementation(slowOk(1) as any);
    const res = await autotaskRequest(CONFIG, { method: 'post', kind: 'write', url: `${BASE}Tickets`, data: {} });
    expect(res.status).toBe(200);
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    expect(getAutotaskGatewayStats().retries).toBe(1);
  });

  test('"thread threshold" error text is treated as busy and retried', async () => {
    mockedAxios.post
      .mockRejectedValueOnce(httpError(500, { errors: ['Thread Threshold Exceeded for this API user'] }))
      .mockImplementation(slowOk(1) as any);
    await autotaskRequest(CONFIG, { method: 'post', kind: 'write', url: `${BASE}Tickets/5/Notes`, data: {} });
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });

  test('a write that fails with 500 is NOT retried (it may already have created the ticket)', async () => {
    mockedAxios.post.mockRejectedValue(httpError(500));
    await expect(autotaskRequest(CONFIG, { method: 'post', kind: 'write', url: `${BASE}Tickets`, data: {} }))
      .rejects.toThrow('500');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  test('a read that fails with 500 or a network error is retried', async () => {
    mockedAxios.get
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockImplementation(slowOk(1) as any);
    await autotaskRequest(CONFIG, { method: 'get', kind: 'read', url: `${BASE}Tickets/1` });
    expect(mockedAxios.get).toHaveBeenCalledTimes(3);
  });

  test('gives up after 4 attempts (1 + 3 retries) and releases the slot', async () => {
    mockedAxios.get.mockRejectedValue(httpError(429));
    await expect(autotaskRequest(CONFIG, { method: 'get', kind: 'read', url: `${BASE}Tickets/1` })).rejects.toThrow('429');
    expect(mockedAxios.get).toHaveBeenCalledTimes(4);
    expect(getAutotaskGatewayStats().inFlight).toBe(0);
  });

  test('a 404 is not retried', async () => {
    mockedAxios.get.mockRejectedValue(httpError(404));
    await expect(autotaskRequest(CONFIG, { method: 'get', kind: 'read', url: `${BASE}Tickets/9` })).rejects.toThrow('404');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });
});

describe('Queue wait cap', () => {
  test('a request that cannot start in time fails cleanly; the slot holder still completes', async () => {
    __configureAutotaskGatewayForTests({ maxQueueWaitMs: 30 });
    let release!: () => void;
    mockedAxios.get.mockImplementationOnce(() => new Promise(r => { release = () => r({ status: 200, data: {} }); }) as any);
    const holder = autotaskRequest(CONFIG, { method: 'get', kind: 'read', url: `${BASE}slow` });
    await expect(autotaskRequest(CONFIG, { method: 'get', kind: 'read', url: `${BASE}waiting` }))
      .rejects.toBeInstanceOf(AutotaskQueueTimeoutError);
    release();
    await expect(holder).resolves.toMatchObject({ status: 200 });
    expect(getAutotaskGatewayStats().queueTimeouts).toBe(1);
    expect(getAutotaskGatewayStats().queuedBackground).toBe(0);
  });
});

describe('Headers and logging', () => {
  test('credentials are sent as headers; zoneInformation is sent without them', async () => {
    await autotaskRequest(CONFIG, { method: 'get', kind: 'read', url: `${BASE}Tickets/1` });
    await autotaskRequest(null, { method: 'get', kind: 'read', anonymous: true, url: 'https://webservices.autotask.net/atservicesrest/v1.0/zoneInformation?user=api%40test' });
    expect(mockedAxios.get.mock.calls[0][1]).toMatchObject({ headers: { UserName: 'api@test', Secret: 'TOP-SECRET-VALUE', ApiIntegrationCode: 'INTEGRATION-CODE' } });
    expect((mockedAxios.get.mock.calls[1][1] as any).headers).toBeUndefined();
  });

  test('logs never contain credentials or query strings', async () => {
    const logs: string[] = [];
    const spies = ['log', 'warn', 'error'].map(m =>
      jest.spyOn(console, m as any).mockImplementation((...a: any[]) => { logs.push(a.join(' ')); }));
    mockedAxios.get.mockRejectedValueOnce(httpError(429)).mockImplementation(slowOk(1) as any);
    await autotaskRequest(null, { method: 'get', kind: 'read', anonymous: true, url: 'https://webservices.autotask.net/atservicesrest/v1.0/zoneInformation?user=api%40test' });
    await autotaskRequest(CONFIG, { method: 'get', kind: 'read', url: `${BASE}Tickets/1` });
    spies.forEach(s => s.mockRestore());
    const all = logs.join('\n');
    expect(all).toContain('[Autotask Gateway]');
    expect(all).not.toContain('TOP-SECRET-VALUE');
    expect(all).not.toContain('INTEGRATION-CODE');
    expect(all).not.toContain('api%40test');
    expect(all).not.toContain('?user=');
  });
});

describe('Scanner auto-heal through the real gateway', () => {
  test('10 simultaneous auto-heals: never more than 1 Autotask request at a time; all notes posted', async () => {
    const ctx = createMockContext();
    seedTableStorage('TrackedTickets', Array.from({ length: 10 }, (_, i) => ({ partitionKey: `SER${i}`, rowKey: 'storage', ticketId: String(100 + i) })));
    const tickets = { deleteEntity: require('./mocks/tableStorage').getMockTableClient('TrackedTickets').deleteEntity };

    const healed = await Promise.all(Array.from({ length: 10 }, (_, i) =>
      handleAutoHeal(tickets, `SER${i}`, 'storage', String(100 + i), 'Storage cleared', CONFIG, ctx, { deviceName: `DEV${i}`, exclusions: [] })));

    expect(healed.every(Boolean)).toBe(true);
    expect(peak).toBe(1);
    const noteCalls = mockedAxios.post.mock.calls.filter(c => String(c[0]).endsWith('/Notes'));
    expect(noteCalls).toHaveLength(10);
    expect(getTableEntities('TrackedTickets')).toHaveLength(0);
  });

  test.each([
    ['appliance silenced', { deviceName: 'DEV1', exclusions: [{ type: 'Device', target: 'DEV1' }] }, false],
    ['agent silenced', { deviceName: 'DEV1', agentName: 'SRV1', exclusions: [{ type: 'Agent', target: 'DEV1:SRV1' }] }, false],
    ['change freeze', { deviceName: 'DEV1', exclusions: [] }, true],
  ])('%s: no note is sent and the ticket stays tracked for a later scan', async (_label, target: any, freeze) => {
    if (freeze) require('../shared/configService').getGlobalMaintenanceMode.mockResolvedValue({ isActive: true });
    seedTableStorage('TrackedTickets', [{ partitionKey: 'SER1', rowKey: 'storage', ticketId: '777' }]);
    const tickets = require('./mocks/tableStorage').getMockTableClient('TrackedTickets');

    const healed = await handleAutoHeal(tickets, 'SER1', 'storage', '777', 'Storage cleared', CONFIG, createMockContext(), target);

    expect(healed).toBe(false);
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(getTableEntities('TrackedTickets')).toHaveLength(1);
  });
});
