import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    move: 'src/import-shims/move.ts',
    resize: 'src/import-shims/resize.ts',
    insert: 'src/import-shims/insert.ts',
    clipboard: 'src/import-shims/clipboard.ts',
    clone: 'src/import-shims/clone.ts',
    'patterns-builtin': 'src/import-shims/patterns-builtin.ts',
    renderer: 'src/import-shims/renderer.ts',
    routing: 'src/tools/routing/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  // splitting:true collapses modules shared across entry points (e.g. the
  // text font-registry Map in features/text/atlas/registerFont.ts) into ONE
  // shared chunk, so `dist/index.js` (Canvas/WeaselRenderer) and
  // `dist/renderer.js` (registerFont) reference the SAME registry instance.
  // With splitting:false each entry inlined its own copy → registerFont (only
  // exported from /renderer) populated a different Map than the renderer read,
  // silently dropping every glyph. See eric font-rendering fix 2026-06-14.
  splitting: true,
  target: 'es2022',
  external: ['react', 'react-dom'],
  // The @weasel-js/* workspace sub-packages (history, gestures, modes) are
  // NOT independently buildable — they reach into this package's src/core and
  // src/debug via shared tsconfig path aliases, not public API. They must be
  // inlined into dist (both JS and .d.ts), never emitted as bare
  // `import ... from '@weasel-js/history'` specifiers pointing at raw,
  // un-built source — a downstream bundler with no baseUrl can't resolve those
  // (e.g. `core/ops/registry`), so consumers get TS2307s and an empty DepSchema.
  // Two things make that happen, and BOTH are required:
  //   1. These packages are NOT in `dependencies` (see package.json) — tsup
  //      builds its .d.ts `external` list from deps+peerDeps, so listing them
  //      there would force the declaration bundler to externalize them no
  //      matter what. They're devDependencies (bundled, not installed by
  //      consumers).
  //   2. tsconfig `paths` alias them to `packages/*/src` (like @weasel-js/ui),
  //      so both esbuild and rollup-plugin-dts resolve them as program-internal
  //      source and inline their declarations alongside core/*.
  // `noExternal` covers the JS bundle explicitly; the .d.ts side relies on (1)+(2).
  noExternal: [/^@weasel-js\//],
});
