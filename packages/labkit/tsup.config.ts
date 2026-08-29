import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const here = dirname(fileURLToPath(import.meta.url));
const weaselRoot = resolve(here, '../..');
const coreDir = resolve(weaselRoot, 'packages/core');

/**
 * Core's every entry point, aliased to its built file.
 *
 * esbuild's `alias` substitutes by prefix, so mapping the bare specifier alone
 * sends `@weasel-js/core/patterns-builtin` to `.../dist/index.js/patterns-builtin`
 * and the build dies on a path that is not a directory. Reading the subpaths off
 * core's `exports` keeps this correct as entry points come and go, rather than
 * naming the one import that happened to reach here first.
 */
function coreAliases(): Record<string, string> {
  const { exports: map } = JSON.parse(
    readFileSync(resolve(coreDir, 'package.json'), 'utf8'),
  ) as { exports: Record<string, { import?: string } | string> };
  const out: Record<string, string> = {};
  for (const [sub, target] of Object.entries(map)) {
    const file = typeof target === 'string' ? target : target.import;
    if (!file?.endsWith('.js')) continue;
    const specifier = sub === '.' ? '@weasel-js/core' : `@weasel-js/core/${sub.slice(2)}`;
    out[specifier] = resolve(coreDir, file);
  }
  return out;
}

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'chrome/index': 'src/chrome/index.ts',
    'primitives/index': 'src/primitives/index.ts',
    'state/index': 'src/state/index.ts',
    'controls/index': 'src/controls/index.ts',
    'canvas/index': 'src/canvas/index.ts',
    'layers/index': 'src/layers/index.ts',
    'undo/index': 'src/undo/index.ts',
    'dragdrop/index': 'src/dragdrop/index.ts',
    'passthrough/weasel-ui': 'src/passthrough/weasel-ui.ts',
    'passthrough/weasel-canvas': 'src/passthrough/weasel-canvas.ts',
    'surface/index': 'src/surface/index.ts',
    'job/index': 'src/job/index.ts',
    'ui/layers/index': 'src/ui/layers/index.ts',
  },
  format: ['esm'],
  tsconfig: './tsconfig.lib.json',
  // tsup's built-in dts can't resolve the root-package core `@weasel-js/core`
  // (it follows node_modules symlinks but the monorepo core is the repo ROOT,
  // which has none) and ignores the tsconfig `paths` that tsc honors — so types
  // drifted to `never`. .d.ts emission is therefore handled by a dedicated
  // pipeline that resolves every weasel specifier to SOURCE via an alias plugin:
  // see scripts/build-dts.mts, wired as the `build:dts` step after this build.
  // The JS bundle here is fully self-contained (zero @weasel-js runtime imports).
  dts: false,
  sourcemap: true,
  clean: true,
  // react/react-dom are peers; the rest are third-party libs declared as labkit
  // dependencies. All @weasel-js/core* are bundled in (see noExternal) so the
  // published package is self-contained.
  external: ['react', 'react-dom', 'react-aria-components', 'earcut', 'polygon-clipping'],
  // Bundle the weasel core + private sub-packages into labkit's dist — none are
  // published to npm. The sub-packages (@weasel-js/ui, /modes, and their own
  // deps) resolve through their workspace symlinks; the core resolves to its
  // built, self-contained dist via the esbuild alias below (avoids re-bundling
  // weasel's bare core/ imports).
  noExternal: [/^@weasel-js\//],
  esbuildOptions(options) {
    options.alias = { ...(options.alias ?? {}), ...coreAliases() };
  },
  splitting: true,
  treeshake: true,
});
