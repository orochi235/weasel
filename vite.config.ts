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
        find: '@orochi235/weasel-gl',
        replacement: resolve(__dirname, 'src/renderer/index.ts'),
      },
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
    ],
  },
  plugins: [react()],
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
  },
});
