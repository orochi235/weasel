import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../../..');

export default defineConfig({
  root: repoRoot,
  base: '/',
  resolve: {
    alias: [
      {
        find: /^@orochi235\/weasel\/(.*)$/,
        replacement: resolve(repoRoot, 'src/subpaths/$1.ts'),
      },
      {
        find: '@orochi235/weasel',
        replacement: resolve(repoRoot, 'src/index.ts'),
      },
    ],
  },
});
