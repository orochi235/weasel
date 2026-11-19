/** Building the demo site and serving the build from this process, on a port of its own. */
import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

/** The site's vite `base`; the build only works served under it. */
export const BASE = '/weasel/';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
};

const run = (root, say, label, cmd, args) => {
  const t0 = Date.now();
  say(`build: ${label}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) {
    process.stderr.write(`${r.stdout}\n${r.stderr}\n`);
    throw new Error(`${label} failed (exit ${r.status})`);
  }
  say(`build: ${label} took ${((Date.now() - t0) / 1000).toFixed(1)}s`);
};

/**
 * The packages' `dist` (the site imports labkit's and theme's stylesheets from it) unless `packages`
 * is false, then the site itself into `outDir`, which each build replaces.
 */
export const buildSite = (root, outDir, { packages = true, say }) => {
  if (packages) run(root, say, 'packages (npm run build)', 'npm', ['run', 'build']);
  run(root, say, `site (vite build into ${outDir})`, 'npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn']);
};

/** Serves `dir` at BASE on an ephemeral loopback port. Answers `{ url, close }`. */
export const serveDir = (dir) =>
  new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
      if (!path.startsWith(BASE)) {
        res.writeHead(302, { location: BASE });
        res.end();
        return;
      }
      let file = normalize(join(dir, path.slice(BASE.length)));
      if (!file.startsWith(normalize(dir))) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (!existsSync(file) || statSync(file).isDirectory()) file = existsSync(file) && existsSync(join(file, 'index.html')) ? join(file, 'index.html') : join(dir, 'index.html');
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
      createReadStream(file).pipe(res);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ url: `http://127.0.0.1:${port}${BASE}`, close: () => new Promise((done) => server.close(done)) });
    });
  });
