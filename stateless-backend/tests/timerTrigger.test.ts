/**
 * Timer Trigger Tests
 * Drives the real backupWatchTimerTrigger with the scan pipeline and Table Storage mocked.
 * The success log line is what the BW-021 alert query depends on - do not change it without updating the alert.
 */
jest.mock('../backupWatchTrigger/index', () => ({ runPipeline: jest.fn() }));
jest.mock('../shared/tableService', () => require('./mocks/tableStorage').tableServiceMock);

import timerTrigger from '../backupWatchTimerTrigger/index';
import { runPipeline } from '../backupWatchTrigger/index';
import { resetTableStorageMocks, getTableEntities } from './mocks/tableStorage';
import { createMockContext } from './mocks/functions';

const mockRunPipeline = runPipeline as jest.Mock;

describe('BackupWatch Timer Trigger', () => {
  beforeEach(() => {
    resetTableStorageMocks();
    mockRunPipeline.mockReset();
  });

  test('success: logs the exact BW-021 message and records Success status', async () => {
    mockRunPipeline.mockResolvedValue({ devices: [{}, {}, {}] });
    const context = createMockContext();

    await timerTrigger(context, { isPastDue: false });

    expect(mockRunPipeline).toHaveBeenCalledWith(context, true, true);
    expect(context.log.info).toHaveBeenCalledWith(
      'BackupWatch Background Scanner successfully executed and cached 3 appliances.'
    );
    const [status] = getTableEntities('ScanStatus');
    expect(status).toMatchObject({ partitionKey: 'Status', rowKey: 'BCDRScanner', status: 'Success', errorMessage: '' });
  });

  test('failure: logs the error and records Failed status', async () => {
    mockRunPipeline.mockRejectedValue(new Error('Datto timeout'));
    const context = createMockContext();

    await timerTrigger(context, { isPastDue: false });

    expect(context.log.error).toHaveBeenCalledWith('BackupWatch Background Scanner encountered an error: Datto timeout');
    expect(context.log.info).not.toHaveBeenCalledWith(expect.stringContaining('successfully executed'));
    const [status] = getTableEntities('ScanStatus');
    expect(status).toMatchObject({ status: 'Failed', errorMessage: 'Datto timeout' });
  });

  test('past-due run logs a warning and still scans', async () => {
    mockRunPipeline.mockResolvedValue({ devices: [] });
    const context = createMockContext();

    await timerTrigger(context, { isPastDue: true });

    expect(context.log.info).toHaveBeenCalledWith('Timer function is running late!');
    expect(mockRunPipeline).toHaveBeenCalledTimes(1);
  });
});
