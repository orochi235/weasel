import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    move: 'src/move.ts',
    resize: 'src/resize.ts',
    insert: 'src/insert.ts',
    'area-select': 'src/area-select.ts',
    clipboard: 'src/clipboard.ts',
    clone: 'src/clone.ts',
    'patterns-builtin': 'src/patterns-builtin.ts',
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
