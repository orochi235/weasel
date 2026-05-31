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
  },
  format: ['esm'],
  tsconfig: './tsconfig.lib.json',
  dts: { tsconfig: './tsconfig.lib.json' },
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', '@orochi235/weasel-ui', '@orochi235/weasel-modes'],
  splitting: true,
  treeshake: true,
});
