// npm run build:web
// Builds the web part package from spfx-client/ (the SPFx project, tracked in this repo):
//   1. checks every repo version file agrees with versions.json (stops if not)
//   2. deletes old build output (lib, temp, release, sharepoint/solution) so no stale bundle is packaged
//   3. gulp bundle --ship, then gulp package-solution --ship (stops at the first failure)
//   4. copies backup-watch-scaffold.sppkg to the repo root, ready to upload to the App Catalog
// Replaces the old C:\Projects\BackupWatchScaffold copy-and-build steps. Local files only.

import { existsSync, rmSync, copyFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_FILES, readVersionsFile, checkFiles, parseArgs } from './versionFiles.mjs';

const args = parseArgs(process.argv.slice(2));
const web = join(args.root, 'spfx-client');
const fail = (msg) => { console.error(msg); process.exit(1); };

const versions = readVersionsFile(args.root);
const problems = checkFiles(args.root, REPO_FILES, versions);
if (problems.length) {
  fail(`Version check FAILED (versions.json):\n  ${problems.join('\n  ')}\nUse: npm run release -- backend|web|both patch|minor|major`);
}

const gulp = join(web, 'node_modules', 'gulp', 'bin', 'gulp.js');
if (!existsSync(gulp)) fail('SPFx build tools are not installed. Run: cd spfx-client && npm ci');

for (const dir of ['lib', 'temp', 'release', join('sharepoint', 'solution')]) {
  rmSync(join(web, dir), { recursive: true, force: true });
}
console.log('  removed old build output');

// SPFx 1.19 supports Node 18 only (spfx-client/package.json "engines"). Rather than patching Microsoft's
// version check (as the old external scaffold did), run the build on that Node via npx, whatever Node
// this machine has installed. npx downloads it once and caches it.
const BUILD_NODE = 'node@18.20.8';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
for (const task of ['bundle', 'package-solution']) {
  console.log(`  gulp ${task} --ship (on ${BUILD_NODE}) ...`);
  const r = spawnSync(npx, ['--yes', '-p', BUILD_NODE, '--', 'node', gulp, task, '--ship'],
    { cwd: web, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) fail(`gulp ${task} failed (exit ${r.status}) – no package produced.`);
}

const built = join(web, 'sharepoint', 'solution', 'backup-watch-scaffold.sppkg');
if (!existsSync(built)) fail(`Package not found at ${built}`);
const target = join(args.root, 'backup-watch-scaffold.sppkg');
copyFileSync(built, target);
console.log(`Web part ${versions.web} packaged: ${target} (${statSync(target).size} bytes)`);
console.log('Next: upload it to the SharePoint App Catalog.');
