import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { traitSchemasPlugin } from '../draw/vite-plugin-trait-schemas.ts';
import { forge } from '../../packages/forge/src/vite/index.ts';
import { weaselIcons } from '../../packages/icons-plugin/src/index.ts';
import { weaselDefines } from '../../scripts/vite-build-info.ts';
import { repoThemeStoreOptions } from '../../scripts/theme-store.ts';
import { themeStorePlugin } from '../../scripts/vite-theme-store.ts';
import { localWake } from '../../scripts/vite-wake.ts';
import { skipWorktrees } from '../../scripts/vite-watch.ts';
import { forgeAliases, frameConfig, frameStyles, shellConfig, stories } from './viteShared.ts';
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
    skipWorktrees(),
    traitSchemasPlugin({ repoRoot }),
    themeStorePlugin(repoThemeStoreOptions(repoRoot)),
    weaselIcons.vite({ mode: 'app' }),
    forge({
      stories,
      frameConfig,
      shellConfig,
      frameStyles,
      // react-aria's DOM-level props: ids, ARIA labeling, `dir`, `lang`, `hidden`, and the like.
      propControls: { skip: (file) => /@react-types[\\/]shared[\\/]src[\\/]dom\.d\.ts$/.test(file) },
    }),
    localWake(),
  ],
  server: { port: ports.forge, strictPort: true, host: '::' },
  build: { outDir: resolve(repoRoot, 'dist-forge'), emptyOutDir: true },
}));
