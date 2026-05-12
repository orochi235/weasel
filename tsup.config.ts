import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    move: 'src/subpaths/move.ts',
    resize: 'src/subpaths/resize.ts',
    insert: 'src/subpaths/insert.ts',
    clipboard: 'src/subpaths/clipboard.ts',
    clone: 'src/subpaths/clone.ts',
    'patterns-builtin': 'src/subpaths/patterns-builtin.ts',
    renderer: 'src/subpaths/renderer.ts',
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
