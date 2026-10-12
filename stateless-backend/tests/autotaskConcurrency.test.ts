/**
 * Autotask Concurrency Tests
 * Replaces scratch/test_autotask_concurrency.js. Exercises the real in-flight promise lock and
 * 1-hour cache in shared/autotask.ts getTicketEntityFields, with axios mocked.
 */
jest.mock('axios');

import axios from 'axios';
import { installAutotaskMock } from './mocks/autotask';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const CONFIG = { user: 'api@test', secret: 'x', integrationCode: 'x' };

// getTicketEntityFields keeps module-level cache/lock state, so load a fresh copy per test.
function loadAutotask(): typeof import('../shared/autotask') {
  let mod: any;
  jest.isolateModules(() => {
    jest.doMock('axios', () => mockedAxios);
    // Near-zero gateway retry delays (BW-004) so failure paths don't wait 1 s + 2 s + 4 s.
    require('../shared/autotaskGateway').__configureAutotaskGatewayForTests({ retryDelaysMs: [1, 1, 1] });
    mod = require('../shared/autotask');
  });
  return mod;
}

describe('Autotask ticket-field metadata: concurrency lock & cache', () => {
  let fieldCalls: number;
  let inFlight: number;
  let peakInFlight: number;

  beforeEach(() => {
    jest.resetAllMocks();
    installAutotaskMock(mockedAxios);
    fieldCalls = 0;
    inFlight = 0;
    peakInFlight = 0;

    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.includes('zoneInformation')) {
        return { data: { url: 'https://webservices16.autotask.net/atservicesrest/' } };
      }
      if (url.endsWith('Tickets/entityInformation/fields')) {
        fieldCalls++;
        inFlight++;
        peakInFlight = Math.max(peakInFlight, inFlight);
        await new Promise(r => setTimeout(r, 30));
        inFlight--;
        return { data: { fields: [{ name: 'status', picklistValues: [{ value: '1', label: 'New', isActive: true }] }] } };
      }
      throw new Error(`Unexpected GET ${url}`);
    });
  });

  test('10 parallel callers collapse into exactly 1 Autotask fields request', async () => {
    const { getTicketEntityFields } = loadAutotask();

    const results = await Promise.all(Array.from({ length: 10 }, () => getTicketEntityFields(CONFIG)));

    expect(fieldCalls).toBe(1);
    expect(peakInFlight).toBe(1);
    for (const r of results) expect(r).toEqual(results[0]);
  });

  test('cached fields are reused without another request; forceRefresh refetches', async () => {
    const { getTicketEntityFields } = loadAutotask();

    await getTicketEntityFields(CONFIG);
    await getTicketEntityFields(CONFIG);
    expect(fieldCalls).toBe(1);

    await getTicketEntityFields(CONFIG, true);
    expect(fieldCalls).toBe(2);
  });

  test('lock is released after a failure so the next call retries', async () => {
    const { getTicketEntityFields } = loadAutotask();
    const ok = mockedAxios.get.getMockImplementation()!;
    const fail = async () => { throw new Error('socket hang up'); };
    // zoneInformation succeeds; the fields request fails on all 4 gateway attempts (1 + 3 retries).
    mockedAxios.get.mockImplementationOnce(ok)
      .mockImplementationOnce(fail).mockImplementationOnce(fail)
      .mockImplementationOnce(fail).mockImplementationOnce(fail);

    await expect(getTicketEntityFields(CONFIG)).resolves.toEqual([]);
    await expect(getTicketEntityFields(CONFIG)).resolves.toHaveLength(1);
  });
});
