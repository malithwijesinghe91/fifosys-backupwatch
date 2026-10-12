/**
 * Guard rails (BW-004 layer 2): nothing may call Autotask except shared/autotaskGateway.ts.
 * Scans the production TypeScript sources; fails if someone adds a direct HTTP call or builds
 * Autotask credential headers anywhere else.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const ROOT = join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'tests', 'scratch', 'tools', 'coverage', '.git']);
const GATEWAY = 'shared/autotaskGateway.ts';
// The Datto pipeline is the only other code allowed to use axios (BW-005 will give it its own gateway).
const AXIOS_ALLOWED = new Set([GATEWAY, 'backupWatchTrigger/index.ts']);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) out.push(...sourceFiles(full));
    } else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const files = sourceFiles(ROOT).map(f => ({
  path: relative(ROOT, f).split(sep).join('/'),
  text: readFileSync(f, 'utf8'),
}));

test('the scan finds the production sources', () => {
  const paths = files.map(f => f.path);
  expect(paths).toEqual(expect.arrayContaining([GATEWAY, 'shared/autotask.ts', 'exclusions/index.ts', 'escalateTrigger/index.ts', 'backupWatchTrigger/index.ts']));
});

test('only the gateway and the Datto pipeline import axios', () => {
  const importers = files.filter(f => /from\s+["']axios["']|require\(\s*["']axios["']\s*\)/.test(f.text)).map(f => f.path);
  expect(importers.filter(p => !AXIOS_ALLOWED.has(p))).toEqual([]);
});

test('every axios call outside the gateway targets the Datto API', () => {
  const offenders: string[] = [];
  for (const f of files) {
    if (f.path === GATEWAY) continue;
    f.text.split(/\r?\n/).forEach((line, i) => {
      if (/\baxios\s*\.\s*(get|post|put|patch|delete|request)\s*\(/.test(line) && !line.includes('api.datto.com')) {
        offenders.push(`${f.path}:${i + 1}: ${line.trim()}`);
      }
    });
  }
  expect(offenders).toEqual([]);
});

test('no other HTTP clients are used in production code', () => {
  const offenders = files
    .filter(f => f.path !== GATEWAY)
    .filter(f => /\bfetch\s*\(|https?\.request\s*\(|from\s+["'](node-fetch|got|undici|superagent)["']/.test(f.text))
    .map(f => f.path);
  expect(offenders).toEqual([]);
});

test('Autotask credential headers are only built in the gateway', () => {
  const offenders = files.filter(f => f.path !== GATEWAY && /ApiIntegrationCode/.test(f.text)).map(f => f.path);
  expect(offenders).toEqual([]);
});
