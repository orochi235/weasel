import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { weaselAliases } from '../../scripts/vite-aliases.ts';
import { cssCacheKey } from '../../scripts/vitest-css-cache-key.ts';

const pkg = process.env.MEASURE_PKG ?? 'geom';
const root = new URL('../..', import.meta.url).pathname;

export default defineConfig({
  root,
  resolve: { alias: weaselAliases(root) },
  plugins: [react(), cssCacheKey()],
  test: {
    environment: process.env.MEASURE_ENV ?? 'node',
    pool: 'threads',
    globals: true,
    testTimeout: 60_000,
    setupFiles: ['./vitest.setup.ts', './scripts/vitest-pbt-seed.setup.ts'],
    include: [`packages/${pkg}/**/*.test.{ts,tsx}`],
    exclude: ['**/*.build.test.ts', '**/*.smoke.test.{ts,tsx}', '**/*.browser.test.{ts,tsx}', '**/node_modules/**'],
  },
});
