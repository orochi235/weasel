#!/usr/bin/env node
/**
 * Asserts that the subpaths which promise no React keep that promise, by
 * walking the *built* module closure of each entry and failing on a React
 * specifier anywhere in it.
 *
 * Reading the sources cannot answer this: a leaf that reaches its package's
 * own barrel lands, under `splitting: true`, in a chunk the entry then imports.
 * The emitted graph is the only thing that knows.
 *
 * Run after a build. A missing entry file is a failure, not a skip: that is
 * what a stale or partial build looks like.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importSpecifiers } from './lib/imports.mjs';
import { REACT_FREE_ENTRIES } from './react-free-entries.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** A specifier that must not appear anywhere in a React-free closure. */
const banned = (spec) =>
  spec === 'react' || spec.startsWith('react/') || spec === 'react-dom';

/**
 * Resolves a sibling workspace specifier to the built file its `exports` map
 * names, built or not, or `null` for anything outside the kit. A walk that stops at the
 * package boundary reports the React barrel as merely external and cannot fail.
 */
function resolveWorkspace(spec) {
  const m = /^@weasel-js\/([^/]+)(?:\/(.+))?$/.exec(spec);
  if (m === null) return null;
  const [, pkg, sub] = m;
  const dir = resolve(repoRoot, 'packages', pkg);
  const manifest = resolve(dir, 'package.json');
  if (!existsSync(manifest)) return null;
  const { exports: map } = JSON.parse(readFileSync(manifest, 'utf8'));
  const entry = map?.[sub === undefined ? '.' : `./${sub}`];
  const file = typeof entry === 'string' ? entry : entry?.import;
  if (typeof file !== 'string') return null;
  return resolve(dir, file);
}

/** Walks relative imports and workspace siblings alike; collects the rest. */
function closureOf(entry) {
  const seen = new Set();
  const external = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const spec of importSpecifiers(readFileSync(file, 'utf8'), file)) {
      if (spec.startsWith('.')) {
        walk(resolve(dirname(file), spec));
        continue;
      }
      const sibling = resolveWorkspace(spec);
      if (sibling === null || !existsSync(sibling)) external.add(spec);
      else walk(sibling);
    }
  };
  walk(entry);
  return { modules: seen, external };
}

let failed = false;
for (const { spec, why } of REACT_FREE_ENTRIES) {
  const abs = resolveWorkspace(spec);
  if (abs === null) throw new Error(`${spec} names no workspace package export`);
  const file = relative(repoRoot, abs);
  if (!existsSync(abs)) {
    console.error(`✗ ${file} — not built. Run \`npm run build\` first.`);
    failed = true;
    continue;
  }
  const { modules, external } = closureOf(abs);
  const bad = [...external].filter(banned).sort();
  if (bad.length > 0) {
    console.error(
      `✗ ${file} (${why})\n` +
        `  imports ${bad.join(', ')} across ${modules.size} module(s) in its closure.\n` +
        '  Find the leaf that reaches a React module or a barrel, and import from\n' +
        '  the leaf it lives in instead.',
    );
    failed = true;
    continue;
  }
  console.log(
    `✓ ${relative(repoRoot, abs)} — ${modules.size} module(s), ` +
      `external: ${[...external].sort().join(', ') || 'none'}`,
  );
}

process.exit(failed ? 1 : 0);
