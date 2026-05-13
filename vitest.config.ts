import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { weaselAliases } from './scripts/vite-aliases';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: weaselAliases(__dirname, [
      {
        find: '@orochi235/weasel-theme/tokens.css',
        replacement: resolve(__dirname, 'packages/weasel-theme/src/tokens.css'),
      },
    ]),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'demo/**/*.test.{ts,tsx}', 'packages/**/*.test.{ts,tsx}', 'apps/**/*.test.{ts,tsx}'],
  },
});
