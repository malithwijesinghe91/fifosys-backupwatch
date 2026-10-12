/**
 * Network Guard Tests
 * Proves tests/setup.ts blocks real network access through the same libraries production code uses.
 * Every URL here is under the reserved .invalid TLD, so nothing could leave the machine even if the guard broke.
 */
import axios from 'axios';
import { TableClient, AzureNamedKeyCredential } from '@azure/data-tables';

describe('Test network guard', () => {
  test('axios GET is blocked', async () => {
    await expect(axios.get('https://webservices.autotask.invalid/zoneInformation')).rejects.toThrow('[TEST GUARD]');
  });

  test('axios POST is blocked', async () => {
    await expect(axios.post('https://api.datto.invalid/v1/bcdr/device', {})).rejects.toThrow('[TEST GUARD]');
  });

  test('fetch is blocked', async () => {
    await expect(fetch('https://example.invalid/')).rejects.toThrow('[TEST GUARD]');
  });

  test('Azure Table Storage client is blocked', async () => {
    const client = new TableClient(
      'https://fakeaccount.table.core.invalid',
      'Exclusions',
      new AzureNamedKeyCredential('fakeaccount', Buffer.from('not-a-real-key').toString('base64'))
    );
    await expect(client.createTable()).rejects.toThrow('[TEST GUARD]');
  });

  test('live credentials are stripped from the environment', () => {
    expect(process.env.AUTOTASK_SECRET).toBeUndefined();
    expect(process.env.DATTO_KEY).toBeUndefined();
    expect(process.env.AzureWebJobsStorage).toBe('UseDevelopmentStorage=true');
  });
});
