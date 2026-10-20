import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { weaselAliases } from '../../scripts/vite-aliases';

const repoRoot = resolve(__dirname, '../..');

// Budget scripts that build a live scene: `tsx` cannot load the core barrel,
// which imports CSS modules and touches `window` at load, so these run as one
// vitest test each in jsdom. Name the file to run, as `bench:hops` does; no
// `--project` selection or bare `vitest run` reads this config.
export default defineConfig({
  root: repoRoot,
  resolve: {
    alias: weaselAliases(repoRoot),
  },
  plugins: [react()],
  test: {
    name: 'scene-bench',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['packages/*/src/**/*.bench.ts'],
  },
});
