/**
 * The engine half of core — the scene, selection, snapping, aim and the
 * action contract a 3D host drives — must not reach the 2D stack, even through
 * a type import. It is what `@weasel-js/engine` would hold, and what
 * `kernel3d` needs from core.
 *
 * Walks core's source imports from the seed files below, type imports
 * included, and fails on a 2D package in the closure. A package already
 * reached is listed in `check-engine-boundary.allow.json`; that list only
 * shrinks, and `--update` rewrites it to what is reached now when that is less.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'packages/core/src');
const ALLOW = join(ROOT, 'scripts/check-engine-boundary.allow.json');

export const SEEDS = [
  'core/scene/scene.ts',
  'core/scene/composeFrame.ts',
  'core/selection/useSelection.ts',
  'domains/snap/types.ts',
  'domains/snap/roles.ts',
  'domains/snap/session2d.ts',
  'domains/snap/outcomeStore.ts',
  'domains/snap/gather.ts',
  'domains/viewports/aim.ts',
  'interactions/actions/snapDep.ts',
  'interactions/actions/resolveOverlays.ts',
  'interactions/actions/engineDeps.ts',
  'interactions/actions/insertDeps.ts',
  'canvas/deps/enteredGroup.ts',
];
export const TWO_D = ['@weasel-js/renderer', '@weasel-js/text', '@weasel-js/font', '@weasel-js/stroke',
  '@weasel-js/text-dom', '@weasel-js/svg', 'earcut', 'polygon-clipping'];

const IMPORT = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const isFile = (p) => existsSync(p) && statSync(p).isFile();
const TOP_DIRS = new Set(readdirSync(SRC).filter((d) => statSync(join(SRC, d)).isDirectory()));

function resolveLocal(from, spec) {
  let base;
  if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else if (TOP_DIRS.has(spec.split('/')[0])) base = join(SRC, spec);
  else return null;
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (isFile(base + ext)) return base + ext;
  return null;
}

const packageName = (spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2) : spec.split('/').slice(0, 1)).join('/');

/** Every 2D package the seeds reach, each with the import chain that reaches it first. */
export function reached() {
  const prev = new Map(SEEDS.map((s) => [join(SRC, s), null]));
  const queue = [...prev.keys()];
  const found = new Map();
  while (queue.length) {
    const file = queue.shift();
    for (const m of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const spec = m[1] ?? m[2];
      const local = resolveLocal(file, spec);
      if (local) {
        if (!prev.has(local)) { prev.set(local, file); queue.push(local); }
        continue;
      }
      const pkg = packageName(spec);
      if (!TWO_D.includes(pkg) || found.has(pkg)) continue;
      const chain = [];
      for (let f = file; f; f = prev.get(f)) chain.unshift(relative(SRC, f));
      found.set(pkg, chain);
    }
  }
  return found;
}

function main() {
  const found = reached();
  const allowed = new Set(JSON.parse(readFileSync(ALLOW, 'utf8')));
  const now = [...found.keys()].sort();
  const fresh = now.filter((p) => !allowed.has(p));
  for (const pkg of fresh) {
    console.error(`[engine-boundary] ${pkg} is newly reachable from the engine seeds:\n  ${found.get(pkg).join('\n  -> ')}`);
  }
  if (fresh.length) process.exit(1);
  if (process.argv.includes('--update') && now.length < allowed.size) {
    writeFileSync(ALLOW, `${JSON.stringify(now, null, 2)}\n`);
    console.log(`[engine-boundary] allowlist lowered to ${now.length}`);
  } else if (now.length < allowed.size) {
    console.log(`[engine-boundary] ${allowed.size - now.length} allowed package(s) no longer reached; run with --update`);
  }
  for (const pkg of now) console.log(`[engine-boundary] still reached: ${pkg} via ${found.get(pkg).join(' -> ')}`);
  console.log(`[engine-boundary] OK — ${now.length} 2D package(s) reached, none new.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
