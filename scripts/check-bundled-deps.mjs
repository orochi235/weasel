#!/usr/bin/env node
/**
 * Fails when a package's build inlines one of its own declared dependencies. A
 * consumer then runs two copies of it, and a context one copy creates never
 * reaches the other: ui once carried its own react-aria PortalProvider, so no
 * dialog saw the theme root it was told to portal into.
 *
 * Reads the built sourcemaps, which name every file a chunk took in. Run after a build.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { publishableWorkspaces, repoRoot } from './lib/workspaces.mjs';

const VENDORED = /node_modules\/((?:@[^/]+\/)?[^/]+)\//;

function* maps(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* maps(path);
    else if (entry.name.endsWith('.js.map')) yield path;
  }
}

// A checkout to read in place of this one, for checking another tree's build.
const root = process.argv[2] ?? repoRoot;

const found = [];
// A package with no sourcemap to read would pass on nothing: unbuilt, or built with its maps turned off.
const unread = [];
for (const { dir, manifest } of publishableWorkspaces(root)) {
  const dist = join(dir, 'dist');
  const read = existsSync(dist) ? [...maps(dist)] : [];
  if (read.length === 0) unread.push(`  ${manifest.name} (${relative(root, dist)})`);
  const declared = new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {})]);
  for (const map of read) {
    const inlined = new Set();
    for (const source of JSON.parse(readFileSync(map, 'utf8')).sources ?? []) {
      const dep = VENDORED.exec(source)?.[1];
      if (dep !== undefined && declared.has(dep)) inlined.add(dep);
    }
    for (const dep of inlined) found.push(`  ${manifest.name} inlines ${dep} in ${relative(root, map)}`);
  }
}

if (unread.length > 0) {
  console.error('check:bundled-deps — no .js.map to read, so nothing says what these builds took in:');
  console.error(unread.join('\n'));
  console.error('\nRun `npm run build` first, and keep `sourcemap: true` in the package\'s build config.');
  process.exit(1);
}
if (found.length > 0) {
  console.error('check:bundled-deps — a build carries its own copy of a dependency it declares:');
  console.error(found.join('\n'));
  console.error('\nMark it external in that package\'s build config.');
  process.exit(1);
}
console.log('check:bundled-deps — no build inlines a dependency it declares.');
