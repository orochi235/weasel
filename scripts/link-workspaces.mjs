#!/usr/bin/env node
// Gives a worktree nested in the main checkout an install of its own without `npm ci`: each
// workspace package is linked into the worktree's `node_modules`, each package's own `node_modules`
// (where npm puts a version that conflicts with the root's) is linked from the main checkout's, and
// every other dependency still resolves from the main checkout's install. Refused when the two
// lockfiles differ.
//
//   node scripts/link-workspaces.mjs [worktree]      default: the current directory
import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync } from 'node:fs';
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

let linked = 0;
let nestedLinked = 0;
for (const pattern of JSON.parse(read(join(root, 'package.json'))).workspaces) {
  const base = pattern.replace(/\/\*$/, '');
  const dirs = pattern.endsWith('/*') ? readdirSync(join(root, base)).map((d) => join(base, d)) : [base];
  for (const dir of dirs) {
    const manifest = join(root, dir, 'package.json');
    if (!existsSync(manifest)) continue;
    const nested = join(root, dir, 'node_modules');
    if (!existsSync(nested) && existsSync(join(host, dir, 'node_modules'))) {
      symlinkSync(join(host, dir, 'node_modules'), nested, 'dir');
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
console.log(
  `linked ${linked} workspace packages and ${nestedLinked} package node_modules into ${root}; the rest resolves from ${host}`,
);
