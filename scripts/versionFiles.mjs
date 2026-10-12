// Shared list of every file that carries the BackupWatch version (BW-011, decision D-03).
// Backend and web part always share ONE version, held in the repo-root package.json.
// Used by release.mjs (writes), verify-versions.mjs (checks) and prepare-scaffold.mjs (copies).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_SCAFFOLD = 'C:\\Projects\\BackupWatchScaffold';

const SEMVER = /^\d+\.\d+\.\d+$/;

// Each entry: a file plus a regex whose group 2 is the version text.
// `count` is how many matches the file must contain; `form` maps x.y.z to the file's format.
const plain = (v) => v;
const fourPart = (v) => `${v}.0`;

const JSON_VERSION = /("version"\s*:\s*")([^"]+)(")/g;
const SOLUTION_VERSION = /("version"\s*:\s*")(\d+\.\d+\.\d+\.\d+)(")/g;

export const REPO_FILES = [
  { path: 'stateless-backend/shared/version.ts', regex: /(APP_VERSION\s*=\s*")([^"]+)(")/g, count: 1, form: plain },
  { path: 'stateless-backend/package.json', regex: JSON_VERSION, count: 1, form: plain, firstOnly: true },
  { path: 'stateless-backend/package-lock.json', regex: JSON_VERSION, count: 2, form: plain, firstOnly: true },
  { path: 'spfx-client/package.json', regex: JSON_VERSION, count: 1, form: plain, firstOnly: true },
  { path: 'spfx-client/package-lock.json', regex: JSON_VERSION, count: 2, form: plain, firstOnly: true },
  { path: 'spfx-client/src/webparts/backupWatch/BackupWatchWebPart.manifest.json', regex: JSON_VERSION, count: 1, form: plain, firstOnly: true },
  // solution.version and every features[].version (the only x.y.z.w versions in the file)
  { path: 'scaffold/config/package-solution.json', regex: SOLUTION_VERSION, count: 'all', form: fourPart }
];

// Copies inside the build project, produced by prepare-scaffold.mjs. Checked with --scaffold.
export const SCAFFOLD_FILES = [
  { path: 'package.json', regex: JSON_VERSION, count: 1, form: plain, firstOnly: true },
  { path: 'src/webparts/backupWatch/BackupWatchWebPart.manifest.json', regex: JSON_VERSION, count: 1, form: plain, firstOnly: true },
  { path: 'config/package-solution.json', regex: SOLUTION_VERSION, count: 'all', form: fourPart }
];

export function readRootVersion(root = REPO_ROOT) {
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  if (!SEMVER.test(version || '')) throw new Error(`Root package.json version "${version}" is not x.y.z`);
  return version;
}

export function bump(version, part) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (part === 'major') return `${major + 1}.0.0`;
  if (part === 'minor') return `${major}.${minor + 1}.0`;
  if (part === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown bump "${part}" – use patch, minor or major`);
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

// Lists every mismatch between the files and the given version (empty array = all good).
export function checkFiles(base, entries, version) {
  const problems = [];
  for (const entry of entries) {
    try {
      const want = entry.form(version);
      for (const got of readVersions(base, entry)) {
        if (got !== want) problems.push(`${entry.path}: has ${got}, expected ${want}`);
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

export function setRootVersion(root, version) {
  const file = join(root, 'package.json');
  const text = readFileSync(file, 'utf8');
  writeFileSync(file, text.replace(JSON_VERSION, (m, pre, _old, post) => `${pre}${version}${post}`));
}

// Parses --root <dir> and --scaffold <dir> (both optional; used by tests and odd checkouts).
export function parseArgs(argv) {
  const args = { root: REPO_ROOT, scaffold: process.env.BW_SCAFFOLD || DEFAULT_SCAFFOLD, rest: [], flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') args.root = resolve(argv[++i]);
    else if (a === '--scaffold-dir') args.scaffold = resolve(argv[++i]);
    else if (a.startsWith('--')) args.flags.add(a);
    else args.rest.push(a);
  }
  return args;
}
