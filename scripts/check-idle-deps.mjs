#!/usr/bin/env node
/**
 * Fails when a package declares a sibling in `dependencies` or `peerDependencies` that nothing it
 * ships names. A consumer installs it for nothing, and the package graph shows an edge no code uses.
 *
 * Reads the build, not the source: TypeScript writes an inferred type as an import from the package
 * that defines it, so a `.d.ts` can need a sibling no source file imports; and a source file the build
 * never reaches (a story-only lab view) ships nothing, however much it imports. Run after a build.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { publishableWorkspaces, repoRoot } from './lib/workspaces.mjs';

const BUILT = /\.(?:[cm]?js|d\.[cm]?ts|css)$/;
const SPECIFIER = /["'](@weasel-js\/[a-z0-9-]+)(?:\/[^"'\s]*)?["']/g;

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (BUILT.test(entry.name)) yield path;
  }
}

// A checkout to read in place of this one, for checking another tree's build.
const root = process.argv[2] ?? repoRoot;

const idle = [];
// A package with nothing built to read would pass on nothing.
const unread = [];
for (const { dir, manifest } of publishableWorkspaces(root)) {
  const declared = [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {})].filter(
    (name) => name.startsWith('@weasel-js/') && name !== manifest.name,
  );
  if (declared.length === 0) continue;
  const dist = join(dir, 'dist');
  const read = existsSync(dist) ? [...files(dist)] : [];
  if (read.length === 0) {
    unread.push(`  ${manifest.name} (${relative(root, dist)})`);
    continue;
  }
  const named = new Set();
  for (const file of read) for (const m of readFileSync(file, 'utf8').matchAll(SPECIFIER)) named.add(m[1]);
  const unnamed = declared.filter((name) => !named.has(name));
  if (unnamed.length > 0) idle.push(`  ${manifest.name}   ${unnamed.join(', ')}`);
}

if (unread.length > 0) {
  console.error('check:idle-deps — no build to read, so nothing says what these packages use:');
  console.error(unread.join('\n'));
  console.error('\nRun `npm run build` first.');
  process.exit(1);
}
if (idle.length > 0) {
  console.error('check:idle-deps — a package declares a sibling nothing it ships names:');
  console.error(idle.join('\n'));
  console.error('\nDrop each from dependencies and peerDependencies, or move it to devDependencies if only tests,');
  console.error('stories or labs use it.');
  process.exit(1);
}
console.log('check:idle-deps — every declared sibling is named by something its package ships.');
