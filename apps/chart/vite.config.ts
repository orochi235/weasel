import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { weaselAliases } from '../../scripts/vite-aliases.ts';
import { weaselDefines } from '../../scripts/vite-build-info.ts';
import { localWake } from '../../scripts/vite-wake.ts';
import { skipWorktrees } from '../../scripts/vite-watch.ts';
import { devSourcemaps } from '../../scripts/vite-sourcemaps.ts';
import { prebundleWorkspace } from '../../scripts/vite-prebundle.ts';
import { weaselIcons } from '../../packages/icons-plugin/src/index.ts';
import ports from '../../scripts/dev-ports.json' with { type: 'json' };

const repoRoot = resolve(import.meta.dirname, '../..');

export default defineConfig({
  root: import.meta.dirname,
  base: '/weasel/chart/',
  // A distinct cache: servers sharing node_modules/.vite clobber each other's optimized-dep metadata.
  cacheDir: resolve(repoRoot, 'node_modules/.vite-chart'),
  publicDir: resolve(repoRoot, 'assets/fonts'),
  resolve: {
    alias: weaselAliases(repoRoot),
  },
  plugins: [
    react(),
    skipWorktrees(),
    devSourcemaps(),
    prebundleWorkspace(repoRoot, [resolve(import.meta.dirname, 'src'), resolve(repoRoot, 'apps/shared')]),
    weaselIcons.vite({ mode: 'app' }),
    localWake(),
  ],
  server: { port: ports.chart, strictPort: true, host: '::' },
  define: weaselDefines(repoRoot),
  build: {
    outDir: resolve(repoRoot, 'dist-chart'),
    emptyOutDir: true,
  },
});
