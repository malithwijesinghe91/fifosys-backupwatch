// npm run release -- patch|minor|major
// Bumps the ONE shared BackupWatch version (repo-root package.json) and writes it to every
// version file, then adds a dated CHANGELOG stub. Writes local files only: it never builds,
// deploys, commits or tags. See CLAUDE.md §2 (decision D-03) and REMEDIATION_PLAN.md BW-011.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPO_FILES, readRootVersion, bump, checkFiles, writeVersion, setRootVersion, parseArgs
} from './versionFiles.mjs';

const args = parseArgs(process.argv.slice(2));
const part = args.rest[0];

if (!['patch', 'minor', 'major'].includes(part)) {
  console.error('Usage: npm run release -- patch|minor|major');
  console.error('  patch = fix or polish, minor = something new, major = changes how it all works');
  process.exit(1);
}

const current = readRootVersion(args.root);
const next = bump(current, part);

for (const entry of REPO_FILES) writeVersion(args.root, entry, next);
setRootVersion(args.root, next);

const problems = checkFiles(args.root, REPO_FILES, next);
if (problems.length) {
  console.error('Release aborted – files still disagree:\n  ' + problems.join('\n  '));
  process.exit(1);
}

// Dated CHANGELOG stub, inserted above the newest existing entry.
const changelogPath = join(args.root, 'CHANGELOG.md');
const changelog = readFileSync(changelogPath, 'utf8');
const eol = changelog.includes('\r\n') ? '\r\n' : '\n';
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); // YYYY-MM-DD
const stub = [`## [${next}] - ${today}`, '', '### Fixed', '- **Fixed (BW-xxx)**: TODO – describe the change.', '', ''].join(eol);
const firstEntry = changelog.search(/^## \[/m);
if (changelog.includes(`## [${next}]`)) {
  console.warn(`CHANGELOG.md already has a ${next} heading – left unchanged.`);
} else if (firstEntry === -1) {
  writeFileSync(changelogPath, changelog + eol + stub);
} else {
  writeFileSync(changelogPath, changelog.slice(0, firstEntry) + stub + changelog.slice(firstEntry));
}

console.log(`BackupWatch version ${current} -> ${next}`);
for (const entry of REPO_FILES) console.log(`  updated ${entry.path}`);
console.log('  updated package.json (root)');
console.log(`  added CHANGELOG.md stub for ${next} – fill it in`);
console.log('');
console.log('Next: commit, then ship BOTH halves (CLAUDE.md §4):');
console.log('  backend  : npm run build in stateless-backend, then func azure functionapp publish backupwatch-api --build local');
console.log('  web part : npm run scaffold:prepare, gulp bundle --ship, gulp package-solution --ship, upload .sppkg');
