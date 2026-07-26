/**
 * Library build for `@weasel-js/ui`.
 *
 * Vite rather than tsup because this package has 41 `*.module.css` files.
 * esbuild — tsup's bundler — handles CSS Modules only awkwardly: it has no
 * stable scoped-name contract and no way to emit one merged stylesheet
 * alongside a multi-entry JS build. Vite's CSS pipeline does both.
 *
 * Declarations come from `tsc --emitDeclarationOnly` (see the `build` script),
 * not a bundler plugin. That keeps the emitted types identical to what
 * `npm run typecheck` validates, and avoids taking on a dts plugin dependency
 * whose resolution rules differ from tsc's.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
      // Without this Vite derives the stylesheet name from the package name
      // ("ui.css"), which would not match the `./style.css` exports entry.
      cssFileName: 'style',
    },
    // One stylesheet for the whole package. With code splitting on, Vite emits
    // a stylesheet per chunk and consumers would have to know which to import.
    cssCodeSplit: false,
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      // Everything the consumer installs stays external. Bundling React or
      // react-aria-components in would give consumers a second copy of each —
      // fatal for React (hooks) and for RAC's context-based components.
      external: [
        'react',
        'react/jsx-runtime',
        'react-dom',
        'react-aria-components',
        /^@weasel-js\//,
      ],
    },
  },
});
