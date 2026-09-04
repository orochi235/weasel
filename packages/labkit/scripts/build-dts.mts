/**
 * Emit labkit's `.d.ts` bundle.
 *
 * tsup's built-in dts (rollup-plugin-dts under the hood) can't resolve the
 * weasel specifiers labkit imports: it follows workspace node_modules symlinks
 * but ignores the tsconfig `paths` that `tsc` honors, so types drifted to
 * `never`. This script runs rollup-plugin-dts directly against an explicit
 * table instead.
 *
 * That table points at each dependency's BUILT declarations, mirroring the way
 * `tsup.config.ts` aliases core to its built JS. Pointing it at source instead
 * — as this script once did — pulls the whole weasel graph into one TypeScript
 * program and roughly doubles both the heap and the wall time, to re-derive
 * declarations the earlier build tiers have already emitted. The emitted types
 * are identical either way.
 *
 * `build:leaves` → `build:core` → `build:downstream` puts labkit last, so those
 * files exist by the time this runs; `requireBuilt()` says so plainly if they
 * don't.
 *
 * Run via `tsx` (not plain node) so it can import the TypeScript helper above.
 */
import { existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import alias from '@rollup/plugin-alias';
import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import { weaselDtsAliases, weaselDtsPaths } from '../../../scripts/dts-aliases.ts';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..'); // packages/labkit
const weaselRoot = resolve(pkgRoot, '../..'); // monorepo root

// Mirror tsup's entry map exactly so each `.d.ts` lands next to its `.js` and
// matches the package `exports` map. Keys are output paths (sans extension).
const entries: Record<string, string> = {
  index: 'src/index.ts',
  'chrome/index': 'src/chrome/index.ts',
  'primitives/index': 'src/primitives/index.ts',
  'state/index': 'src/state/index.ts',
  'controls/index': 'src/controls/index.ts',
  'canvas/index': 'src/canvas/index.ts',
  'layers/index': 'src/layers/index.ts',
  'loupe/index': 'src/loupe/index.ts',
  'undo/index': 'src/undo/index.ts',
  'dragdrop/index': 'src/dragdrop/index.ts',
  'passthrough/weasel-ui': 'src/passthrough/weasel-ui.ts',
  'passthrough/weasel-canvas': 'src/passthrough/weasel-canvas.ts',
  'surface/index': 'src/surface/index.ts',
  'job/index': 'src/job/index.ts',
  'ui/layers/index': 'src/ui/layers/index.ts',
};

const input = Object.fromEntries(
  Object.entries(entries).map(([name, rel]) => [name, resolve(pkgRoot, rel)]),
);

// Third-party libs are declared labkit deps (and react* are peers): keep them as
// external `import` statements in the emitted types instead of inlining them.
// Everything under @weasel-js/* is redirected to source by the alias plugin and
// therefore inlined, matching the self-contained JS bundle.
const external = [
  /^react($|\/)/,
  /^react-dom($|\/)/,
  'react-aria-components',
  'earcut',
  'polygon-clipping',
  /^zustand($|\/)/,
];

/**
 * Fail with the fix rather than with a rollup resolution error, since building
 * labkit alone in a tree that has never been built is an easy thing to do.
 */
function requireBuilt(entries: ReturnType<typeof weaselDtsAliases>): void {
  const missing = entries
    .map((e) => e.replacement)
    .filter((f) => !f.includes('$1') && !existsSync(f))
    .map((f) => relative(weaselRoot, f));
  if (missing.length === 0) return;
  console.error(
    `labkit's .d.ts bundle inlines its dependencies' built declarations, and ${missing.length} are missing:\n` +
      `${missing.map((f) => `  ${f}`).join('\n')}\n` +
      'Run `npm run build` from the repo root, which builds those tiers first.',
  );
  process.exit(1);
}

const aliases = weaselDtsAliases(weaselRoot, ['@weasel-js/labkit']);

async function main(): Promise<void> {
  requireBuilt(aliases);
  const bundle = await rollup({
    input,
    external,
    plugins: [
      alias({ entries: aliases }),
      // Stub style imports: CSS carries no type information, but a bare
      // side-effect import (e.g. Toast's toastViewTransitions.css) survives
      // tree-shaking, and rollup would otherwise parse the CSS as JS.
      {
        name: 'stub-css',
        resolveId(source: string) {
          return source.endsWith('.css') ? `\0css:${source}` : null;
        },
        load(id: string) {
          return id.startsWith('\0css:') ? 'export default {};' : null;
        },
      },
      dts({
        tsconfig: resolve(pkgRoot, 'tsconfig.dts.json'),
        compilerOptions: { paths: weaselDtsPaths(weaselRoot, ['@weasel-js/labkit']) },
        // Don't follow into node_modules; third-party types stay external.
        respectExternal: false,
      }),
    ],
    onwarn(warning, warn) {
      // Circular type-only references are expected across the weasel graph.
      if (warning.code === 'CIRCULAR_DEPENDENCY') return;
      warn(warning);
    },
  });

  await bundle.write({
    dir: resolve(pkgRoot, 'dist'),
    format: 'es',
    entryFileNames: '[name].d.ts',
    // Shared type chunks (rollup code-splits multi-entry builds). Internal only;
    // entry `.d.ts` files re-export from them.
    chunkFileNames: '_dts/[name]-[hash].d.ts',
  });
  await bundle.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
