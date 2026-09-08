import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
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
  },
  format: ['esm'],
  tsconfig: './tsconfig.lib.json',
  // tsup's built-in dts can't resolve the root-package core `@weasel-js/core`
  // (it follows node_modules symlinks but the monorepo core is the repo ROOT,
  // which has none) and ignores the tsconfig `paths` that tsc honors — so types
  // drifted to `never`. .d.ts emission is therefore handled by a dedicated
  // pipeline: see scripts/build-dts.mts, wired as the `build:dts` step after
  // this build. It externalizes core and inlines the rest, matching the JS here.
  dts: false,
  sourcemap: true,
  clean: true,
  // react/react-dom are peers; the rest are third-party libs declared as labkit
  // dependencies. @weasel-js/core is a peer too — see noExternal below.
  external: [
    'react',
    'react-dom',
    'react-aria-components',
    'earcut',
    'polygon-clipping',
    '@weasel-js/core',
    /^@weasel-js\/core\//,
  ],
  // Bundle labkit's weasel siblings into its dist — but never the core.
  //
  // Core owns module-global registries (content handlers, paint kinds, shape
  // painters, markers, programs). Inlining it ships a second set, and a consumer
  // holding labkit *and* core registers into one and reads the other: blank
  // canvas, no diagnostic beyond `layoutRuns`' warning. So core stays an
  // external specifier, resolved once at the consumer, and is declared an exact
  // peer to make npm say so at install time.
  // See docs/proposals/2026-08-31-singleton-packages-as-peers.md.
  //
  // The lookahead has to cover subpaths as well as the bare specifier: the
  // bundled siblings import `@weasel-js/core/patterns-builtin`, and matching
  // only `@weasel-js/core` would inline that one.
  noExternal: [/^@weasel-js\/(?!core(?:$|\/))/],
  splitting: true,
  treeshake: true,
});
