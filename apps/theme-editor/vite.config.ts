import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { weaselAliases } from '../../scripts/vite-aliases';
import { weaselDefines } from '../../scripts/vite-build-info';

const repoRoot = resolve(__dirname, '../..');

export default defineConfig({
  root: __dirname,
  base: '/weasel/theme-editor/',
  // This app has no node_modules of its own, so Vite's default cacheDir would
  // resolve to the repo root's — the same one the kit dev server uses. Two
  // servers then clobber each other's optimized-dep metadata and every page 504s.
  cacheDir: resolve(repoRoot, 'node_modules/.vite-theme-editor'),
  resolve: {
    alias: weaselAliases(repoRoot, [
      {
        find: '@weasel-js/theme/tokens.css',
        replacement: resolve(repoRoot, 'packages/theme/src/generated/tokens.css'),
      },
    ]),
  },
  plugins: [react()],
  server: { port: 5177, host: '::' },
  define: weaselDefines(repoRoot),
  build: { outDir: resolve(repoRoot, 'dist-theme-editor'), emptyOutDir: true },
});
