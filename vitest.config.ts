import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@orochi235\/weasel\/(.*)$/,
        replacement: resolve(__dirname, 'src/subpaths/$1.ts'),
      },
      {
        find: '@orochi235/weasel',
        replacement: resolve(__dirname, 'src/index.ts'),
      },
      // Bare top-level kit paths. Order matters: these must come AFTER
      // the @orochi235 aliases so the more-specific package paths win,
      // but BEFORE node_modules resolution (which the resolver applies
      // last by default).
      { find: /^core\/(.*)$/, replacement: resolve(__dirname, 'src/core/$1') },
      { find: /^features\/(.*)$/, replacement: resolve(__dirname, 'src/features/$1') },
      { find: /^affordances\/(.*)$/, replacement: resolve(__dirname, 'src/affordances/$1') },
      { find: /^interactions\/(.*)$/, replacement: resolve(__dirname, 'src/interactions/$1') },
      { find: /^tools\/(.*)$/, replacement: resolve(__dirname, 'src/tools/$1') },
      { find: /^canvas\/(.*)$/, replacement: resolve(__dirname, 'src/canvas/$1') },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}', 'demo/**/*.test.{ts,tsx}', 'packages/**/*.test.{ts,tsx}'],
  },
});
