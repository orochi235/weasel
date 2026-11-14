/**
 * Library build for `@weasel-js/prefs-editor`. Vite rather than tsup for the same reason as `@weasel-js/ui`: the
 * editor is styled with `*.module.css`, which esbuild cannot emit as one stable stylesheet. Declarations come from
 * `tsc -p tsconfig.build.json`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { stableScopedName } from '../../scripts/vite-css-modules.ts';
import { weaselIcons } from '../icons-plugin/src/index.ts';
import { assertPackageBuild } from '../../scripts/lib/own-install.mjs';

assertPackageBuild(import.meta.dirname);

const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
const installed = [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {})];

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
      // Everything the consumer installs stays external, deep imports included: a bundled copy splits a context from
      // its readers. `npm run check:bundled-deps` fails a build that inlines one.
      external: (id) => installed.some((name) => id === name || id.startsWith(`${name}/`)),
      output: { entryFileNames: '[name].js', minify: false },
    },
  },
});
