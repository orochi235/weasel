/**
 * `@weasel-js/core/engine` is the half of core a host of any dimension uses,
 * and must not reach the 2D stack. Two walks of core's source imports enforce
 * it, and either failing on a 2D package fails the check:
 *
 * - the engine files — the scene, selection, snapping, aim and the dep
 *   contract, everything `SEEDS` reaches — with type imports included, since
 *   their declarations are the entry's;
 * - the entry (`import-shims/engine.ts`), value imports only: the actions and
 *   tools it adds may name a 2D type, but must not load 2D code.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SRC = join(ROOT, 'packages/core/src');
export const ENTRY = 'import-shims/engine.ts';

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

// `type` captured, so a value walk can skip type-only imports. An inline `import('x')` is a type position.
const IMPORT = /(?:import|export)\s+(type\s+)?(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
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

/** Walk from `starts`: the files reached, and each 2D package reached with the chain that reaches it first. */
function walk(starts, { values }) {
  const prev = new Map(starts.map((s) => [join(SRC, s), null]));
  const queue = [...prev.keys()];
  const found = new Map();
  while (queue.length) {
    const file = queue.shift();
    for (const m of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      if (values && (m[1] || m[3])) continue;
      const spec = m[2] ?? m[3];
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
  return { files: new Set(prev.keys()), found };
}

/** The engine files: everything the seeds reach, type imports included. */
export const engineFiles = () => walk(SEEDS, { values: false }).files;

function main() {
  const failures = [
    ['the engine files', walk(SEEDS, { values: false }).found],
    [ENTRY, walk([ENTRY], { values: true }).found],
  ].flatMap(([from, found]) => [...found].map(([pkg, chain]) => ({ from, pkg, chain })));
  for (const { from, pkg, chain } of failures) {
    console.error(`[engine-boundary] ${pkg} is reachable from ${from}:\n  ${chain.join('\n  -> ')}`);
  }
  if (failures.length) process.exit(1);
  console.log('[engine-boundary] OK — neither the engine files nor the engine entry reach a 2D package.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
