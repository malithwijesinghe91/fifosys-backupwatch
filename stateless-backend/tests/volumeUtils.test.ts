/**
 * Volume Utils Tests
 * Converted from scratch/test_volume_mute_logic.js and scratch/test_volume_dedup_prevention.js
 */
import {
  normalizeVolumeName,
  buildVolumeTargetKey,
  isVolumeExcluded,
  isDeviceSilenced,
  isAgentSilenced,
  isDeviceMuted
} from '../shared/volumeUtils';

import type { IExclusionEntityLike } from '../shared/volumeUtils';

interface TestExclusion extends IExclusionEntityLike {
  type: 'Device' | 'Agent' | 'Volume';
  target: string;
  reason?: string;
  ticketNumber?: string;
}

describe('normalizeVolumeName', () => {
  describe('Windows drive letter variations', () => {
    const variations = ['D', 'd', 'D:', 'd:', 'D:\\', 'd:\\', 'D:/', 'd:/', 'D:\\\\', 'D://'];
    test.each(variations)('normalizes "%s" to "D"', (input) => {
      expect(normalizeVolumeName(input)).toBe('D');
    });
  });

  describe('Windows paths with folders', () => {
    test('normalizes "C:\\Data\\" to "C:/Data"', () => {
      expect(normalizeVolumeName('C:\\Data\\')).toBe('C:/DATA');
    });
    test('normalizes "F:/Data" to "F:/Data"', () => {
      expect(normalizeVolumeName('F:/Data')).toBe('F:/DATA');
    });
  });

  describe('Linux paths', () => {
    test('normalizes "/var/log/" to "/var/log"', () => {
      expect(normalizeVolumeName('/var/log/')).toBe('/VAR/LOG');
    });
    // Known bug BW-009: Linux root volume "/" normalizes to empty string
    test.failing('normalizes "/" to "/" (root volume)', () => {
      expect(normalizeVolumeName('/')).toBe('/');
    });
    test.failing('normalizes "//" to "/"', () => {
      expect(normalizeVolumeName('//')).toBe('/');
    });
  });

  describe('Edge cases', () => {
    test('empty string returns empty string', () => {
      expect(normalizeVolumeName('')).toBe('');
    });
    test('whitespace only returns empty string', () => {
      expect(normalizeVolumeName('   ')).toBe('');
    });
  });
});

describe('buildVolumeTargetKey', () => {
  test('builds canonical lowercased key', () => {
    expect(buildVolumeTargetKey('FIF-DATTO-01', 'FIF-DC-02', 'F:\\')).toBe('fif-datto-01:fif-dc-02:f');
  });

  test('normalizes volume name in key', () => {
    expect(buildVolumeTargetKey('FIF-DATTO-01', 'FIF-DC-02', 'F')).toBe('fif-datto-01:fif-dc-02:f');
  });

  // Known bug BW-009: Linux root volume handling
  test.failing('handles Linux root volume', () => {
    expect(buildVolumeTargetKey('LINUX-SERVER', 'agent1', '/')).toBe('linux-server:agent1:/');
  });
});

describe('isDeviceSilenced / isDeviceMuted', () => {
  const exclusions: TestExclusion[] = [
    { type: 'Device', target: 'ICE-DATTO2', reason: 'Entire appliance muted' },
    { type: 'Device', target: 'FIF-DATTO-BLACKOUT', reason: 'Appliance decommissioning' },
  ];

  test('returns true for silenced device', () => {
    expect(isDeviceSilenced(exclusions, 'ICE-DATTO2')).toBe(true);
    expect(isDeviceSilenced(exclusions, 'FIF-DATTO-BLACKOUT')).toBe(true);
  });

  test('returns false for non-silenced device', () => {
    expect(isDeviceSilenced(exclusions, 'FIF-DATTO-ACTIVE')).toBe(false);
  });

  test('isDeviceMuted returns the exclusion entity', () => {
    const mute = isDeviceMuted(exclusions, 'ICE-DATTO2');
    expect(mute).toBeDefined();
    expect(mute?.reason).toBe('Entire appliance muted');
  });

  test('isDeviceMuted returns undefined for non-muted device', () => {
    expect(isDeviceMuted(exclusions, 'FIF-DATTO-ACTIVE')).toBeUndefined();
  });
});

