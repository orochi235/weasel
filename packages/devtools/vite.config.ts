/**
 * Library build for `@weasel-js/devtools`. Vite rather than tsup for the same
 * reason as `@weasel-js/ui`: the views are styled with `*.module.css`, which
 * esbuild cannot emit as one stable stylesheet. Declarations come from
 * `tsc -p tsconfig.build.json`.
 */
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { stableScopedName } from '../../scripts/vite-css-modules.ts';

export default defineConfig({
  plugins: [react()],
  css: { modules: { generateScopedName: stableScopedName } },
  build: {
    lib: {
      entry: { index: resolve(import.meta.dirname, 'src/index.ts') },
      formats: ['es'],
      cssFileName: 'style',
    },
    target: 'es2022',
    cssCodeSplit: false,
    minify: false,
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', 'react-dom', /^@weasel-js\//],
      output: { entryFileNames: '[name].js' },
    },
  },
});
