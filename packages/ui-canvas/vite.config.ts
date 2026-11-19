/**
 * Library build for `@weasel-js/ui-canvas`.
 *
 * Vite rather than tsup because of this package's `*.module.css` files:
 * esbuild — tsup's bundler — has no stable scoped-name contract and no way to
 * emit one merged stylesheet alongside a multi-entry JS build.
 *
 * Declarations come from `tsc --emitDeclarationOnly` (see the `build` script),
 * not a bundler plugin. That keeps the emitted types identical to what
 * `npm run typecheck` validates.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { stableScopedName } from '../../scripts/vite-css-modules.ts';
import { componentEntries } from '../../scripts/vite-component-entries.ts';
import { weaselIcons } from '../icons-plugin/src/index.ts';
import { assertPackageBuild } from '../../scripts/lib/own-install.mjs';
import { installedExternal } from '../../scripts/lib/installed-external.mjs';

assertPackageBuild(import.meta.dirname);

/** The barrel and the package's other subpath entries, then one per component (see `componentEntries`). */
const entries: Record<string, string> = {
  index: resolve(import.meta.dirname, 'src/index.ts'),
  kitIcons: resolve(import.meta.dirname, 'src/kitIcons.ts'),
  ...componentEntries(import.meta.dirname),
};

export default defineConfig({
  plugins: [react(), weaselIcons.vite({ mode: 'library' })],
  css: { modules: { generateScopedName: stableScopedName } },
  build: {
    lib: {
      entry: entries,
      formats: ['es'],
      // Without this Vite derives the stylesheet name from the package name
      // ("ui-canvas.css"), which would not match the `./style.css` exports entry.
      cssFileName: 'style',
    },
    // One stylesheet for the whole package. With code splitting on, Vite emits
    // a stylesheet per chunk and consumers would have to know which to import.
    cssCodeSplit: false,
    // A consumer's bundler minifies. Either pass here would strip the `@icon` annotations.
    minify: false,
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      external: installedExternal(import.meta.dirname),
      output: {
        minify: false,
        // Entry keys already carry the path (`components/Toast/index`), so emit
        // them verbatim to mirror the source tree — and the declaration tree.
        entryFileNames: '[name].js',
        // Code shared between entries is hoisted here rather than duplicated
        // into each, so importing the barrel and a subpath yields one copy.
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
});
