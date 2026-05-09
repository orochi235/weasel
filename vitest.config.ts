import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@orochi235\/weasel-gl\/(.*)$/,
        replacement: resolve(__dirname, 'packages/weasel-gl/src/$1.ts'),
      },
      {
        find: '@orochi235/weasel-gl',
        replacement: resolve(__dirname, 'packages/weasel-gl/src/index.ts'),
      },
      {
        find: /^@orochi235\/weasel\/(.*)$/,
        replacement: resolve(__dirname, 'src/subpaths/$1.ts'),
      },
      {
        find: '@orochi235/weasel',
        replacement: resolve(__dirname, 'src/index.ts'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}', 'demo/**/*.test.{ts,tsx}', 'packages/**/*.test.{ts,tsx}'],
  },
});
