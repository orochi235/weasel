import { defineConfig, type Plugin } from 'vite';
import { createReadStream, existsSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { weaselAliases } from '../../scripts/vite-aliases';
import { weaselDefines } from '../../scripts/vite-build-info';

const repoRoot = resolve(__dirname, '../..');

/**
 * Serve the theme's font files where labkit's stylesheet looks for them.
 *
 * `packages/labkit/src/theme/base.less` points at `./fonts/…`, which is right
 * for its published `dist/` (the build copies them in) and resolves to nothing
 * when the same file is compiled from source. Without this the request 404s,
 * the browser tries to parse the HTML error page as a font, and the lab renders
 * in a fallback face.
 */
function themeFonts(root: string): Plugin {
  return {
    name: 'weasel-theme-fonts',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = req.url?.match(/\/theme\/fonts\/([\w.-]+\.woff2)$/);
        if (!match) return next();
        const file = resolve(root, 'packages/theme/fonts', match[1]);
        if (!existsSync(file)) return next();
        res.setHeader('Content-Type', 'font/woff2');
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  base: '/weasel/theme-editor/',
  // This app has no node_modules of its own, so Vite's default cacheDir would
  // resolve to the repo root's — the same one the kit dev server uses. Two
  // servers then clobber each other's optimized-dep metadata and every page 504s.
  cacheDir: resolve(repoRoot, 'node_modules/.vite-theme-editor'),
  resolve: {
    alias: weaselAliases(repoRoot, [
      {
        find: '@weasel-js/theme/tokens.css',
        replacement: resolve(repoRoot, 'packages/theme/src/generated/tokens.css'),
      },
    ]),
  },
  plugins: [react(), themeFonts(repoRoot)],
  server: { port: 5177, host: '::' },
  define: weaselDefines(repoRoot),
  build: { outDir: resolve(repoRoot, 'dist-theme-editor'), emptyOutDir: true },
});
