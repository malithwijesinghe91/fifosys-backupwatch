// Tests for the shared-version tooling (BW-011). Run: npm test (repo root).
// Works on a temporary copy of the version files – never touches the real repo or scaffold.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT, REPO_FILES, SCAFFOLD_FILES, bump, checkFiles, writeVersion } from './versionFiles.mjs';

const script = (name) => join(REPO_ROOT, 'scripts', name);
const run = (name, ...args) => spawnSync(process.execPath, [script(name), ...args], { encoding: 'utf8' });

// Temp repo containing only the version files, all set to `version`.
function makeRepo(version = '1.4.2') {
  const root = mkdtempSync(join(tmpdir(), 'bw-versions-'));
  for (const entry of REPO_FILES) {
    mkdirSync(join(root, dirname(entry.path)), { recursive: true });
    cpSync(join(REPO_ROOT, entry.path), join(root, entry.path));
  }
  for (const entry of REPO_FILES) writeVersion(root, entry, version);
  writeFileSync(join(root, 'package.json'), `{\n  "name": "t",\n  "version": "${version}"\n}\n`);
  writeFileSync(join(root, 'CHANGELOG.md'), '# Changelog\r\n\r\n## [1.0.0] - 2026-01-01\r\n\r\n- old\r\n');
  return root;
}

test('bump follows patch / minor / major rules', () => {
  assert.equal(bump('1.24.0', 'patch'), '1.24.1');
  assert.equal(bump('1.24.3', 'minor'), '1.25.0');
  assert.equal(bump('1.24.3', 'major'), '2.0.0');
  assert.throws(() => bump('1.24.0', 'huge'));
});

test('release sets the same version in every file, including package-solution features', () => {
  const root = makeRepo('1.4.2');
  try {
    assert.deepEqual(checkFiles(root, REPO_FILES, '1.4.2'), []);
    const r = run('release.mjs', '--root', root, 'minor');
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(checkFiles(root, REPO_FILES, '1.5.0'), []);
    const solution = readFileSync(join(root, 'scaffold/config/package-solution.json'), 'utf8');
    assert.equal((solution.match(/"1\.5\.0\.0"/g) || []).length, 2, 'solution + feature version');
    assert.match(readFileSync(join(root, 'stateless-backend/shared/version.ts'), 'utf8'), /APP_VERSION = "1\.5\.0"/);
    assert.equal(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version, '1.5.0');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('release only rewrites the top-level version in package-lock.json', () => {
  const root = makeRepo('1.4.2');
  try {
    const lockPath = join(root, 'stateless-backend/package-lock.json');
    const before = readFileSync(lockPath, 'utf8');
    run('release.mjs', '--root', root, 'patch');
    const after = readFileSync(lockPath, 'utf8');
    const deps = (t) => t.split('\n').slice(12).join('\n'); // dependency entries untouched
    assert.equal(deps(after), deps(before));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('release adds a dated CHANGELOG stub above the newest entry and keeps CRLF', () => {
  const root = makeRepo('1.4.2');
  try {
    run('release.mjs', '--root', root, 'patch');
    const log = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
    assert.ok(log.indexOf('## [1.4.3] - ') < log.indexOf('## [1.0.0]'));
    assert.ok(!/[^\r]\n/.test(log), 'line endings stay CRLF');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('release rejects a missing or unknown bump type', () => {
  assert.equal(run('release.mjs', '--root', REPO_ROOT).status, 1);
  assert.equal(run('release.mjs', '--root', REPO_ROOT, 'huge').status, 1);
});

test('verify passes when files agree and fails when one file is edited by hand', () => {
  const root = makeRepo('1.4.2');
  try {
    assert.equal(run('verify-versions.mjs', '--root', root).status, 0);
    for (const entry of REPO_FILES) {
      const f = join(root, entry.path);
      const original = readFileSync(f, 'utf8');
      writeFileSync(f, original.replace(/1\.4\.2/, '1.4.9'));
      const r = run('verify-versions.mjs', '--root', root);
      assert.equal(r.status, 1, `${entry.path} edited by hand must fail the check`);
      assert.match(r.stderr, new RegExp(entry.path.replace(/[/.]/g, '\\$&')));
      writeFileSync(f, original);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('verify --scaffold catches a scaffold copy that was not synced', () => {
  const root = makeRepo('1.4.2');
  const scaffold = mkdtempSync(join(tmpdir(), 'bw-scaffold-'));
  try {
    mkdirSync(join(scaffold, 'src/webparts/backupWatch'), { recursive: true });
    mkdirSync(join(scaffold, 'config'), { recursive: true });
    cpSync(join(root, 'spfx-client/package.json'), join(scaffold, 'package.json'));
    cpSync(join(root, 'spfx-client/src/webparts/backupWatch/BackupWatchWebPart.manifest.json'),
      join(scaffold, SCAFFOLD_FILES[1].path));
    cpSync(join(root, 'scaffold/config/package-solution.json'), join(scaffold, 'config/package-solution.json'));
    assert.equal(run('verify-versions.mjs', '--root', root, '--scaffold-dir', scaffold, '--scaffold').status, 0);
    writeFileSync(join(scaffold, 'package.json'), readFileSync(join(scaffold, 'package.json'), 'utf8').replace('1.4.2', '1.3.0'));
    const r = run('verify-versions.mjs', '--root', root, '--scaffold-dir', scaffold, '--scaffold');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /\[scaffold\] package\.json/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(scaffold, { recursive: true, force: true });
  }
});
