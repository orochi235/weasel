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
  // dependencies. @weasel-js/core and @weasel-js/theme are peers too — see
  // noExternal below.
  external: [
    'react',
    'react-dom',
    'react-aria-components',
    'earcut',
    'polygon-clipping',
    '@weasel-js/core',
    /^@weasel-js\/core\//,
    '@weasel-js/theme',
    /^@weasel-js\/theme\//,
  ],
  // Bundle labkit's weasel siblings into its dist — but never core or theme.
  //
  // Core owns module-global registries (content handlers, paint kinds, shape
  // painters, markers, programs). Inlining it ships a second set, and a consumer
  // holding labkit *and* core registers into one and reads the other: blank
  // canvas, no diagnostic beyond `layoutRuns`' warning. So core stays an
  // external specifier, resolved once at the consumer, and is declared an exact
  // peer to make npm say so at install time.
  // See docs/proposals/2026-08-31-singleton-packages-as-peers.md.
  //
  // Theme is the same shape for a different reason: it owns a React context and
  // the `wzl-themes` stylesheet's module-scoped handle. A second copy gives
  // `useThemeOptional` a context the app's own `ThemeProvider` never wrote to,
  // so it reads null and `<LabShell>` wraps a second provider over the app's
  // theme — and where `adoptedStyleSheets` is missing, both copies append their
  // own `<style id="wzl-themes">`.
  //
  // The lookahead has to cover subpaths as well as the bare specifier: the
  // bundled siblings import `@weasel-js/core/patterns-builtin` and labkit
  // imports `@weasel-js/theme/react`, and matching only the bare names would
  // inline those.
  noExternal: [/^@weasel-js\/(?!(?:core|theme)(?:$|\/))/],
  splitting: true,
  treeshake: true,
});
