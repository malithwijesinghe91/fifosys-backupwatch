// npm run release -- backend|web|both patch|minor|major
// Bumps the version of the half (or halves) that changed – decision D-03: separate versions.
// Writes versions.json and every version file of that half, then adds a dated CHANGELOG stub.
// Local files only: it never builds, deploys, commits or tags. See CLAUDE.md §2.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPO_FILES, PART_LABEL, readVersionsFile, writeVersionsFile, bump, checkFiles, writeVersion, parseArgs
} from './versionFiles.mjs';

const args = parseArgs(process.argv.slice(2));
const [target, level] = args.rest;
const usage = () => {
  console.error('Usage: npm run release -- backend|web|both patch|minor|major');
  console.error('  backend = Azure Function changed, web = SharePoint web part changed, both = both changed');
  console.error('  patch = fix or polish, minor = something new, major = changes how it all works');
  process.exit(1);
};

if (!['backend', 'web', 'both'].includes(target) || !['patch', 'minor', 'major'].includes(level)) usage();

const parts = target === 'both' ? ['backend', 'web'] : [target];
const current = readVersionsFile(args.root);
const next = { ...current };
for (const part of parts) next[part] = bump(current[part], level);

for (const entry of REPO_FILES) {
  if (parts.includes(entry.part)) writeVersion(args.root, entry, next[entry.part]);
}
writeVersionsFile(args.root, next);

const problems = checkFiles(args.root, REPO_FILES, next);
if (problems.length) {
  console.error('Release aborted – files still disagree:\n  ' + problems.join('\n  '));
  process.exit(1);
}

// Dated CHANGELOG stub, labelled with the half that changed, inserted above the newest entry.
const heading = parts.map((p) => `${PART_LABEL[p]} ${next[p]}`).join(' / ');
const changelogPath = join(args.root, 'CHANGELOG.md');
const changelog = readFileSync(changelogPath, 'utf8');
const eol = changelog.includes('\r\n') ? '\r\n' : '\n';
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); // YYYY-MM-DD
const stub = [`## [${heading}] - ${today}`, '', '### Fixed', `- **Fixed (BW-xxx)**: TODO – describe the change.`, '', ''].join(eol);
const firstEntry = changelog.search(/^## \[/m);
if (changelog.includes(`## [${heading}]`)) {
  console.warn(`CHANGELOG.md already has a "${heading}" heading – left unchanged.`);
} else if (firstEntry === -1) {
  writeFileSync(changelogPath, changelog + eol + stub);
} else {
  writeFileSync(changelogPath, changelog.slice(0, firstEntry) + stub + changelog.slice(firstEntry));
}

for (const part of parts) console.log(`${PART_LABEL[part]} version ${current[part]} -> ${next[part]}`);
for (const part of ['backend', 'web'].filter((p) => !parts.includes(p))) {
  console.log(`${PART_LABEL[part]} version unchanged (${current[part]})`);
}
for (const entry of REPO_FILES.filter((e) => parts.includes(e.part))) console.log(`  updated ${entry.path}`);
console.log('  updated versions.json');
console.log(`  added CHANGELOG.md stub "${heading}" – fill it in`);
console.log('');
console.log('Next: commit, then deploy ONLY what changed (CLAUDE.md §4):');
if (parts.includes('backend')) {
  console.log('  backend  : stateless-backend -> npm run build, then func azure functionapp publish backupwatch-api --build local');
}
if (parts.includes('web')) {
  console.log('  web part : npm run scaffold:prepare, gulp bundle --ship, gulp package-solution --ship, upload .sppkg');
}
