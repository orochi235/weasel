import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { weaselAliases } from '../../scripts/vite-aliases.ts';
import { weaselDefines } from '../../scripts/vite-build-info.ts';
import { localWake } from '../../scripts/vite-wake.ts';
import { skipWorktrees } from '../../scripts/vite-watch.ts';
import { devSourcemaps } from '../../scripts/vite-sourcemaps.ts';
import { prebundleWorkspace } from '../../scripts/vite-prebundle.ts';
import { repoThemeStoreOptions } from '../../scripts/theme-store.ts';
import { themeStorePlugin } from '../../scripts/vite-theme-store.ts';
import { watchProbe } from '../../packages/forge/src/vite/watchProbe.ts';
import { weaselIcons } from '../../packages/icons-plugin/src/index.ts';
import ports from '../../scripts/dev-ports.json' with { type: 'json' };

const repoRoot = resolve(import.meta.dirname, '../..');

export default defineConfig({
  root: import.meta.dirname,
  base: '/weasel/theme-editor/',
  // This app has no node_modules of its own, so Vite's default cacheDir would
  // resolve to the repo root's — the same one the kit dev server uses. Two
  // servers then clobber each other's optimized-dep metadata and every page 504s.
  cacheDir: resolve(repoRoot, 'node_modules/.vite-theme-editor'),
  resolve: {
    alias: weaselAliases(repoRoot),
  },
  plugins: [
    react(),
    skipWorktrees(),
    devSourcemaps(),
    prebundleWorkspace(repoRoot, [resolve(import.meta.dirname, 'src'), resolve(repoRoot, 'apps/shared')]),
    themeStorePlugin(repoThemeStoreOptions(repoRoot)),
    weaselIcons.vite({ mode: 'app' }),
    localWake(),
    watchProbe(),
  ],
  server: { port: ports.themeEditor, strictPort: true, host: '::' },
  define: weaselDefines(repoRoot),
  build: { outDir: resolve(repoRoot, 'dist-theme-editor'), emptyOutDir: true },
});
