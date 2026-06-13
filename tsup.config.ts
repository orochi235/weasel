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
  splitting: false,
  target: 'es2022',
  external: ['react', 'react-dom'],
  // The @orochi235/weasel-* workspace sub-packages (history, gestures, modes) are
  // NOT independently buildable — they reach into this package's src/core and
  // src/debug via shared tsconfig path aliases, not public API. tsup externalizes
  // everything in `dependencies` by default, which would emit bare
  // `import ... from '@orochi235/weasel-history'` specifiers pointing at raw,
  // un-built source. A downstream bundler with no baseUrl can't resolve those
  // (e.g. `core/ops/registry`), so consumers get resolve failures. Inline them
  // into dist instead; esbuild resolves their aliases here at build time.
  noExternal: [/^@orochi235\/weasel-/],
});