describe('isAgentSilenced', () => {
  const exclusions: TestExclusion[] = [
    { type: 'Device', target: 'FIF-DATTO-BLACKOUT', reason: 'Appliance decommissioning' },
    { type: 'Agent', target: 'FIF-DATTO-ACTIVE:SQL-DECOMMISSIONED', reason: 'SQL Server migrated to Azure' },
  ];

  test('returns true when parent device is silenced (cascade)', () => {
    expect(isAgentSilenced(exclusions, 'FIF-DATTO-BLACKOUT', 'DC-01')).toBe(true);
  });

  test('returns true for targeted agent silence (Tier 2)', () => {
    expect(isAgentSilenced(exclusions, 'FIF-DATTO-ACTIVE', 'SQL-DECOMMISSIONED')).toBe(true);
  });

  test('returns false for sibling agent on same active appliance (Tier 2 isolation)', () => {
    expect(isAgentSilenced(exclusions, 'FIF-DATTO-ACTIVE', 'DC-01')).toBe(false);
  });

  test('returns false for agent on active appliance with no agent silence', () => {
    expect(isAgentSilenced(exclusions, 'FIF-DATTO-ACTIVE', 'OTHER-AGENT')).toBe(false);
  });
});

describe('isVolumeExcluded', () => {
  const exclusions: TestExclusion[] = [
    { type: 'Volume', target: 'PEN-DATTO-01:WS-CZC1119JX4:D', ticketNumber: 'T20260814.0187' },
    { type: 'Volume', target: 'FIF-DATTO-ACTIVE:DC-01:E', reason: 'Log drive excluded' },
  ];

  test('matches volume with various query formats', () => {
    expect(isVolumeExcluded(exclusions, 'PEN-DATTO-01', 'WS-CZC1119JX4', 'D')?.ticketNumber).toBe('T20260814.0187');
    expect(isVolumeExcluded(exclusions, 'PEN-DATTO-01', 'WS-CZC1119JX4', 'D:\\')?.ticketNumber).toBe('T20260814.0187');
    expect(isVolumeExcluded(exclusions, 'PEN-DATTO-01', 'WS-CZC1119JX4', 'd:')?.ticketNumber).toBe('T20260814.0187');
    expect(isVolumeExcluded(exclusions, 'PEN-DATTO-01', 'WS-CZC1119JX4', 'd:/')?.ticketNumber).toBe('T20260814.0187');
  });

  test('returns undefined for non-excluded volume', () => {
    expect(isVolumeExcluded(exclusions, 'PEN-DATTO-01', 'WS-CZC1119JX4', 'E')).toBeUndefined();
  });

  test('matches volume with folder path', () => {
    expect(isVolumeExcluded(exclusions, 'FIF-DATTO-ACTIVE', 'DC-01', 'E:\\')?.reason).toBe('Log drive excluded');
  });

  test('does NOT match device-level mute as volume exclusion', () => {
    const deviceMutedExclusions: TestExclusion[] = [
      { type: 'Device', target: 'ICE-DATTO2', reason: 'Entire appliance muted' },
    ];
    const result = isVolumeExcluded(deviceMutedExclusions, 'ICE-DATTO2', 'MEMSYS3', 'C:\\');
    expect(result).toBeUndefined();
  });

  test('does NOT match agent-level silence as volume exclusion', () => {
    const agentSilencedExclusions: TestExclusion[] = [
      { type: 'Agent', target: 'FIF-DATTO-ACTIVE:SQL-DECOMMISSIONED', reason: 'SQL Server migrated' },
    ];
    const result = isVolumeExcluded(agentSilencedExclusions, 'FIF-DATTO-ACTIVE', 'SQL-DECOMMISSIONED', 'C:\\');
    expect(result).toBeUndefined();
  });
});

describe('Array Deduplication', () => {
  test('deduplicates volume array correctly', () => {
    const testArray = ['D', 'D:\\', 'E:', 'e:\\', 'E', 'D:/', 'F:\\Data\\', 'F:/Data'];
    const deduplicated = Array.from(new Set(testArray.map(v => normalizeVolumeName(v)).filter(Boolean)));
    expect(deduplicated).toEqual(['D', 'E', 'F:/DATA']);
  });

  test('simulated auto-ticket loop creates only 1 ticket for all variations', () => {
    const incomingAssetVolumes = ['D', 'D:\\', 'd:', 'D:/'];
    const uniqueVols = Array.from(new Set(incomingAssetVolumes.map(v => normalizeVolumeName(v)).filter(Boolean)));

    const dynamicExclusions: TestExclusion[] = [];
    let createdTickets = 0;

    for (const normalizedVol of uniqueVols) {
      const excl = isVolumeExcluded(dynamicExclusions, 'PEN-DATTO-01', 'WS-CZC1119JX4', normalizedVol);
      if (!excl) {
        createdTickets++;
        dynamicExclusions.push({
          type: 'Volume',
          target: `PEN-DATTO-01:WS-CZC1119JX4:${normalizedVol}`,
          ticketNumber: `T20260902.${1000 + createdTickets}`,
        });
      }
    }

    expect(createdTickets).toBe(1);
    expect(dynamicExclusions.length).toBe(1);
    expect(dynamicExclusions[0].target).toBe('PEN-DATTO-01:WS-CZC1119JX4:D');
  });
});