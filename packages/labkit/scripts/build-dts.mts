/**
 * Emit labkit's `.d.ts` bundle.
 *
 * tsup's built-in dts (rollup-plugin-dts under the hood) can't type the bundled
 * weasel sources: it resolves workspace members via their node_modules symlinks
 * but can't resolve the root-package core, and it ignores the tsconfig `paths`
 * that `tsc` honors — so types drifted to `never`. This script runs
 * rollup-plugin-dts directly with an explicit alias plugin so every weasel
 * specifier resolves to SOURCE, the same way the runtime build and the dev
 * server do.
 *
 * The alias table comes straight from the monorepo's `weaselAliases()` — the
 * single source of truth for name→source mapping. Because the JS bundle, the
 * vite/vitest configs, and this dts build all read that one helper, a future
 * weasel package rename is a one-file change in `scripts/vite-aliases.ts`; this
 * script needs no edit.
 *
 * Run via `tsx` (not plain node) so it can import the TypeScript helper above.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import alias from '@rollup/plugin-alias';
import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import { weaselAliases } from '../../../scripts/vite-aliases.ts';

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

async function main(): Promise<void> {
  const bundle = await rollup({
    input,
    external,
    plugins: [
      // Resolve weasel specifiers to source. plugin-alias delegates the final
      // resolution back through `this.resolve`, so rollup-plugin-dts supplies
      // the `.ts`/`.tsx` extension for the rewritten (extensionless) paths.
      alias({ entries: weaselAliases(weaselRoot) }),
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
