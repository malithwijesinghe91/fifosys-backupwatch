/**
 * Mandatory Ticket Number Tests
 * Replaces scratch/test_mandatory_ticket.js. Drives the real exclusions HTTP handler
 * (exclusions/index.ts) with in-memory Table Storage and a fully mocked Autotask module.
 */
jest.mock('../shared/tableService', () => require('./mocks/tableStorage').tableServiceMock);
jest.mock('../shared/autotask');

import exclusionsHandler from '../exclusions/index';
import { resetTableStorageMocks, getTableEntities } from './mocks/tableStorage';
import { createMockContext, createMockRequest, MockRole } from './mocks/functions';

const MANDATORY_ERROR = "Autotask Ticket Number ('ticketNumber') is mandatory for all silence and exclusion requests.";

async function post(body: any, role: MockRole = 'Contributor') {
  const context = createMockContext();
  await exclusionsHandler(context, createMockRequest({ method: 'POST', body, role }));
  return context.res as { status: number; body: any };
}

describe('Mandatory Ticket Number Validation (exclusions POST)', () => {
  beforeEach(() => {
    resetTableStorageMocks();
  });

  test('Device silence with empty ticketNumber returns 400 and writes nothing', async () => {
    const res = await post({ type: 'Device', target: 'TestDevice', reason: 'Maintenance', ticketNumber: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(MANDATORY_ERROR);
    expect(getTableEntities('Exclusions')).toHaveLength(0);
  });

  test('Agent silence with whitespace-only ticketNumber returns 400', async () => {
    const res = await post({ type: 'Agent', target: 'TestDevice:VM1', reason: 'Maintenance', ticketNumber: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(MANDATORY_ERROR);
    expect(getTableEntities('Exclusions')).toHaveLength(0);
  });

  test('Volume exclusion with no ticketNumber at all returns 400 (no auto-created ticket)', async () => {
    const res = await post({ type: 'Volume', target: 'TestDevice:VM1:C:\\', reason: 'Temp' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(MANDATORY_ERROR);
  });

  test('Volume exclusion with valid ticketNumber returns 201 and stores a normalised row', async () => {
    const res = await post({
      type: 'Volume',
      target: 'TestDevice:VM1:c:\\',
      reason: 'Temporary drive exclusion',
      ticketNumber: '  T20260820.0001  ',
    });

    expect(res.status).toBe(201);
    expect(res.body.exclusion.ticketNumber).toBe('T20260820.0001');

    const rows = getTableEntities('Exclusions');
    expect(rows).toHaveLength(1);
    expect(rows[0].rowKey).toBe(encodeURIComponent('Volume:TestDevice:VM1:C'));
    expect(rows[0].target).toBe('TestDevice:VM1:C');
    expect(rows[0].ticketNumber).toBe('T20260820.0001');
  });

  test('Viewer cannot create an exclusion even with a ticket (403)', async () => {
    const res = await post({ type: 'Device', target: 'TestDevice', reason: 'x', ticketNumber: 'T20260820.0001' }, 'Viewer');

    expect(res.status).toBe(403);
    expect(getTableEntities('Exclusions')).toHaveLength(0);
  });

  test('Emergency override of the ticket requirement is Administrator-only', async () => {
    const asContributor = await post({ type: 'Device', target: 'TestDevice', reason: 'Outage', isEmergencyOverride: true });
    expect(asContributor.status).toBe(403);

    const asAdmin = await post({ type: 'Device', target: 'TestDevice', reason: 'Outage', isEmergencyOverride: true }, 'Administrator');
    expect(asAdmin.status).toBe(201);
    expect(asAdmin.body.exclusion.ticketNumber).toBe('[OVERRIDE: EMERGENCY OUTAGE]');
  });
});
