import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { traitSchemasPlugin } from '../draw/vite-plugin-trait-schemas';
import { forge } from '../../packages/forge/src/vite/index';
import { weaselAliases } from '../../scripts/vite-aliases';
import { weaselDefines } from '../../scripts/vite-build-info';

const repoRoot = resolve(__dirname, '../..');

const stories = [
  'apps/forge/stories/**/*.stories.{ts,tsx}',
  'packages/ui/src/**/*.stories.{ts,tsx}',
  'apps/draw/src/**/*.stories.{ts,tsx}',
  'packages/labkit/src/**/*.stories.{ts,tsx}',
];

export default defineConfig(({ command, isPreview }) => ({
  root: repoRoot,
  base: command === 'build' || isPreview ? '/weasel/docs/ui/forge/' : '/',
  cacheDir: resolve(repoRoot, 'node_modules/.vite-forge'),
  resolve: {
    alias: weaselAliases(repoRoot, [
      {
        find: '@weasel-js/theme/tokens.css',
        replacement: resolve(repoRoot, 'packages/theme/src/generated/tokens.css'),
      },
      {
        find: '@weasel-js/labkit/styles.css',
        replacement: resolve(repoRoot, 'apps/forge/labkitStyles.ts'),
      },
      {
        find: '@weasel-js/forge/shell.css',
        replacement: resolve(repoRoot, 'packages/forge/src/shell/shell.css'),
      },
      {
        find: '@weasel-js/forge/frame.css',
        replacement: resolve(repoRoot, 'packages/forge/src/frame/frame.css'),
      },
    ]),
  },
  define: weaselDefines(repoRoot),
  // With the root at the repo root, vite's default scan reads every index.html in the repo and fails on other apps' virtual modules.
  optimizeDeps: {
    entries: [...stories, 'packages/forge/src/shell/index.ts', 'packages/forge/src/frame/index.ts', 'apps/forge/forge.config.tsx'],
  },
  plugins: [
    react(),
    traitSchemasPlugin({ repoRoot }),
    forge({ stories, config: 'apps/forge/forge.config.tsx' }),
  ],
  server: { port: 5178, host: '::' },
  build: { outDir: resolve(repoRoot, 'dist-forge'), emptyOutDir: true },
}));
