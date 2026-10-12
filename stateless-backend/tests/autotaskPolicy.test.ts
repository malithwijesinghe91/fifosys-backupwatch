/**
 * Autotask write policy (BW-006 / BW-007, decisions D-01 and D-02)
 * Matrix of every write type x every silence tier x blackout on/off x origin/role, plus the real
 * write functions in shared/autotask.ts: suppressed writes never reach axios.
 */
jest.mock('axios');
jest.mock('../shared/tableService', () => require('./mocks/tableStorage').tableServiceMock);
jest.mock('../shared/configService', () => ({
  ...jest.requireActual('../shared/configService'),
  getGlobalMaintenanceMode: jest.fn(),
  getAlertRoutingMatrix: jest.fn(async () => jest.requireActual('../shared/configService').DEFAULT_ALERT_ROUTING_MATRIX),
  getAutotaskRoutingConfig: jest.fn(async () => ({})),
}));

import axios from 'axios';
import { getGlobalMaintenanceMode } from '../shared/configService';
import {
  evaluateAutotaskWrite,
  guardAutotaskWrite,
  AutotaskWriteBlockedError,
  IAutotaskWriteContext,
  __resetAutotaskPolicyForTests,
} from '../shared/autotaskPolicy';
import { __configureAutotaskGatewayForTests } from '../shared/autotaskGateway';
import {
  createTicketNoteInAutoTask,
  createTicketInAutoTask,
  updateTicketStatusInAutoTask,
  createComplianceTicket,
} from '../shared/autotask';
import { resetTableStorageMocks, seedTableStorage, getTableEntities } from './mocks/tableStorage';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const maint = getGlobalMaintenanceMode as jest.Mock;
const CONFIG = { user: 'api@test', secret: 's', integrationCode: 'i' };
const BASE = 'https://webservices16.autotask.net/atservicesrest/v1.0/';

const DEV = 'FIF-DATTO-01';
const AGENT = 'DC-01';

// Silence tiers: which exclusions exist
const TIERS: Record<string, any[]> = {
  none: [],
  appliance: [{ type: 'Device', target: DEV }],
  agent: [{ type: 'Agent', target: `${DEV}:${AGENT}` }],
  'other agent only': [{ type: 'Agent', target: `${DEV}:OTHER-SERVER` }],
  'volume only': [{ type: 'Volume', target: `${DEV}:${AGENT}:D` }],
  'other appliance': [{ type: 'Device', target: 'SOMEWHERE-ELSE' }],
};

// Scanner write types and whether each is tied to an agent
const SCANNER_WRITES: [string, string | undefined][] = [
  ['Auto-heal note (appliance)', undefined],
  ['Auto-heal note (agent)', AGENT],
  ['Exclusion expiry note', AGENT],
  ['Exclusion expiry status change', AGENT],
  ['Volume auto-heal note', AGENT],
  ['Volume compliance ticket', AGENT],
  ['Re-raised compliance ticket', AGENT],
];

function expectedScannerSilenced(tier: string, agentName: string | undefined): boolean {
  if (tier === 'appliance') return true;
  if (tier === 'agent') return agentName === AGENT; // agent silence doesn't cover appliance-level writes
  return false;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetTableStorageMocks();
  __resetAutotaskPolicyForTests();
  __configureAutotaskGatewayForTests({ retryDelaysMs: [1, 1, 1], resetStats: true });
  maint.mockResolvedValue({ isActive: false });
  mockedAxios.get.mockImplementation(async (url: string) => {
    if (url.includes('zoneInformation')) return { status: 200, data: { url: BASE } };
    return { status: 200, data: { item: { id: 1, ticketNumber: 'T1' } } };
  });
  mockedAxios.post.mockImplementation(async (url: string) => {
    if (url.endsWith('/query')) return { status: 200, data: { items: [] } };
    return { status: 200, data: { itemId: 4242 } };
  });
  mockedAxios.patch.mockResolvedValue({ status: 200, data: {} });
});

describe('Scanner writes: silence tier x blackout matrix', () => {
  for (const blackout of [false, true]) {
    for (const [tier, exclusions] of Object.entries(TIERS)) {
      test.each(SCANNER_WRITES)(`blackout=${blackout}, silence=${tier}: %s`, async (action, agentName) => {
        maint.mockResolvedValue(blackout ? { isActive: true, reason: 'Patch night' } : { isActive: false });
        const decision = await evaluateAutotaskWrite({ origin: 'scanner', action, deviceName: DEV, agentName }, exclusions);
        if (blackout) {
          expect(decision).toMatchObject({ allowed: false, code: 'CHANGE_FREEZE' });
        } else if (expectedScannerSilenced(tier, agentName)) {
          expect(decision).toMatchObject({ allowed: false, code: 'SILENCED' });
        } else {
          expect(decision).toEqual({ allowed: true });
        }
      });
    }
  }
});

