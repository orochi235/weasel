#!/usr/bin/env node
/**
 * Fails when a package declares a sibling in `dependencies` or `peerDependencies` that nothing it
 * ships names: a consumer installs it for nothing, and the package graph shows an edge no code uses.
 * And fails the other way, when what a package ships imports a sibling it declares only as a
 * devDependency, or not at all: a consumer's install then lacks it.
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
// Only an import names a sibling the consumer must install; prose in a doc comment does not.
const IMPORTED = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|@import\s+(?:url\()?)["'](@weasel-js\/[a-z0-9-]+)(?:\/[^"'\s]*)?["']/g;

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
const undeclared = [];
// A package with nothing built to read would pass on nothing.
const unread = [];
for (const { dir, manifest } of publishableWorkspaces(root)) {
  const declared = [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {})].filter(
    (name) => name.startsWith('@weasel-js/') && name !== manifest.name,
  );
  const dist = join(dir, 'dist');
  const read = existsSync(dist) ? [...files(dist)] : [];
  if (read.length === 0) {
    unread.push(`  ${manifest.name} (${relative(root, dist)})`);
    continue;
  }
  const named = new Set();
  const imported = new Set();
  for (const file of read) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(SPECIFIER)) named.add(m[1]);
    for (const m of text.matchAll(IMPORTED)) if (m[1] !== manifest.name) imported.add(m[1]);
  }
  const unnamed = declared.filter((name) => !named.has(name));
  if (unnamed.length > 0) idle.push(`  ${manifest.name}   ${unnamed.join(', ')}`);
  const missing = [...imported].filter((name) => !declared.includes(name)).sort();
  if (missing.length > 0) undeclared.push(`  ${manifest.name}   ${missing.join(', ')}`);
}

if (unread.length > 0) {
  console.error('check:idle-deps — no build to read, so nothing says what these packages use:');
  console.error(unread.join('\n'));
  console.error('\nRun `npm run build` first.');
  process.exit(1);
}
if (undeclared.length > 0) {
  console.error('check:idle-deps — a package ships an import of a sibling it does not depend on:');
  console.error(undeclared.join('\n'));
  console.error('\nDeclare each in dependencies or peerDependencies; a devDependency never reaches a consumer.');
}
if (idle.length > 0) {
  console.error('check:idle-deps — a package declares a sibling nothing it ships names:');
  console.error(idle.join('\n'));
  console.error('\nDrop each from dependencies and peerDependencies, or move it to devDependencies if only tests,');
  console.error('stories or labs use it.');
}
if (undeclared.length > 0 || idle.length > 0) process.exit(1);
console.log('check:idle-deps — every package depends on exactly the siblings its build names.');
