import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { weaselAliases } from '../../scripts/vite-aliases.ts';
import { weaselDefines } from '../../scripts/vite-build-info.ts';
import { localWake } from '../../scripts/vite-wake.ts';
import { devWatch } from '../../scripts/vite-watch.ts';
import { devSourcemaps } from '../../scripts/vite-sourcemaps.ts';
import { prebundleWorkspace } from '../../scripts/vite-prebundle.ts';
import { weaselIcons } from '../../packages/icons-plugin/src/index.ts';
import ports from '../../scripts/dev-ports.json' with { type: 'json' };
import { LAN_SERVER } from '../../scripts/vite-lan.ts';
import { assertOwnInstall } from '../../scripts/lib/own-install.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
assertOwnInstall(repoRoot);

export default defineConfig({
  root: import.meta.dirname,
  base: '/weasel/ui-lab/',
  // A distinct cache: servers sharing node_modules/.vite clobber each other's optimized-dep metadata.
  cacheDir: resolve(repoRoot, 'node_modules/.vite-ui-lab'),
  resolve: {
    alias: weaselAliases(repoRoot),
  },
  plugins: [
    react(),
    devWatch(),
    devSourcemaps(),
    prebundleWorkspace(repoRoot, [resolve(import.meta.dirname, 'src'), resolve(repoRoot, 'apps/shared')]),
    weaselIcons.vite({ mode: 'app' }),
    localWake(),
  ],
  server: { port: ports.uiLab, strictPort: true, ...LAN_SERVER },
  define: weaselDefines(repoRoot),
  build: { outDir: resolve(repoRoot, 'dist-ui-lab'), emptyOutDir: true },
});
