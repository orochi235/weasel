import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { forge } from '../../packages/forge/src/vite/index';
import { weaselAliases } from '../../scripts/vite-aliases';
import { weaselDefines } from '../../scripts/vite-build-info';

const repoRoot = resolve(__dirname, '../..');

export default defineConfig({
  root: repoRoot,
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
  plugins: [
    react(),
    forge({ stories: ['apps/forge/stories/**/*.stories.tsx'], config: 'apps/forge/forge.config.tsx' }),
  ],
  server: { port: 5178, host: '::' },
});
