import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { traitSchemasPlugin } from '../draw/vite-plugin-trait-schemas';
import { forge } from '../../packages/forge/src/vite/index';
import { weaselDefines } from '../../scripts/vite-build-info';
import { forgeAliases, forgeConfig, stories } from './viteShared';

const repoRoot = resolve(__dirname, '../..');

export default defineConfig(({ command, isPreview }) => ({
  root: repoRoot,
  base: command === 'build' || isPreview ? '/weasel/docs/ui/forge/' : '/',
  cacheDir: resolve(repoRoot, 'node_modules/.vite-forge'),
  resolve: { alias: forgeAliases(repoRoot) },
  define: weaselDefines(repoRoot),
  // With the root at the repo root, vite's default scan reads every index.html in the repo and fails on other apps' virtual modules.
  optimizeDeps: {
    entries: [...stories, 'packages/forge/src/shell/index.ts', 'packages/forge/src/frame/index.ts', forgeConfig],
  },
  plugins: [
    react(),
    traitSchemasPlugin({ repoRoot }),
    forge({ stories, config: forgeConfig }),
  ],
  server: { port: 5178, host: '::' },
  build: { outDir: resolve(repoRoot, 'dist-forge'), emptyOutDir: true },
}));
