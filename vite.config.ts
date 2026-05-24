import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, statSync, createReadStream } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { weaselAliases } from './scripts/vite-aliases';
import { demoTimestamps } from './scripts/vite-demo-timestamps';

/**
 * Dev-only middleware: serve `dist-demo/api/*` at `/api/*`. The deployed
 * site (GitHub Pages) gets the typedoc output bundled into `dist-demo/`
 * via `npm run build:demo`, so the sidebar's "API reference →" link
 * (`./api/`) resolves correctly there. Vite's dev server doesn't serve
 * `dist-demo`, so without this plugin the same link 404s locally.
 *
 * Run `npm run build:api` once to generate `dist-demo/api/`. The
 * middleware reports a helpful message when the directory is missing
 * instead of falling through to vite's generic 404.
 */
function serveApiDocsInDev(): PluginOption {
  const apiRoot = resolve(__dirname, 'dist-demo/api');
  const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return {
    name: 'serve-api-docs-in-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', (req, res, next) => {
        if (!existsSync(apiRoot)) {
          res.statusCode = 404;
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.end(
            '<!doctype html><title>API docs not built</title>'
            + '<body style="font-family:system-ui;padding:2rem;max-width:32rem">'
            + '<h1>API docs not built</h1>'
            + '<p>Run <code>npm run build:api</code> once to generate the typedoc '
            + 'output into <code>dist-demo/api/</code>. The dev server will pick '
            + 'it up on the next request — no restart needed.</p>'
            + '</body>',
          );
          return;
        }
        const cleanPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
        let filePath = join(apiRoot, cleanPath === '/' ? 'index.html' : cleanPath);
        try {
          if (statSync(filePath).isDirectory()) filePath = join(filePath, 'index.html');
        } catch {
          next();
          return;
        }
        if (!existsSync(filePath)) { next(); return; }
        res.setHeader('content-type', MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream');
        createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig({
  root: 'demo',
  base: '/weasel/',
  publicDir: resolve(__dirname, 'assets/fonts'),
  resolve: {
    alias: weaselAliases(__dirname, [
      {
        find: '@orochi235/weasel-theme/tokens.css',
        replacement: resolve(__dirname, 'packages/weasel-theme/src/tokens.css'),
      },
    ]),
  },
  plugins: [react(), serveApiDocsInDev(), demoTimestamps({ root: __dirname })],
  // Pre-bundle demo-only deps at server start so they don't trigger lazy
  // re-optimization on first import — that race produces 504 "Outdated
  // Optimize Dep" responses on slow ESM packages with many internal modules.
  // d3-force is the main offender (forceMany/Link/Collide/Center pull in
  // d3-quadtree, d3-dispatch, etc.); listing the root entry forces vite to
  // walk the tree once at startup.
  optimizeDeps: {
    include: ['d3-force'],
  },
  // Proxy `/weasel/draw/*` to the WeaselDraw dev server (`npm run dev:draw`,
  // port 5174) so a single localhost:5173 origin mirrors the production Pages
  // layout where WeaselDraw is copied into `dist-demo/draw/`. Both servers
  // need to be running for this to work; WeaselDraw's `base: '/weasel/draw/'`
  // means we forward the path through unchanged. WebSocket forwarding is enabled
  // so HMR + Vite's dev-server live-reload also work end-to-end via the proxy.
  server: {
    proxy: {
      '/weasel/draw': {
        target: 'http://localhost:5174',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
  },
});
