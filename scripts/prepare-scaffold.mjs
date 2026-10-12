// npm run scaffold:prepare
// Gets C:\Projects\BackupWatchScaffold (or BW_SCAFFOLD) ready for `gulp bundle --ship`:
//   1. checks every repo version file agrees (stops if not)
//   2. deletes the build output folders release\ and temp\ (stale bundles end up in the .sppkg otherwise)
//   3. copies spfx-client/src, spfx-client/package.json and the tracked scaffold/ config into it
//   4. checks the copies inside the scaffold are on the same version
// Replaces the manual robocopy / Remove-Item steps in CLAUDE.md §4. Local files only.

import { existsSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_FILES, SCAFFOLD_FILES, readVersionsFile, checkFiles, parseArgs } from './versionFiles.mjs';

const args = parseArgs(process.argv.slice(2));
const scaffold = args.scaffold;
const fail = (msg) => { console.error(msg); process.exit(1); };

const versions = readVersionsFile(args.root);
const repoProblems = checkFiles(args.root, REPO_FILES, versions);
if (repoProblems.length) {
  fail(`Version check FAILED (versions.json):\n  ${repoProblems.join('\n  ')}\nUse: npm run release -- backend|web|both patch|minor|major`);
}

// Only ever touch a folder that really is the SPFx build project.
if (!existsSync(join(scaffold, 'gulpfile.js')) || !existsSync(join(scaffold, 'config', 'package-solution.json'))) {
  fail(`${scaffold} does not look like the SPFx scaffold (no gulpfile.js / config/package-solution.json). Set BW_SCAFFOLD.`);
}

for (const dir of ['release', 'temp']) {
  rmSync(join(scaffold, dir), { recursive: true, force: true });
  console.log(`  removed ${join(scaffold, dir)}`);
}

cpSync(join(args.root, 'spfx-client', 'src'), join(scaffold, 'src'), { recursive: true, force: true });
console.log('  copied spfx-client/src');
cpSync(join(args.root, 'spfx-client', 'package.json'), join(scaffold, 'package.json'), { force: true });
console.log('  copied spfx-client/package.json');
for (const name of readdirSync(join(args.root, 'scaffold'))) {
  cpSync(join(args.root, 'scaffold', name), join(scaffold, name), { recursive: true, force: true });
  console.log(`  copied scaffold/${name}`);
}

const scaffoldProblems = checkFiles(scaffold, SCAFFOLD_FILES, versions);
if (scaffoldProblems.length) fail(`Scaffold copies disagree after sync:\n  ${scaffoldProblems.join('\n  ')}`);

console.log(`Scaffold ready at ${scaffold} – web part version ${versions.web}.`);
console.log('Next (from the scaffold folder):');
console.log('  node node_modules\\gulp\\bin\\gulp.js bundle --ship');
console.log('  node node_modules\\gulp\\bin\\gulp.js package-solution --ship');
console.log('  copy sharepoint\\solution\\backup-watch-scaffold.sppkg to the FifoDash repo root');
