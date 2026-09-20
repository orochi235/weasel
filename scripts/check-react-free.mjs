#!/usr/bin/env node
/**
 * Asserts that the subpaths which promise no React keep that promise, by
 * walking the *built* module closure of each entry and failing on a React
 * specifier anywhere in it.
 *
 * Reading the sources cannot answer this. `@weasel-js/core/math` re-exports
 * nine leaf modules that each import only numbers, and its first build still
 * pulled a megabyte of canvas and `react` — one of those leaves reached this
 * package's own barrel, and `splitting: true` put the result in a chunk the
 * entry then imported. The emitted graph is the only thing that knows.
 *
 * Run after a build. A missing entry file is a failure, not a skip: that is
 * what a stale or partial build looks like.
 *
 * **Watched to fail before it was trusted**, both ways, since a green check
 * against broken code is the failure this repo keeps re-learning. Pointed at
 * `core/dist/index.js` it names `react, react/jsx-runtime` across 29 modules
 * and exits 1. Pointed at `diagram/dist/index.js` — whose own externals are
 * `@weasel-js/core`, `@weasel-js/core/math` and `react` — it reports
 * `react/jsx-runtime` too, which it can only have reached by following the
 * sibling through its `exports` map. That second one is the case the first
 * draft of this script got wrong.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Entry files that must have no React in their closure, and why each exists. */
const ENTRIES = [
  {
    file: 'packages/core/dist/math.js',
    why: 'the geometry and simulation half, for a server with no DOM',
  },
  {
    file: 'packages/diagram/dist/layout.js',
    why: 'measurement, ranking, force and ports, for a server-side layout',
  },
];

/** A specifier that must not appear anywhere in a React-free closure. */
const banned = (spec) =>
  spec === 'react' || spec.startsWith('react/') || spec === 'react-dom';

/** Every static specifier in a module, import and re-export alike. */
function specifiersIn(source) {
  const out = [];
  for (const m of source.matchAll(
    /(?:^|[\s;}])(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g,
  )) {
    out.push(m[1]);
  }
  // A bare side-effect import (`import './chunk-X.js';`) has no `from`.
  for (const m of source.matchAll(/(?:^|[\s;])import\s*['"]([^'"]+)['"]/g))
    out.push(m[1]);
  return out;
}

/**
 * Resolves a sibling workspace specifier to the built file its `exports` map
 * names, or `null` for anything outside the kit.
 *
 * Following these is the entire point. The first version of this script
 * stopped at the package boundary and passed `@weasel-js/diagram/layout` —
 * whose one external was `@weasel-js/core`, the React barrel. A check that
 * reports the barrel as merely 'external' is a check that cannot fail.
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
  const abs = resolve(dir, file);
  return existsSync(abs) ? abs : null;
}

/** Walks relative imports and workspace siblings alike; collects the rest. */
function closureOf(entry) {
  const seen = new Set();
  const external = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const spec of specifiersIn(readFileSync(file, 'utf8'))) {
      if (spec.startsWith('.')) {
        walk(resolve(dirname(file), spec));
        continue;
      }
      const sibling = resolveWorkspace(spec);
      if (sibling === null) external.add(spec);
      else walk(sibling);
    }
  };
  walk(entry);
  return { modules: seen, external };
}

let failed = false;
for (const { file, why } of ENTRIES) {
  const abs = resolve(repoRoot, file);
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
