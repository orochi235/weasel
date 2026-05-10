import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'demo',
  base: '/weasel/',
  publicDir: resolve(__dirname, 'assets/fonts'),
  resolve: {
    alias: [
      {
        find: '@orochi235/weasel-ui/tokens.css',
        replacement: resolve(__dirname, 'packages/weasel-ui/src/tokens.css'),
      },
      {
        find: '@orochi235/weasel-ui',
        replacement: resolve(__dirname, 'packages/weasel-ui/src/index.ts'),
      },
      {
        find: /^@orochi235\/weasel\/(.*)$/,
        replacement: resolve(__dirname, 'src/subpaths/$1.ts'),
      },
      {
        find: '@orochi235/weasel',
        replacement: resolve(__dirname, 'src/index.ts'),
      },
      // Bare top-level kit paths — must match tsconfig + vitest.config.
      { find: /^core\/(.*)$/, replacement: resolve(__dirname, 'src/core/$1') },
      { find: /^features\/(.*)$/, replacement: resolve(__dirname, 'src/features/$1') },
      { find: /^affordances\/(.*)$/, replacement: resolve(__dirname, 'src/affordances/$1') },
      { find: /^interactions\/(.*)$/, replacement: resolve(__dirname, 'src/interactions/$1') },
      { find: /^tools\/(.*)$/, replacement: resolve(__dirname, 'src/tools/$1') },
      { find: /^canvas\/(.*)$/, replacement: resolve(__dirname, 'src/canvas/$1') },
    ],
  },
  plugins: [react()],
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
  },
});
