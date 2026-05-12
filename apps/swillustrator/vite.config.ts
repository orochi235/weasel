import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../..');

export default defineConfig({
  root: __dirname,
  base: '/weasel/swillustrator/',
  resolve: {
    alias: [
      {
        find: '@orochi235/weasel-theme/tokens.css',
        replacement: resolve(repoRoot, 'packages/weasel-theme/src/tokens.css'),
      },
      {
        find: '@orochi235/weasel-theme',
        replacement: resolve(repoRoot, 'packages/weasel-theme/src/index.ts'),
      },
      {
        find: /^@orochi235\/weasel\/(.*)$/,
        replacement: resolve(repoRoot, 'src/subpaths/$1.ts'),
      },
      {
        find: '@orochi235/weasel',
        replacement: resolve(repoRoot, 'src/index.ts'),
      },
      {
        find: /^@orochi235\/weasel-ui\/(.*)$/,
        replacement: resolve(repoRoot, 'packages/weasel-ui/src/$1'),
      },
      {
        find: '@orochi235/weasel-ui',
        replacement: resolve(repoRoot, 'packages/weasel-ui/src/index.ts'),
      },
      // Bare top-level kit paths — must match tsconfig + vitest.config + root vite.config.
      { find: /^core\/(.*)$/, replacement: resolve(repoRoot, 'src/core/$1') },
      { find: /^features\/(.*)$/, replacement: resolve(repoRoot, 'src/features/$1') },
      { find: /^affordances\/(.*)$/, replacement: resolve(repoRoot, 'src/affordances/$1') },
      { find: /^interactions\/(.*)$/, replacement: resolve(repoRoot, 'src/interactions/$1') },
      { find: /^tools\/(.*)$/, replacement: resolve(repoRoot, 'src/tools/$1') },
      { find: /^canvas\/(.*)$/, replacement: resolve(repoRoot, 'src/canvas/$1') },
    ],
  },
  plugins: [react()],
  server: { port: 5174 },
  build: {
    outDir: resolve(repoRoot, 'dist-swillustrator'),
    emptyOutDir: true,
  },
});
