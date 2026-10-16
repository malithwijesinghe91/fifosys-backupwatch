/**
 * Datto storage units (BW-024)
 * Datto reports { size, units }; units were "KB" on all 117 live appliances (read-only check,
 * 2026-10-16). The old code treated size as bytes and showed terabytes as gigabytes.
 */
jest.mock('../shared/tableService', () => require('./mocks/tableStorage').tableServiceMock);
jest.mock('../shared/autotask');
jest.mock('../shared/configService', () => ({
  ...jest.requireActual('../shared/configService'),
  getGlobalMaintenanceMode: jest.fn(async () => ({ isActive: false })),
  getAutotaskRoutingConfig: jest.fn(async () => ({})),
}));

import * as at from '../shared/autotask';
import { dattoSizeToGB, formatStorageGB, __resetStorageUnitWarningsForTests } from '../shared/storageUnits';
import escalateTrigger from '../escalateTrigger/index';
import { resetTableStorageMocks } from './mocks/tableStorage';
import { createMockContext, createMockRequest, easyAuthHeadersFor } from './mocks/functions';

// ACU-DAT-01 (S5-3) as returned by Datto on 2026-10-16
const ACU_USED = { units: 'KB', size: 3009445320 };
const ACU_AVAILABLE = { units: 'KB', size: 136282624 };

beforeEach(() => {
  jest.clearAllMocks();
  resetTableStorageMocks();
  __resetStorageUnitWarningsForTests();
});

describe('dattoSizeToGB', () => {
  test('real ACU-DAT-01 values: 2.80 TB used of 2.93 TB, 95.7% – not 2.80 GB', () => {
    const used = dattoSizeToGB(ACU_USED);
    const total = used + dattoSizeToGB(ACU_AVAILABLE);
    expect(formatStorageGB(used)).toBe('2.80 TB');
    expect(formatStorageGB(total)).toBe('2.93 TB');
    expect(((used / total) * 100).toFixed(1)).toBe('95.7');
  });

  test.each([
    ['B', 1024 ** 3, 1],
    ['KB', 1024 ** 2, 1],
    ['KiB', 1024 ** 2, 1],
    ['MB', 1024, 1],
    ['GB', 5, 5],
    ['TB', 2, 2048],
    ['tb', 2, 2048],
  ])('%s: %d -> %d GB', (units, size, expected) => {
    expect(dattoSizeToGB({ units, size })).toBeCloseTo(expected, 6);
  });

  test.each([undefined, null, {}, { units: 'KB' }, { units: 'KB', size: 0 }, { units: 'KB', size: -5 }, { units: 'KB', size: NaN }])(
    'missing or invalid size gives 0: %p', value => {
      expect(dattoSizeToGB(value as any)).toBe(0);
    });

  test('missing or unknown units: assumes KB and warns once per unit', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(dattoSizeToGB({ size: 1024 ** 2 })).toBeCloseTo(1, 6);
    expect(dattoSizeToGB({ size: 1024 ** 2 })).toBeCloseTo(1, 6);
    expect(dattoSizeToGB({ units: 'blocks', size: 1024 ** 2 })).toBeCloseTo(1, 6);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  test('the percentage is the same whatever the unit', () => {
    const asKB = dattoSizeToGB(ACU_USED) / (dattoSizeToGB(ACU_USED) + dattoSizeToGB(ACU_AVAILABLE));
    const asB = dattoSizeToGB({ units: 'B', size: ACU_USED.size * 1024 }) /
      (dattoSizeToGB({ units: 'B', size: ACU_USED.size * 1024 }) + dattoSizeToGB({ units: 'B', size: ACU_AVAILABLE.size * 1024 }));
    expect(asB).toBeCloseTo(asKB, 10);
  });
});

describe('formatStorageGB', () => {
  test.each([
    [0, '0.00 GB'],
    [512.25, '512.25 GB'],
    [1023.99, '1023.99 GB'],
    [1024, '1.00 TB'],
    [3000, '2.93 TB'],
  ])('%d GB -> %s', (gb, text) => {
    expect(formatStorageGB(gb)).toBe(text);
  });
});

describe('Storage escalation ticket text', () => {
  test('uses TB for a multi-terabyte appliance', async () => {
    const mocked = at as jest.Mocked<typeof at>;
    mocked.getAutoTaskConfig.mockReturnValue({ user: 'u', secret: 's', integrationCode: 'i' });
    mocked.queryTicketsInAutoTask.mockResolvedValue([]);
    mocked.lookupCompanyInAutoTask.mockResolvedValue(1);
    mocked.lookupConfigurationItemInAutoTask.mockResolvedValue(null);
    mocked.lookupContractInAutoTask.mockResolvedValue(null);
    mocked.createTicketInAutoTask.mockResolvedValue(99);
    mocked.getAutoTaskBaseUrl.mockResolvedValue('https://webservices16.autotask.net/atservicesrest/v1.0/');
    mocked.getAutoTaskTicketUrl.mockReturnValue('https://example/ticket');
    mocked.getSingleTicketFromAutoTask.mockResolvedValue(null);

    const used = parseFloat(dattoSizeToGB(ACU_USED).toFixed(2));
    const total = parseFloat((dattoSizeToGB(ACU_USED) + dattoSizeToGB(ACU_AVAILABLE)).toFixed(2));
    const context = createMockContext();
    await escalateTrigger(context, createMockRequest({
      method: 'POST',
      headers: easyAuthHeadersFor('Contributor'),
      body: {
        companyName: 'Acumed Ltd', deviceName: 'ACU-DAT-01', serialNumber: 'C0470EEFBC8B', issueType: 'storage',
        description: 'Storage warning', usedStorageGB: used, totalStorageGB: total, storageUsedPercent: 95.7,
      },
    }));

    expect((context.res as any).status).toBe(201);
    const description: string = mocked.createTicketInAutoTask.mock.calls[0][0].description;
    expect(description).toContain('Current Storage Used: 2.80 TB of 2.93 TB (95.7%)');
    expect(description).toContain('Available Space: 129.97 GB');
    expect(description).not.toMatch(/2\.80 GB/);
  });
});
