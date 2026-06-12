import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { weaselAliases } from '../../scripts/vite-aliases';
import { callbackSourcePlugin } from './vite-plugin-callback-source';
import { traitSchemasPlugin } from './vite-plugin-trait-schemas';

const repoRoot = resolve(__dirname, '../..');

export default defineConfig({
  root: __dirname,
  base: '/weasel/draw/',
  // apps/draw has no node_modules of its own, so Vite's default cacheDir
  // resolves up to the repo root's `node_modules/.vite` — the SAME directory
  // the kit dev server uses. Two concurrent servers then clobber each
  // other's optimized-dep metadata and every page 504s with "Outdated
  // Optimize Dep". Pin a distinct cache.
  cacheDir: resolve(repoRoot, 'node_modules/.vite-draw'),
  // Serve the bundled Inter MSDF atlas so registerFont() in main.tsx can fetch
  // it. Atlas files live under repoRoot/assets/fonts/inter/.
  publicDir: resolve(repoRoot, 'assets/fonts'),
  resolve: {
    alias: weaselAliases(repoRoot, [
      // Specific overrides win — weasel-theme ships a `tokens.css` import the
      // generic wildcard would otherwise rewrite to a `.ts` lookup.
      {
        find: '@orochi235/weasel-theme/tokens.css',
        replacement: resolve(repoRoot, 'packages/weasel-theme/src/tokens.css'),
      },
    ]),
  },
  plugins: [
    react(),
    callbackSourcePlugin({
      includeDirs: [
        resolve(repoRoot, 'src/tools'),
        resolve(repoRoot, 'src/interactions/actions'),
        resolve(repoRoot, 'apps/draw/src'),
      ],
    }),
    traitSchemasPlugin({ repoRoot }),
  ],
  server: { port: 5174 },
  define: {
    __WEASEL_REPO_ROOT__: JSON.stringify(repoRoot),
  },
  build: {
    outDir: resolve(repoRoot, 'dist-draw'),
    emptyOutDir: true,
  },
});
