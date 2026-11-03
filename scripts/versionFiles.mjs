// Every file that carries a BackupWatch version (BW-011, decision D-03 = separate versions).
// The backend and the web part each have their own version, held in the repo-root versions.json:
//   { "backend": "x.y.z", "web": "x.y.z" }
// Used by release.mjs (writes), verify-versions.mjs (checks) and build-web.mjs (checks before building).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PARTS = ['backend', 'web'];
export const PART_LABEL = { backend: 'Backend', web: 'Web part' };

const SEMVER = /^\d+\.\d+\.\d+$/;

// Each entry: the half it belongs to, a file, and a regex whose group 2 is the version text.
// `count` is how many matches the file must contain; `form` maps x.y.z to the file's format.
const plain = (v) => v;
const fourPart = (v) => `${v}.0`;

const JSON_VERSION = /("version"\s*:\s*")([^"]+)(")/g;
const SOLUTION_VERSION = /("version"\s*:\s*")(\d+\.\d+\.\d+\.\d+)(")/g;

export const REPO_FILES = [
  { part: 'backend', path: 'stateless-backend/shared/version.ts', regex: /(APP_VERSION\s*=\s*")([^"]+)(")/g, count: 1, form: plain },
  { part: 'backend', path: 'stateless-backend/package.json', regex: JSON_VERSION, count: 1, form: plain, firstOnly: true },
  { part: 'backend', path: 'stateless-backend/package-lock.json', regex: JSON_VERSION, count: 2, form: plain, firstOnly: true },
  { part: 'web', path: 'spfx-client/package.json', regex: JSON_VERSION, count: 1, form: plain, firstOnly: true },
  { part: 'web', path: 'spfx-client/package-lock.json', regex: JSON_VERSION, count: 2, form: plain, firstOnly: true },
  { part: 'web', path: 'spfx-client/src/webparts/backupWatch/BackupWatchWebPart.manifest.json', regex: JSON_VERSION, count: 1, form: plain, firstOnly: true },
  // solution.version and every features[].version (the only x.y.z.w versions in the file)
  { part: 'web', path: 'spfx-client/config/package-solution.json', regex: SOLUTION_VERSION, count: 'all', form: fourPart }
];

export function readVersionsFile(root = REPO_ROOT) {
  const versions = JSON.parse(readFileSync(join(root, 'versions.json'), 'utf8'));
  for (const part of PARTS) {
    if (!SEMVER.test(versions[part] || '')) throw new Error(`versions.json "${part}" is "${versions[part]}", not x.y.z`);
  }
  return versions;
}

export function writeVersionsFile(root, versions) {
  const out = {};
  for (const part of PARTS) out[part] = versions[part];
  writeFileSync(join(root, 'versions.json'), JSON.stringify(out, null, 2) + '\n');
}

export function bump(version, level) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  if (level === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown bump "${level}" – use patch, minor or major`);
}

function matchesOf(text, entry) {
  const all = [...text.matchAll(new RegExp(entry.regex.source, 'g'))];
  return entry.firstOnly ? all.slice(0, entry.count) : all;
}

// Returns the versions found in one file, or throws if the expected markers are missing.
export function readVersions(base, entry) {
  const file = join(base, entry.path);
  if (!existsSync(file)) throw new Error(`${entry.path}: file not found`);
  const found = matchesOf(readFileSync(file, 'utf8'), entry).map((m) => m[2]);
  const expected = entry.count === 'all' ? Math.max(found.length, 1) : entry.count;
  if (found.length < expected) {
    throw new Error(`${entry.path}: expected ${expected} version field(s), found ${found.length}`);
  }
  return found;
}

// Lists every file that disagrees with its half's version (empty array = all good).
export function checkFiles(base, entries, versions) {
  const problems = [];
  for (const entry of entries) {
    try {
      const want = entry.form(versions[entry.part]);
      for (const got of readVersions(base, entry)) {
        if (got !== want) problems.push(`${entry.path}: has ${got}, expected ${PART_LABEL[entry.part]} ${want}`);
      }
    } catch (e) {
      problems.push(e.message);
    }
  }
  return problems;
}

// Rewrites the version fields in one file, keeping its formatting and line endings.
export function writeVersion(base, entry, version) {
  const file = join(base, entry.path);
  const text = readFileSync(file, 'utf8');
  readVersions(base, entry); // fail before writing if the markers are missing
  let seen = 0;
  const limit = entry.count === 'all' ? Infinity : entry.count;
  const out = text.replace(new RegExp(entry.regex.source, 'g'), (m, pre, _old, post) => {
    if (entry.firstOnly && seen >= limit) return m;
    seen++;
    return `${pre}${entry.form(version)}${post}`;
  });
  writeFileSync(file, out);
}

// Parses --root <dir> (optional; used by tests and odd checkouts).
export function parseArgs(argv) {
  const args = { root: REPO_ROOT, rest: [], flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') args.root = resolve(argv[++i]);
    else if (a.startsWith('--')) args.flags.add(a);
    else args.rest.push(a);
  }
  return args;
}
