/**
 * Global Test Setup (runs before every test file)
 * Blocks ALL real network access so a test can never reach live Datto, Autotask or Table Storage.
 *
 * The guard sits at the Node socket layer (http/https/net/tls/fetch), so it catches calls made by
 * production code through axios, @azure/data-tables or anything else - not just a global stub.
 * Tests that need an HTTP dependency must mock it with jest.mock (see tests/mocks/).
 */
import http from 'http';
import https from 'https';
import net from 'net';
import tls from 'tls';

function blocked(what: string) {
  return (...args: any[]): never => {
    const target = typeof args[0] === 'string' || args[0] instanceof URL
      ? String(args[0])
      : JSON.stringify(args[0] && { host: args[0].host || args[0].hostname, port: args[0].port, path: args[0].path });
    throw new Error(
      `[TEST GUARD] Unmocked network call blocked (${what}): ${target}\n` +
      `All external calls (Autotask, Datto, Azure) MUST be mocked in tests.`
    );
  };
}

// Patch the property on the shared core module objects, so callers that hold a
// reference to the module (axios, follow-redirects, @azure/core-rest-pipeline) are blocked too.
(http as any).request = blocked('http.request');
(http as any).get = blocked('http.get');
(https as any).request = blocked('https.request');
(https as any).get = blocked('https.get');
(net as any).connect = blocked('net.connect');
(net as any).createConnection = blocked('net.createConnection');
(tls as any).connect = blocked('tls.connect');
(globalThis as any).fetch = async (input: any) => blocked('fetch')(input);

// Never let a developer's live credentials leak into a test run.
for (const key of [
  'AUTOTASK_USER', 'AUTOTASK_SECRET', 'AUTOTASK_INTEGRATION_CODE',
  'AT_USER', 'AT_SECRET', 'DATTO_KEY', 'AzureWebJobsStorage',
]) {
  delete process.env[key];
}
process.env.AzureWebJobsStorage = 'UseDevelopmentStorage=true';
