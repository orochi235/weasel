import { defineConfig } from 'tsup';

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
  // resolve inlines the weasel packages' types into labkit's .d.ts; without it
  // the declarations re-export `from '@orochi235/weasel*'`, which consumers
  // can't resolve since those packages aren't published.
  dts: { tsconfig: './tsconfig.lib.json', resolve: [/^@orochi235\//] },
  sourcemap: true,
  clean: true,
  // react/react-dom are peers; the rest are third-party libs pulled in by the
  // inlined weasel code — kept external and declared as labkit dependencies so
  // they aren't duplicated into the bundle.
  external: ['react', 'react-dom', 'react-aria-components', 'earcut', 'polygon-clipping'],
  // Inline the weasel packages into labkit's dist so the published package is
  // self-contained — none of @orochi235/weasel* are published to npm.
  noExternal: [/^@orochi235\//],
  // The weasel packages are symlinked (file: deps) and ship raw TS source that
  // bare-imports sibling @orochi235 packages. Resolve those from labkit's own
  // node_modules instead of following symlinks into the weasel tree.
  esbuildOptions(options) {
    options.preserveSymlinks = true;
  },
  splitting: true,
  treeshake: true,
});
