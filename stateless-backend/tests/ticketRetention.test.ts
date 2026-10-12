/**
 * Ticket Number Retention Tests
 * Replaces scratch/test_ticket_retention.js. Drives the real exclusions HTTP handler
 * (exclusions/index.ts) with in-memory Table Storage and mocked Autotask calls.
 */
jest.mock('../shared/tableService', () => require('./mocks/tableStorage').tableServiceMock);
jest.mock('../shared/autotask');

import exclusionsHandler from '../exclusions/index';
import * as autotask from '../shared/autotask';
import { resetTableStorageMocks, seedTableStorage, getTableEntities } from './mocks/tableStorage';
import { createMockContext, createMockRequest } from './mocks/functions';

const at = autotask as jest.Mocked<typeof autotask>;
const realAutotask = jest.requireActual('../shared/autotask') as typeof autotask;

const BASE_URL = 'https://webservices16.autotask.net/atservicesrest/v1.0/';
const TICKET = { id: 99999, ticketNumber: 'T20260817.0001', title: 'Volume exclusion', status: 1 } as any;

async function post(body: any) {
  const context = createMockContext();
  await exclusionsHandler(context, createMockRequest({ method: 'POST', body, role: 'Contributor' }));
  return context.res as { status: number; body: any };
}

describe('Exclusions Ticket Number Retention', () => {
  beforeEach(() => {
    resetTableStorageMocks();
    jest.resetAllMocks();
    at.getAutoTaskConfig.mockReturnValue({ user: 'api@test', secret: 'x', integrationCode: 'x' });
    at.getAutoTaskBaseUrl.mockResolvedValue(BASE_URL);
    at.getAutoTaskTicketUrl.mockImplementation(realAutotask.getAutoTaskTicketUrl);
    at.queryTicketByNumber.mockResolvedValue(TICKET);
    at.createTicketNoteInAutoTask.mockResolvedValue(true);
  });

  test('Step 1: Volume exclusion with a ticket number resolves the ticket and pushes a note', async () => {
    const res = await post({ type: 'Volume', target: 'FIF-DATTO-01:FIF-DC-02:F:\\', reason: '', ticketNumber: 'T20260817.0001' });

    expect(res.status).toBe(201);
    expect(at.queryTicketByNumber).toHaveBeenCalledWith('T20260817.0001', expect.anything());
    expect(at.createTicketNoteInAutoTask).toHaveBeenCalledTimes(1);
    expect(at.createTicketNoteInAutoTask.mock.calls[0][0]).toBe(99999);
    expect(at.createComplianceTicket).not.toHaveBeenCalled();

    const [row] = getTableEntities('Exclusions');
    expect(row.ticketNumber).toBe('T20260817.0001');
    expect(row.ticketUrl).toBe('https://ww16.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc/Index?ticketId=99999');
  });

  test('Step 2: Editing the note without a ticket number (and a different drive-letter spelling) keeps the ticket', async () => {
    await post({ type: 'Volume', target: 'FIF-DATTO-01:FIF-DC-02:F:\\', reason: '', ticketNumber: 'T20260817.0001' });
    jest.clearAllMocks();

    const res = await post({ type: 'Volume', target: 'FIF-DATTO-01:FIF-DC-02:f', reason: 'Decommissioned log partition' });

    expect(res.status).toBe(201);
    expect(res.body.exclusion.ticketNumber).toBe('T20260817.0001');
    // Stored ticketUrl carries the internal ID, so no Autotask lookup is needed before the note push.
    expect(at.queryTicketByNumber).not.toHaveBeenCalled();
    expect(at.createTicketNoteInAutoTask).toHaveBeenCalledTimes(1);
    expect(at.createTicketNoteInAutoTask.mock.calls[0][0]).toBe(99999);
    expect(at.createComplianceTicket).not.toHaveBeenCalled();

    const rows = getTableEntities('Exclusions');
    expect(rows).toHaveLength(1);
    expect(rows[0].reason).toBe('Decommissioned log partition');
    expect(rows[0].ticketNumber).toBe('T20260817.0001');
  });

  test('Step 3: Legacy un-normalised twin row (F:\\) is removed and its ticket inherited', async () => {
    seedTableStorage('Exclusions', [{
      partitionKey: 'Exclusion',
      rowKey: encodeURIComponent('Volume:FIF-DATTO-01:FIF-DC-02:F:\\'),
      type: 'Volume',
      target: 'FIF-DATTO-01:FIF-DC-02:F:\\',
      ticketNumber: 'T20260817.0001',
      ticketUrl: 'https://ww16.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc/Index?ticketId=99999',
      createdTime: '2026-08-17T09:00:00.000Z',
    }]);

    const res = await post({ type: 'Volume', target: 'FIF-DATTO-01:FIF-DC-02:F', reason: 'Re-saved' });

    expect(res.status).toBe(201);
    const rows = getTableEntities('Exclusions');
    expect(rows).toHaveLength(1);
    expect(rows[0].rowKey).toBe(encodeURIComponent('Volume:FIF-DATTO-01:FIF-DC-02:F'));
    expect(rows[0].ticketNumber).toBe('T20260817.0001');
    expect(rows[0].createdTime).toBe('2026-08-17T09:00:00.000Z');
  });

  test('Step 4: A genuinely new volume with no ticket number is rejected, not auto-ticketed', async () => {
    await post({ type: 'Volume', target: 'FIF-DATTO-01:FIF-DC-02:F:\\', reason: '', ticketNumber: 'T20260817.0001' });
    jest.clearAllMocks();

    const res = await post({ type: 'Volume', target: 'FIF-DATTO-01:FIF-DC-02:E:\\', reason: 'Pagefile drive' });

    expect(res.status).toBe(400);
    expect(at.createComplianceTicket).not.toHaveBeenCalled();
    expect(getTableEntities('Exclusions')).toHaveLength(1);
  });
});
