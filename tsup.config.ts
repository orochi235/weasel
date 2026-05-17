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
});
