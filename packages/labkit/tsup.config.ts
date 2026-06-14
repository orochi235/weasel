import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const here = dirname(fileURLToPath(import.meta.url));
const weaselRoot = resolve(here, '../..');

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'primitives/index': 'src/primitives/index.ts',
    'state/index': 'src/state/index.ts',
    'controls/index': 'src/controls/index.ts',
    'canvas/index': 'src/canvas/index.ts',
    'layers/index': 'src/layers/index.ts',
    'undo/index': 'src/undo/index.ts',
    'dragdrop/index': 'src/dragdrop/index.ts',
    'passthrough/weasel-ui': 'src/passthrough/weasel-ui.ts',
    'passthrough/weasel-canvas': 'src/passthrough/weasel-canvas.ts',
    'ui/layers/index': 'src/ui/layers/index.ts',
  },
  format: ['esm'],
  tsconfig: './tsconfig.lib.json',
  // FOLLOW-UP (publish blocker): .d.ts emission is disabled. tsup's dts bundler
  // (rollup-plugin-dts) can't resolve the root-package core `@orochi235/weasel`
  // — it resolves workspace members via their node_modules symlinks, but the
  // monorepo's main package is the repo ROOT, which has no symlink, and rollup-
  // dts ignores the tsconfig `paths` that tsc itself honors (verified: `tsc -p
  // tsconfig.dts.json` resolves it cleanly). Fixing this needs a dts pipeline
  // that honors paths — API Extractor, or real built dist types for
  // weasel-ui/modes. tsconfig.dts.json is staged for that work. The JS bundle is
  // already fully self-contained (zero @orochi235 runtime imports).
  dts: false,
  sourcemap: true,
  clean: true,
  // react/react-dom are peers; the rest are third-party libs declared as labkit
  // dependencies. All @orochi235/weasel* are bundled in (see noExternal) so the
  // published package is self-contained.
  external: [
    'react',
    'react-dom',
    'react-aria-components',
    'earcut',
    'polygon-clipping',
  ],
  // Bundle the weasel core + private sub-packages into labkit's dist — none are
  // published to npm. weasel-ui / weasel-modes resolve from their workspace src
  // (node_modules symlinks); the core resolves to its built, self-contained dist
  // via the esbuild alias below (avoids re-bundling weasel's bare core/ imports).
  noExternal: [/^@orochi235\//],
  esbuildOptions(options) {
    options.alias = {
      ...(options.alias ?? {}),
      '@orochi235/weasel': resolve(weaselRoot, 'dist/index.js'),
    };
  },
  splitting: true,
  treeshake: true,
});
