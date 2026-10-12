/**
 * 3-Tier Silence Architecture Tests
 * Converted from scratch/test_3tier_silence.js
 */
import {
  normalizeVolumeName,
  buildVolumeTargetKey,
  isVolumeExcluded,
  isDeviceSilenced,
  isAgentSilenced
} from '../shared/volumeUtils';
import type { IExclusionEntityLike } from '../shared/volumeUtils';

interface TestExclusion extends IExclusionEntityLike {
  type: 'Device' | 'Agent' | 'Volume';
  target: string;
  reason?: string;
  ticketNumber?: string;
}

describe('3-Tier Silence & Exclusion Architecture', () => {
  const testExclusions: TestExclusion[] = [
    {
      type: 'Device',
      target: 'FIF-DATTO-BLACKOUT',
      reason: 'Appliance decommissioning',
    },
    {
      type: 'Agent',
      target: 'FIF-DATTO-ACTIVE:SQL-DECOMMISSIONED',
      reason: 'SQL Server migrated to Azure',
    },
    {
      type: 'Volume',
      target: 'FIF-DATTO-ACTIVE:DC-01:E',
      reason: 'Log drive excluded',
    },
  ];

  describe('Tier 1: Appliance Level (Device Silence)', () => {
    test('Appliance FIF-DATTO-BLACKOUT is recognized as silenced', () => {
      expect(isDeviceSilenced(testExclusions, 'FIF-DATTO-BLACKOUT')).toBe(true);
    });

    test('Appliance FIF-DATTO-ACTIVE is NOT silenced', () => {
      expect(isDeviceSilenced(testExclusions, 'FIF-DATTO-ACTIVE')).toBe(false);
    });
  });

  describe('Tier 2: Agent Level (Agent Silence)', () => {
    test('Agent on silenced appliance cascades to silenced', () => {
      expect(isAgentSilenced(testExclusions, 'FIF-DATTO-BLACKOUT', 'DC-01')).toBe(true);
    });

    test('Targeted agent SQL-DECOMMISSIONED is silenced', () => {
      expect(isAgentSilenced(testExclusions, 'FIF-DATTO-ACTIVE', 'SQL-DECOMMISSIONED')).toBe(true);
    });

    test('Sibling agent DC-01 on same active appliance remains ACTIVE', () => {
      expect(isAgentSilenced(testExclusions, 'FIF-DATTO-ACTIVE', 'DC-01')).toBe(false);
    });
  });

  describe('Tier 3: Volume Level (Volume Exclusion)', () => {
    test('Volume E:\\ on DC-01 is correctly recognized as excluded', () => {
      const result = isVolumeExcluded(testExclusions, 'FIF-DATTO-ACTIVE', 'DC-01', 'E:\\');
      expect(result).toBeDefined();
      expect(result?.reason).toBe('Log drive excluded');
    });

    test('Volume C:\\ on DC-01 is NOT excluded', () => {
      const result = isVolumeExcluded(testExclusions, 'FIF-DATTO-ACTIVE', 'DC-01', 'C:\\');
      expect(result).toBeUndefined();
    });

    test('Volume exclusion is scoped only to single drive letter', () => {
      const result = isVolumeExcluded(testExclusions, 'FIF-DATTO-ACTIVE', 'DC-01', 'D:\\');
      expect(result).toBeUndefined();
    });
  });

  describe('Cross-tier separation', () => {
    test('Device mute does not appear as volume exclusion', () => {
      const deviceMutedExclusions: TestExclusion[] = [
        { type: 'Device', target: 'ICE-DATTO2', reason: 'Entire appliance muted' },
      ];
      const result = isVolumeExcluded(deviceMutedExclusions, 'ICE-DATTO2', 'MEMSYS3', 'C:\\');
      expect(result).toBeUndefined();
    });

    test('Agent silence does not appear as volume exclusion', () => {
      const agentSilencedExclusions: TestExclusion[] = [
        { type: 'Agent', target: 'FIF-DATTO-ACTIVE:SQL-DECOMMISSIONED', reason: 'SQL Server migrated' },
      ];
      const result = isVolumeExcluded(agentSilencedExclusions, 'FIF-DATTO-ACTIVE', 'SQL-DECOMMISSIONED', 'C:\\');
      expect(result).toBeUndefined();
    });
  });
});