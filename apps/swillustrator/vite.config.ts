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
    ],
  },
  plugins: [react()],
  server: { port: 5174 },
  build: {
    outDir: resolve(repoRoot, 'dist-swillustrator'),
    emptyOutDir: true,
  },
});