describe('User writes: role x blackout x silence', () => {
  const ROLES = ['Contributor', 'Specialist', 'Administrator'] as const;
  const userCtx = (role: typeof ROLES[number], reason?: string): IAutotaskWriteContext => ({
    origin: 'user', action: 'Manual escalation', deviceName: DEV, agentName: AGENT,
    user: { email: `${role}@fifosys.com`, role }, blackoutOverrideReason: reason,
  });

  test.each(ROLES)('no blackout: %s may write, even to a silenced appliance', async role => {
    expect(await evaluateAutotaskWrite(userCtx(role), TIERS.appliance)).toEqual({ allowed: true });
  });

  test.each(['Contributor', 'Specialist'] as const)('blackout: %s is blocked even with a reason', async role => {
    maint.mockResolvedValue({ isActive: true });
    const d = await evaluateAutotaskWrite(userCtx(role, 'urgent'), []);
    expect(d).toMatchObject({ allowed: false, code: 'CHANGE_FREEZE' });
    expect((d as any).reason).toMatch(/Only Administrators/);
  });

  test('blackout: Administrator without a reason is blocked', async () => {
    maint.mockResolvedValue({ isActive: true });
    for (const reason of [undefined, '', '   ']) {
      const d = await evaluateAutotaskWrite(userCtx('Administrator', reason), []);
      expect(d).toMatchObject({ allowed: false, code: 'CHANGE_FREEZE' });
      expect((d as any).reason).toMatch(/reason is required/);
    }
  });

  test('blackout: Administrator with a reason may write', async () => {
    maint.mockResolvedValue({ isActive: true });
    expect(await evaluateAutotaskWrite(userCtx('Administrator', 'P1 outage at client'), [])).toEqual({ allowed: true });
  });
});

describe('guardAutotaskWrite', () => {
  test('suppressed scanner write returns false and is audited once per 6 hours', async () => {
    seedTableStorage('Exclusions', [{ partitionKey: 'Exclusion', rowKey: 'x', type: 'Device', target: DEV }]);
    const ctx: IAutotaskWriteContext = { origin: 'scanner', action: 'Auto-heal note', deviceName: DEV };
    expect(await guardAutotaskWrite(ctx)).toBe(false);
    expect(await guardAutotaskWrite(ctx)).toBe(false);
    const audit = getTableEntities('AuditLogs');
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'Suppressed Autotask Write', target: DEV });
    expect(audit[0].details).toMatch(/Appliance is silenced/);
  });

  test('blocked user write throws AutotaskWriteBlockedError', async () => {
    maint.mockResolvedValue({ isActive: true });
    await expect(guardAutotaskWrite({ origin: 'user', action: 'Mute Volume', user: { email: 'c@f', role: 'Contributor' } }))
      .rejects.toBeInstanceOf(AutotaskWriteBlockedError);
  });

  test('if silences cannot be read, the scanner write is held back (fail safe)', async () => {
    const tableService = require('../shared/tableService');
    const spy = jest.spyOn(tableService, 'getTableClient').mockRejectedValueOnce(new Error('storage down'));
    const d = await evaluateAutotaskWrite({ origin: 'scanner', action: 'Auto-heal note', deviceName: DEV });
    expect(d).toMatchObject({ allowed: false, code: 'SILENCED' });
    spy.mockRestore();
  });
});

describe('Real write functions honour the policy', () => {
  const scannerCtx: IAutotaskWriteContext = { origin: 'scanner', action: 'Auto-heal note', deviceName: DEV, agentName: AGENT };

  test('allowed: note, ticket and status change are sent', async () => {
    expect(await createTicketNoteInAutoTask(1, { title: 't', description: 'd' }, CONFIG, scannerCtx)).toBe(true);
    expect(await createTicketInAutoTask({ title: 't', description: 'd', companyID: 1 }, CONFIG, scannerCtx)).toBe(4242);
    expect(await updateTicketStatusInAutoTask(1, 8, CONFIG, scannerCtx)).toBe(true);
    expect(mockedAxios.post.mock.calls.some(c => String(c[0]).endsWith('/Notes'))).toBe(true);
    expect(mockedAxios.patch).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['silenced appliance', () => seedTableStorage('Exclusions', [{ partitionKey: 'Exclusion', rowKey: 'd', type: 'Device', target: DEV }])],
    ['silenced agent', () => seedTableStorage('Exclusions', [{ partitionKey: 'Exclusion', rowKey: 'a', type: 'Agent', target: `${DEV}:${AGENT}` }])],
    ['blackout', () => maint.mockResolvedValue({ isActive: true })],
  ])('%s: nothing is sent to Autotask', async (_label, arrange) => {
    arrange();
    expect(await createTicketNoteInAutoTask(1, { title: 't', description: 'd' }, CONFIG, scannerCtx)).toBe(false);
    expect(await createTicketInAutoTask({ title: 't', description: 'd', companyID: 1 }, CONFIG, scannerCtx)).toBeNull();
    expect(await updateTicketStatusInAutoTask(1, 8, CONFIG, scannerCtx)).toBe(false);
    expect(await createComplianceTicket({ deviceName: DEV, agentName: AGENT, volumeName: 'D', reason: '' }, CONFIG,
      { origin: 'scanner', action: 'Volume compliance ticket' })).toBeNull();
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  test('blocked user write throws before anything is sent', async () => {
    maint.mockResolvedValue({ isActive: true });
    await expect(createTicketInAutoTask({ title: 't', description: 'd', companyID: 1 }, CONFIG,
      { origin: 'user', action: 'Manual escalation', user: { email: 's@f', role: 'Specialist' } }))
      .rejects.toBeInstanceOf(AutotaskWriteBlockedError);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
