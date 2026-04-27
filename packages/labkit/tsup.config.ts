import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'primitives/index': 'src/primitives/index.ts',
  },
  format: ['esm'],
  tsconfig: './tsconfig.lib.json',
  dts: { tsconfig: './tsconfig.lib.json' },
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
  splitting: false,
  treeshake: true,
});
