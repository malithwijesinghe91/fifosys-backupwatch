/**
 * Scan lock (BW-023): one scan at a time across instances (timer scan vs Force Scan).
 */
jest.mock('../shared/tableService', () => require('./mocks/tableStorage').tableServiceMock);

import { withScanLock, waitForScanToFinish, LOCK_TTL_MS, __setScanLockTimingForTests } from '../shared/scanLock';
import { resetTableStorageMocks, seedTableStorage, getTableEntities } from './mocks/tableStorage';
import { createMockContext } from './mocks/functions';

const lockRow = () => getTableEntities('ScanStatus').find(e => e.partitionKey === 'Lock' && e.rowKey === 'BCDRScanner');
const seedLock = (msFromNow: number, owner = 'Timer scan') => seedTableStorage('ScanStatus', [{
  partitionKey: 'Lock', rowKey: 'BCDRScanner', owner,
  acquiredAt: new Date().toISOString(), lockedUntil: new Date(Date.now() + msFromNow).toISOString(),
}]);

beforeEach(() => {
  resetTableStorageMocks();
  jest.restoreAllMocks();
  __setScanLockTimingForTests(5, 50);
});

test('runs the scan, holds the lock while running, releases it afterwards', async () => {
  const context = createMockContext();
  let heldDuringScan: any;
  const outcome = await withScanLock(context, 'Timer scan', async () => { heldDuringScan = lockRow(); return 42; });

  expect(outcome).toEqual({ ran: true, result: 42 });
  expect(heldDuringScan).toMatchObject({ owner: 'Timer scan' });
  expect(Date.parse(heldDuringScan.lockedUntil) - Date.parse(heldDuringScan.acquiredAt)).toBe(LOCK_TTL_MS);
  expect(lockRow()).toBeUndefined();
});

test('a second scan does not start while the first holds the lock', async () => {
  const context = createMockContext();
  const second = jest.fn(async () => 'second');
  const outcome = await withScanLock(context, 'Timer scan', async () => withScanLock(context, 'Force Scan by x@fifosys.com', second));

  expect(second).not.toHaveBeenCalled();
  expect(outcome).toEqual({ ran: true, result: { ran: false, busy: expect.objectContaining({ owner: 'Timer scan' }) } });
});

test('busy when another instance holds an unexpired lock', async () => {
  seedLock(60000);
  const scan = jest.fn(async () => 1);
  const outcome = await withScanLock(createMockContext(), 'Force Scan by x@fifosys.com', scan);

  expect(scan).not.toHaveBeenCalled();
  expect(outcome).toMatchObject({ ran: false, busy: { owner: 'Timer scan' } });
  expect(lockRow()).toMatchObject({ owner: 'Timer scan' });
});

test('an expired lock is taken over', async () => {
  seedLock(-1000, 'Crashed scan');
  const outcome = await withScanLock(createMockContext(), 'Timer scan', async () => lockRow()!.owner);
  expect(outcome).toEqual({ ran: true, result: 'Timer scan' });
  expect(lockRow()).toBeUndefined();
});

test('the lock is released when the scan fails', async () => {
  await expect(withScanLock(createMockContext(), 'Timer scan', async () => { throw new Error('Datto timeout'); }))
    .rejects.toThrow('Datto timeout');
  expect(lockRow()).toBeUndefined();
});

test('does not delete a lock another scan took over (ETag mismatch)', async () => {
  const context = createMockContext();
  await withScanLock(context, 'Timer scan', async () => {
    // Our lock expired mid-scan and another instance replaced it
    seedLock(60000, 'Force Scan by y@fifosys.com');
  });
  expect(lockRow()).toMatchObject({ owner: 'Force Scan by y@fifosys.com' });
  expect(context.log.warn).not.toHaveBeenCalled();
});

test('lock store unavailable: the scan still runs (alerts matter more – D-07)', async () => {
  jest.spyOn(require('./mocks/tableStorage').tableServiceMock, 'getTableClient').mockRejectedValueOnce(new Error('storage down'));
  const context = createMockContext();
  const outcome = await withScanLock(context, 'Timer scan', async () => 'scanned');
  expect(outcome).toEqual({ ran: true, result: 'scanned' });
  expect(context.log.warn).toHaveBeenCalledWith(expect.stringContaining('Lock store unavailable'));
});

describe('waitForScanToFinish', () => {
  test('returns at once when no scan is running', async () => {
    expect(await waitForScanToFinish(createMockContext())).toBe(true);
  });

  test('returns true when the running scan finishes', async () => {
    seedLock(60000);
    setTimeout(() => resetTableStorageMocks(), 15);
    expect(await waitForScanToFinish(createMockContext())).toBe(true);
  });

  test('gives up after the wait cap', async () => {
    seedLock(60000);
    expect(await waitForScanToFinish(createMockContext())).toBe(false);
  });
});
