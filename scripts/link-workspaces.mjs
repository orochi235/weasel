#!/usr/bin/env node
// Gives a worktree nested in the main checkout an install of its own without `npm ci`: each
// workspace package is linked into the worktree's `node_modules`, each package installed in a
// package's own `node_modules` (where npm puts a version that conflicts with the root's) is linked
// from the main checkout's, and every other dependency still resolves from the main checkout's
// install. Refused when the two lockfiles differ.
//
// The links are per package inside a directory of the worktree's own, never the directory itself:
// npm in the worktree renames a package it replaces out of the way first, and through a linked
// directory that rename lands in the main checkout's install, which then lost font's opentype.js
// and forge's @babel/parser (2026-11-16). A link to the package is renamed itself instead.
//
//   node scripts/link-workspaces.mjs [worktree]      default: the current directory
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const read = (p) => readFileSync(p, 'utf8');

let host = null;
for (let dir = dirname(root); dir !== dirname(dir); dir = dirname(dir)) {
  if (existsSync(join(dir, 'node_modules', '@weasel-js', 'core'))) {
    host = dir;
    break;
  }
}
if (!host) {
  console.error(`no ancestor of ${root} has an install to borrow; run \`npm ci\` there instead.`);
  process.exit(1);
}
// What the host installed: every lockfile entry under a `node_modules` that is not a workspace link.
// A branch adding a dependency on a sibling package changes only entries this leaves out.
const installed = (dir) => {
  const { packages } = JSON.parse(read(join(dir, 'package-lock.json')));
  return JSON.stringify(
    Object.entries(packages).filter(([path, entry]) => path.includes('node_modules/') && !entry.link),
  );
};
if (installed(root) !== installed(host)) {
  console.error(`${root} installs different dependencies from ${host}, so they cannot be borrowed; run \`npm ci\`.`);
  process.exit(1);
}

const isLink = (path) => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};

/** Links each package in `from`, a `node_modules`, into `to`, a new directory; a scope's packages
 *  one by one. Dot entries (`.bin`, npm's own records) stay behind. */
const linkPackages = (from, to) => {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    if (entry.startsWith('.')) continue;
    if (entry.startsWith('@')) linkPackages(join(from, entry), join(to, entry));
    else symlinkSync(join(from, entry), join(to, entry), 'dir');
  }
};

let linked = 0;
let nestedLinked = 0;
for (const pattern of JSON.parse(read(join(root, 'package.json'))).workspaces) {
  const base = pattern.replace(/\/\*$/, '');
  const dirs = pattern.endsWith('/*') ? readdirSync(join(root, base)).map((d) => join(base, d)) : [base];
  for (const dir of dirs) {
    const manifest = join(root, dir, 'package.json');
    if (!existsSync(manifest)) continue;
    const nested = join(root, dir, 'node_modules');
    // A worktree this linked before linked the whole directory; relink it package by package.
    if (isLink(nested)) unlinkSync(nested);
    if (!existsSync(nested) && existsSync(join(host, dir, 'node_modules'))) {
      linkPackages(join(host, dir, 'node_modules'), nested);
      nestedLinked++;
    }
    const { name } = JSON.parse(read(manifest));
    const at = name && join(root, 'node_modules', name);
    if (!at || existsSync(at)) continue;
    mkdirSync(dirname(at), { recursive: true });
    symlinkSync(join(root, dir), at, 'dir');
    linked++;
  }
}
// These caches hold imports already resolved, and are cleared only when the host's lockfile changes, so a
// run from before a link existed keeps its old resolution (font's opentype.js 1.3.4 in place of its 2.0.0).
if (linked + nestedLinked > 0) {
  for (const cache of ['.vitest-cache', '.vite', '.vite-browser']) {
    rmSync(join(root, 'node_modules', cache), { recursive: true, force: true });
  }
}
console.log(
  `linked ${linked} workspace packages and ${nestedLinked} package node_modules into ${root}; the rest resolves from ${host}`,
);
