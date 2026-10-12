// npm run verify-versions [-- --scaffold]
// Fails (exit 1) if any version file disagrees with its half's version in the repo-root
// versions.json (backend and web part are versioned separately – decision D-03).
// Runs as the backend `prebuild` and inside scaffold:prepare.
// --scaffold also checks the copies inside C:\Projects\BackupWatchScaffold (or BW_SCAFFOLD).

import { REPO_FILES, SCAFFOLD_FILES, readVersionsFile, checkFiles, parseArgs } from './versionFiles.mjs';

const args = parseArgs(process.argv.slice(2));
const versions = readVersionsFile(args.root);

const problems = checkFiles(args.root, REPO_FILES, versions);
if (args.flags.has('--scaffold')) {
  problems.push(...checkFiles(args.scaffold, SCAFFOLD_FILES, versions).map((p) => `[scaffold] ${p}`));
}

const summary = `Backend ${versions.backend}, Web part ${versions.web}`;
if (problems.length) {
  console.error(`Version check FAILED – versions.json says ${summary}:`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('Do not edit version numbers by hand – use: npm run release -- backend|web|both patch|minor|major');
  process.exit(1);
}

console.log(`Version check OK – ${summary}.`);
