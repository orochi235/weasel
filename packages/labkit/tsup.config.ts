import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'chrome/index': 'src/chrome/index.ts',
    'primitives/index': 'src/primitives/index.ts',
    'state/index': 'src/state/index.ts',
    'controls/index': 'src/controls/index.ts',
    'config/index': 'src/config/index.ts',
    'canvas/index': 'src/canvas/index.ts',
    'layers/index': 'src/layers/index.ts',
    'loupe/index': 'src/loupe/index.ts',
    'undo/index': 'src/undo/index.ts',
    'dragdrop/index': 'src/dragdrop/index.ts',
    'passthrough/weasel-ui': 'src/passthrough/weasel-ui.ts',
    'passthrough/weasel-canvas': 'src/passthrough/weasel-canvas.ts',
    'surface/index': 'src/surface/index.ts',
    'job/index': 'src/job/index.ts',
    'overview/index': 'src/overview/index.ts',
  },
  format: ['esm'],
  tsconfig: './tsconfig.lib.json',
  // .d.ts emission is handled by a dedicated pipeline: see
  // scripts/build-dts.mts, wired as the `build:dts` step after this build.
  // Like the JS here, it imports the weasel siblings rather than copying them.
  dts: false,
  sourcemap: true,
  clean: true,
  // Nothing labkit depends on is inlined: every import of another package stays a
  // specifier the consumer's install resolves, so each weasel sibling runs as one
  // copy. Several own state with identity (core's registries, theme's context,
  // quantity's display kinds, ui's providers, registry's MIXED), and a copy inlined
  // here reads what the app's copy never wrote, with no error. In the repo aliases
  // resolve both to one source, so only scripts/smoke-consumer-bundle.mjs sees it.
  external: [
    'react',
    'react-dom',
    'react-aria-components',
    'earcut',
    'polygon-clipping',
    /^@weasel-js\//,
  ],
  splitting: true,
  treeshake: true,
});
