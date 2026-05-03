import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    move: 'src/entries/move.ts',
    resize: 'src/entries/resize.ts',
    insert: 'src/entries/insert.ts',
    'area-select': 'src/entries/area-select.ts',
    clipboard: 'src/entries/clipboard.ts',
    clone: 'src/entries/clone.ts',
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
