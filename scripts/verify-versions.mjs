// npm run verify-versions [-- --scaffold]
// Fails (exit 1) if any version file disagrees with the shared version in the repo-root
// package.json. Runs as the backend `prebuild` and inside scaffold:prepare.
// --scaffold also checks the copies inside C:\Projects\BackupWatchScaffold (or BW_SCAFFOLD).

import { REPO_FILES, SCAFFOLD_FILES, readRootVersion, checkFiles, parseArgs } from './versionFiles.mjs';

const args = parseArgs(process.argv.slice(2));
const version = readRootVersion(args.root);

const problems = checkFiles(args.root, REPO_FILES, version);
if (args.flags.has('--scaffold')) {
  problems.push(...checkFiles(args.scaffold, SCAFFOLD_FILES, version).map((p) => `[scaffold] ${p}`));
}

if (problems.length) {
  console.error(`Version check FAILED – shared version is ${version} (repo-root package.json):`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('Do not edit version numbers by hand – use: npm run release -- patch|minor|major');
  process.exit(1);
}

console.log(`Version check OK – every file is on ${version}.`);
