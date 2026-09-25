import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { traitSchemasPlugin } from '../draw/vite-plugin-trait-schemas.ts';
import { forge } from '../../packages/forge/src/vite/index.ts';
import { weaselDefines } from '../../scripts/vite-build-info.ts';
import { repoThemeStoreOptions } from '../../scripts/theme-store.ts';
import { themeStorePlugin } from '../../scripts/vite-theme-store.ts';
import { localWake } from '../../scripts/vite-wake.ts';
import { forgeAliases, frameConfig, shellConfig, stories } from './viteShared.ts';
import ports from '../../scripts/dev-ports.json' with { type: 'json' };

const repoRoot = resolve(import.meta.dirname, '../..');

export default defineConfig(({ command, isPreview }) => ({
  root: repoRoot,
  base: command === 'build' || isPreview ? '/weasel/docs/ui/forge/' : '/',
  cacheDir: resolve(repoRoot, 'node_modules/.vite-forge'),
  resolve: { alias: forgeAliases(repoRoot) },
  define: weaselDefines(repoRoot),
  plugins: [
    react(),
    traitSchemasPlugin({ repoRoot }),
    themeStorePlugin(repoThemeStoreOptions(repoRoot)),
    forge({ stories, frameConfig, shellConfig }),
    localWake(),
  ],
  server: { port: ports.forge, strictPort: true, host: '::' },
  build: { outDir: resolve(repoRoot, 'dist-forge'), emptyOutDir: true },
}));
