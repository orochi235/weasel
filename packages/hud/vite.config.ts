/**
 * Library build for `@weasel-js/hud`.
 *
 * Vite rather than tsup because the default font is loaded through Vite's
 * `?url` asset imports (`./inter.json?url`, `./inter.png?url` in
 * src/fonts/registerDefaultFont.ts). esbuild — tsup's bundler — does not
 * understand the `?url` suffix at all, so it cannot build this package.
 *
 * Declarations come from `tsc --emitDeclarationOnly`; see tsconfig.build.json.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'react/index': resolve(__dirname, 'src/react/index.ts'),
      },
      formats: ['es'],
    },
    sourcemap: true,
    emptyOutDir: true,
    // Inline the font atlas + metrics as data URIs rather than emitting them as
    // sibling files. A published package cannot rely on the consumer's bundler
    // copying its assets or on any particular public-path setup, and
    // registerDefaultFont fetches these URLs at runtime.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', 'react-dom', /^@weasel-js\//],
    },
  },
});
