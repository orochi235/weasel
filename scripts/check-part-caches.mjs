#!/usr/bin/env node
/**
 * A part each owner gets once goes through `createPart` from @weasel-js/registry, not a
 * module-level `WeakMap` read and written by hand. This fails the build on a module-level
 * `const x = new WeakMap(...)` that its file both `.get`s and `.set`s.
 *
 * To add a site to the allowlist, say in the entry why the map is not a part: its value turns on
 * more than the owner, it is deleted or overwritten, or it is read without being made. An entry
 * covers one map: a second in the same file fails until the entry says how many it covers and why.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { judgeUses, sourceFiles } from './lib/allowlisted-uses.mjs';
import { PART_CACHE_ALLOWED as ALLOWED } from './check-part-caches.allow.mjs';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-examples', 'public', 'coverage']);
const isSource = (name) =>
  /\.(ts|tsx|mts)$/.test(name) &&
  !/\.(test|spec|stories|fixtures?)\.(ts|tsx)$/.test(name) &&
  !name.endsWith('.d.ts') &&
  name !== 'test-setup.ts';

const DECLARATION = /^(?:export\s+)?const\s+(\w+)(?:\s*:[^=]+)?\s*=\s*new\s+WeakMap\b/gm;

/** The 1-based lines of `source` that declare a module-level `WeakMap` the source both reads and writes. */
export function partCacheLines(source) {
  const lines = [];
  for (const match of source.matchAll(DECLARATION)) {
    const name = match[1];
    if (new RegExp(String.raw`\b${name}\.get\(`).test(source) && new RegExp(String.raw`\b${name}\.set\(`).test(source)) {
      lines.push(source.slice(0, match.index).split('\n').length);
    }
  }
  return lines;
}

function sourceRoots(root) {
  const roots = [];
  const packages = join(root, 'packages');
  for (const pkg of readdirSync(packages)) {
    const src = join(packages, pkg, 'src');
    try {
      if (statSync(src).isDirectory()) roots.push(src);
    } catch {
      // A directory with no src ships nothing.
    }
  }
  return roots;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));

  const found = new Map();
  for (const dir of sourceRoots(ROOT)) {
    for (const file of sourceFiles(dir, { skip: SKIP_DIRS, keep: isSource })) {
      const lines = partCacheLines(readFileSync(file, 'utf8'));
      if (lines.length) found.set(relative(ROOT, file), lines);
    }
  }
  const { offenders, stale } = judgeUses(found, ALLOWED);

  if (offenders.length > 0) {
    console.error(
      `check:part-caches — ${offenders.length} hand-rolled per-owner cache(s):\n` +
        offenders.map((o) => `  ${o}`).join('\n') +
        '\n\nMake each owner\'s part through `createPart` from @weasel-js/registry.\n' +
        'A map that is not a part (its value turns on more than the owner, it is deleted or\n' +
        'overwritten, or it is read without being made) goes on the allowlist in\n' +
        'scripts/check-part-caches.allow.mjs, saying why.',
    );
    process.exit(1);
  }
  if (stale.length > 0) {
    console.error(
      `check:part-caches — allowlist entries covering maps their files no longer hold:\n` +
        stale.map((s) => `  ${s}`).join('\n') +
        '\n\nLower or remove each entry in scripts/check-part-caches.allow.mjs.',
    );
    process.exit(1);
  }

  console.log('part caches: every per-owner part goes through createPart.');
}
