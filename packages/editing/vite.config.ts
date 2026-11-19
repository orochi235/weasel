/**
 * JavaScript build for `@weasel-js/editing`; declarations come from `tsup.config.ts`.
 *
 * `preserveModules` emits one file per source module, as core's build does, so a consumer's bundler drops the
 * presets and actions it never imports: a single chunk keeps every module-level `defineAction` alive.
 * `npm run check:treeshake` guards this.
 */
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { weaselIcons } from '../icons-plugin/src/index.ts';
import { assertPackageBuild } from '../../scripts/lib/own-install.mjs';
import { installedExternal } from '../../scripts/lib/installed-external.mjs';

assertPackageBuild(import.meta.dirname);

const external = installedExternal(import.meta.dirname);

export default defineConfig({
  plugins: [react(), weaselIcons.vite({ mode: 'library' })],
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        engine: resolve(import.meta.dirname, 'src/engine.ts'),
        presets: resolve(import.meta.dirname, 'src/presets.ts'),
        groups: resolve(import.meta.dirname, 'src/groups.ts'),
        'test-seams': resolve(import.meta.dirname, 'src/test-seams.ts'),
        'icons.table': resolve(import.meta.dirname, 'src/icons.table.ts'),
      },
      formats: ['es'],
    },
    target: 'es2022',
    minify: false,
    sourcemap: true,
    emptyOutDir: true,
    rolldownOptions: {
      external,
      optimization: { inlineConst: false },
      output: {
        minify: false,
        preserveModules: true,
        preserveModulesRoot: resolve(import.meta.dirname, 'src'),
        entryFileNames: '[name].js',
      },
    },
  },
});
