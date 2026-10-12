// Tests for the release tooling (BW-011, decision D-03 = separate backend / web part versions).
// Run: npm test (repo root). Works on a temporary copy of the version files – never touches the
// real repo or scaffold.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  REPO_ROOT, REPO_FILES, SCAFFOLD_FILES, bump, checkFiles, writeVersion, writeVersionsFile
} from './versionFiles.mjs';

const script = (name) => join(REPO_ROOT, 'scripts', name);
const run = (name, ...args) => spawnSync(process.execPath, [script(name), ...args], { encoding: 'utf8' });
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

// Temp repo containing only the version files, set to the given backend / web versions.
function makeRepo(versions = { backend: '1.4.2', web: '2.0.7' }) {
  const root = mkdtempSync(join(tmpdir(), 'bw-versions-'));
  for (const entry of REPO_FILES) {
    mkdirSync(join(root, dirname(entry.path)), { recursive: true });
    cpSync(join(REPO_ROOT, entry.path), join(root, entry.path));
    writeVersion(root, entry, versions[entry.part]);
  }
  writeVersionsFile(root, versions);
  writeFileSync(join(root, 'CHANGELOG.md'), '# Changelog\r\n\r\n## [Backend 1.0.0] - 2026-01-01\r\n\r\n- old\r\n');
  return root;
}

test('bump follows patch / minor / major rules', () => {
  assert.equal(bump('1.24.0', 'patch'), '1.24.1');
  assert.equal(bump('1.24.3', 'minor'), '1.25.0');
  assert.equal(bump('1.24.3', 'major'), '2.0.0');
  assert.throws(() => bump('1.24.0', 'huge'));
});

test('release web bumps only the web part files and leaves the backend alone', () => {
  const root = makeRepo();
  try {
    const r = run('release.mjs', '--root', root, 'web', 'minor');
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(readJson(join(root, 'versions.json')), { backend: '1.4.2', web: '2.1.0' });
    assert.deepEqual(checkFiles(root, REPO_FILES, { backend: '1.4.2', web: '2.1.0' }), []);
    const solution = readFileSync(join(root, 'scaffold/config/package-solution.json'), 'utf8');
    assert.equal((solution.match(/"2\.1\.0\.0"/g) || []).length, 2, 'solution + feature version');
    assert.match(readFileSync(join(root, 'stateless-backend/shared/version.ts'), 'utf8'), /APP_VERSION = "1\.4\.2"/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('release backend bumps only the backend files and leaves the web part alone', () => {
  const root = makeRepo();
  try {
    const r = run('release.mjs', '--root', root, 'backend', 'patch');
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(readJson(join(root, 'versions.json')), { backend: '1.4.3', web: '2.0.7' });
    assert.deepEqual(checkFiles(root, REPO_FILES, { backend: '1.4.3', web: '2.0.7' }), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('release both bumps each half from its own current version', () => {
  const root = makeRepo();
  try {
    assert.equal(run('release.mjs', '--root', root, 'both', 'patch').status, 0);
    assert.deepEqual(readJson(join(root, 'versions.json')), { backend: '1.4.3', web: '2.0.8' });
    assert.deepEqual(checkFiles(root, REPO_FILES, { backend: '1.4.3', web: '2.0.8' }), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('release only rewrites the top-level version in package-lock.json', () => {
  const root = makeRepo();
  try {
    const lockPath = join(root, 'stateless-backend/package-lock.json');
    const before = readFileSync(lockPath, 'utf8');
    run('release.mjs', '--root', root, 'backend', 'patch');
    const deps = (t) => t.split('\n').slice(12).join('\n'); // dependency entries untouched
    assert.equal(deps(readFileSync(lockPath, 'utf8')), deps(before));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('release adds a CHANGELOG stub labelled with the half that changed, above the newest entry, keeping CRLF', () => {
  const root = makeRepo();
  try {
    run('release.mjs', '--root', root, 'web', 'patch');
    let log = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
    assert.ok(log.indexOf('## [Web part 2.0.8] - ') < log.indexOf('## [Backend 1.0.0]'));
    assert.ok(!/[^\r]\n/.test(log), 'line endings stay CRLF');
    run('release.mjs', '--root', root, 'both', 'patch');
    log = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
    assert.match(log, /## \[Backend 1\.4\.3 \/ Web part 2\.0\.9\] - /);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('release rejects a missing or unknown target or bump type', () => {
  for (const args of [[], ['patch'], ['web'], ['web', 'huge'], ['everything', 'patch']]) {
    assert.equal(run('release.mjs', '--root', REPO_ROOT, ...args).status, 1, args.join(' '));
  }
});

test('verify passes when files agree and fails when any one file is edited by hand', () => {
  const versions = { backend: '1.4.2', web: '2.0.7' };
  const root = makeRepo(versions);
  try {
    assert.equal(run('verify-versions.mjs', '--root', root).status, 0);
    for (const entry of REPO_FILES) {
      const f = join(root, entry.path);
      const original = readFileSync(f, 'utf8');
      writeFileSync(f, original.replace(versions[entry.part], '9.9.9'));
      const r = run('verify-versions.mjs', '--root', root);
      assert.equal(r.status, 1, `${entry.path} edited by hand must fail the check`);
      assert.match(r.stderr, new RegExp(entry.path.replace(/[/.]/g, '\\$&')));
      writeFileSync(f, original);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('verify fails when a web part file carries the backend version (halves are not interchangeable)', () => {
  const root = makeRepo({ backend: '1.4.2', web: '2.0.7' });
  try {
    const f = join(root, 'spfx-client/package.json');
    writeFileSync(f, readFileSync(f, 'utf8').replace('2.0.7', '1.4.2'));
    assert.equal(run('verify-versions.mjs', '--root', root).status, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('verify --scaffold catches a scaffold copy that was not synced', () => {
  const root = makeRepo({ backend: '1.4.2', web: '2.0.7' });
  const scaffold = mkdtempSync(join(tmpdir(), 'bw-scaffold-'));
  try {
    mkdirSync(join(scaffold, 'src/webparts/backupWatch'), { recursive: true });
    mkdirSync(join(scaffold, 'config'), { recursive: true });
    cpSync(join(root, 'spfx-client/package.json'), join(scaffold, 'package.json'));
    cpSync(join(root, 'spfx-client/src/webparts/backupWatch/BackupWatchWebPart.manifest.json'),
      join(scaffold, SCAFFOLD_FILES[1].path));
    cpSync(join(root, 'scaffold/config/package-solution.json'), join(scaffold, 'config/package-solution.json'));
    assert.equal(run('verify-versions.mjs', '--root', root, '--scaffold-dir', scaffold, '--scaffold').status, 0);
    writeFileSync(join(scaffold, 'package.json'), readFileSync(join(scaffold, 'package.json'), 'utf8').replace('2.0.7', '2.0.1'));
    const r = run('verify-versions.mjs', '--root', root, '--scaffold-dir', scaffold, '--scaffold');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /\[scaffold\] package\.json/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(scaffold, { recursive: true, force: true });
  }
});
