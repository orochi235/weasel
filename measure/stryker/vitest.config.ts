import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { weaselAliases } from '../../scripts/vite-aliases.ts';

const pkg = process.env.MEASURE_PKG ?? 'geom';
const root = new URL('../..', import.meta.url).pathname;

export default defineConfig({
  root,
  resolve: { alias: weaselAliases(root) },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    pool: 'threads',
    globals: true,
    setupFiles: ['./vitest.setup.ts', './scripts/vitest-pbt-seed.setup.ts'],
    include: [`packages/${pkg}/**/*.test.{ts,tsx}`],
    exclude: ['**/*.build.test.ts', '**/*.browser.test.{ts,tsx}', '**/node_modules/**'],
  },
});
