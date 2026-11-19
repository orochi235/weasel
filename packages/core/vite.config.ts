/**
 * JavaScript build for `@weasel-js/core`; declarations come from `tsup.config.ts`.
 *
 * `preserveModules` emits one file per source module, so a consumer's bundler
 * can drop whole modules under package.json's `sideEffects`. A chunked build
 * hands it one file holding every module, where a single top-level
 * registration call keeps all of it alive: importing `asNodeId` shipped
 * ~620 kB. `npm run check:treeshake` guards this.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { entries } from './entries.ts';
import { weaselIcons } from '../icons-plugin/src/index.ts';
import { stableScopedName } from '../../scripts/vite-css-modules.ts';
import { assertPackageBuild } from '../../scripts/lib/own-install.mjs';
import { installedExternal } from '../../scripts/lib/installed-external.mjs';

assertPackageBuild(import.meta.dirname);

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as { version: string };
const external = installedExternal(import.meta.dirname);

export default defineConfig({
  plugins: [react(), weaselIcons.vite({ mode: 'library' })],
  // In-repo builds that resolve core's source get the same define from
  // `scripts/vite-build-info.ts`.
  define: { __WEASEL_CORE_VERSION__: JSON.stringify(pkg.version) },
  resolve: { tsconfigPaths: true },
  css: { modules: { generateScopedName: stableScopedName } },
  build: {
    lib: {
      entry: Object.fromEntries(
        Object.entries(entries).map(([name, path]) => [name, resolve(import.meta.dirname, path)]),
      ),
      formats: ['es'],
      cssFileName: 'style',
    },
    target: 'es2022',
    // A consumer's bundler minifies. Either pass here would strip the `@icon` annotations.
    minify: false,
    cssCodeSplit: false,
    sourcemap: true,
    emptyOutDir: true,
    rolldownOptions: {
      external,
      // A constant inlined across modules leaves only a bare `import './x.js'`
      // behind, which `"sideEffects"` lets a consumer drop — taking any
      // registration in that module with it (composite.ts registers a shader program).
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
