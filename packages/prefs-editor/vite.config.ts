/**
 * Library build for `@weasel-js/prefs-editor`. Vite rather than tsup for the same reason as `@weasel-js/ui`: the
 * editor is styled with `*.module.css`, which esbuild cannot emit as one stable stylesheet. Declarations come from
 * `tsc -p tsconfig.build.json`.
 */
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { stableScopedName } from '../../scripts/vite-css-modules.ts';
import { weaselIcons } from '../icons-plugin/src/index.ts';
import { assertPackageBuild } from '../../scripts/lib/own-install.mjs';
import { installedExternal } from '../../scripts/lib/installed-external.mjs';

assertPackageBuild(import.meta.dirname);


export default defineConfig({
  plugins: [react(), weaselIcons.vite({ mode: 'library' })],
  css: { modules: { generateScopedName: stableScopedName } },
  build: {
    lib: {
      entry: { index: resolve(import.meta.dirname, 'src/index.ts') },
      formats: ['es'],
      cssFileName: 'style',
    },
    target: 'es2022',
    cssCodeSplit: false,
    // A consumer's bundler minifies. Either pass here would strip the `@icon` annotations.
    minify: false,
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      external: installedExternal(import.meta.dirname),
      output: { entryFileNames: '[name].js', minify: false },
    },
  },
});
