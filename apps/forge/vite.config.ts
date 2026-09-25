import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { traitSchemasPlugin } from '../draw/vite-plugin-trait-schemas';
import { forge } from '../../packages/forge/src/vite/index';
import { weaselDefines } from '../../scripts/vite-build-info';
import { localWake } from '../../scripts/vite-wake';
import { forgeAliases, frameConfig, shellConfig, stories } from './viteShared';
import ports from '../../scripts/dev-ports.json' with { type: 'json' };

const repoRoot = resolve(__dirname, '../..');

export default defineConfig(({ command, isPreview }) => ({
  root: repoRoot,
  base: command === 'build' || isPreview ? '/weasel/docs/ui/forge/' : '/',
  cacheDir: resolve(repoRoot, 'node_modules/.vite-forge'),
  resolve: { alias: forgeAliases(repoRoot) },
  define: weaselDefines(repoRoot),
  plugins: [
    react(),
    traitSchemasPlugin({ repoRoot }),
    forge({ stories, frameConfig, shellConfig }),
    localWake(),
  ],
  server: { port: ports.forge, strictPort: true, host: '::' },
  build: { outDir: resolve(repoRoot, 'dist-forge'), emptyOutDir: true },
}));
