import { defineConfig } from 'tsup';
import { entries } from './entries.ts';

// Declarations only; the JavaScript comes from `vite.config.ts`, which runs
// first and empties `dist/`. tsup's JS output is shared chunks, and a chunk
// holding every module cannot be tree-shaken by a consumer.
export default defineConfig({
  entry: entries,
  format: ['esm'],
  dts: { only: true },
  target: 'es2022',
  external: ['react', 'react-dom'],
});
