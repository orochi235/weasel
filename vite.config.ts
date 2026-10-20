import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, statSync, createReadStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { weaselAliases } from './scripts/vite-aliases.ts';
import { weaselDefines } from './scripts/vite-build-info.ts';
import { demoTimestamps } from './scripts/vite-demo-timestamps.ts';
import { demoSources } from './scripts/vite-demo-sources.ts';
import { changelogs } from './scripts/vite-changelogs.ts';
import { getStarted } from './scripts/vite-get-started.ts';
import { packageDocs } from './scripts/vite-package-docs.ts';
import { localWake } from './scripts/vite-wake.ts';
import { skipWorktrees } from './scripts/vite-watch.ts';
import { devSourcemaps } from './scripts/vite-sourcemaps.ts';
import { watchProbe } from './packages/forge/src/vite/watchProbe.ts';
import { weaselIcons } from './packages/icons-plugin/src/index.ts';
import ports from './scripts/dev-ports.json' with { type: 'json' };
import { LAN_SERVER } from './scripts/vite-lan.ts';

/**
 * Dev-only middleware: serve the per-package reference `npm run build:api`
 * writes into `dist-demo/reference/` at `/weasel/reference/*`, where the
 * deployed site (GitHub Pages) has it and the package pages fetch it. Vite's
 * dev server doesn't serve `dist-demo`, so without this it 404s locally. A
 * fetch before the build has run gets a 404 it can read, not vite's fallback
 * to the app's own HTML.
 */
function serveReferenceInDev(): PluginOption {
  const referenceRoot = resolve(import.meta.dirname, 'dist-demo/reference');
  return {
    name: 'serve-reference-in-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/weasel/reference', (req, res) => {
        const file = join(referenceRoot, decodeURIComponent((req.url ?? '/').split('?')[0]));
        if (!file.startsWith(referenceRoot) || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          res.end('not built: npm run build:api');
          return;
        }
        res.setHeader('content-type', 'application/json; charset=utf-8');
        // A rebuild replaces these in place; without this the browser keeps showing the last build.
        res.setHeader('cache-control', 'no-cache');
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  root: 'apps/site',
  base: '/weasel/',
  publicDir: resolve(import.meta.dirname, 'assets/fonts'),
  resolve: {
    alias: weaselAliases(import.meta.dirname),
  },
  plugins: [
    react(),
    skipWorktrees(),
    devSourcemaps(),
    serveReferenceInDev(),
    demoTimestamps({ root: import.meta.dirname }),
    demoSources({ root: import.meta.dirname }),
    changelogs({ root: import.meta.dirname }),
    getStarted({ root: import.meta.dirname }),
    packageDocs({ root: import.meta.dirname }),
    weaselIcons.vite({ mode: 'app' }),
    localWake({ fallback: [ports.siteBackup] }),
    watchProbe(),
  ],
  define: weaselDefines(import.meta.dirname),
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
  // `ports.draw`) so a single site origin mirrors the production Pages
  // layout where WeaselDraw is copied into `dist-demo/draw/`. Both servers
  // need to be running for this to work; WeaselDraw's `base: '/weasel/draw/'`
  // means we forward the path through unchanged. WebSocket forwarding is enabled
  // so HMR + Vite's dev-server live-reload also work end-to-end via the proxy.
  server: {
    port: ports.site,
    strictPort: true,
    ...LAN_SERVER,
    proxy: {
      '/weasel/draw': {
        target: `http://localhost:${ports.draw}`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: '../../dist-demo',
    emptyOutDir: true,
  },
});
