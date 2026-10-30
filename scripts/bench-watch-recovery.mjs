#!/usr/bin/env node
/**
 * What missed-event recovery (`watchRecovery`, `packages/forge/src/vite/watchRecovery.ts`) costs a forge dev server.
 * Starts `apps/forge`, loads the workshop and frame pages the way a browser does, following every static import, and
 * times the recovery middleware's own work on each request (cold, then warm), then times the quiet check's pass over
 * every served file.
 *
 *   node scripts/bench-watch-recovery.mjs [--loads 2] [--sweeps 50] [--out <file.jsonl>]
 *   onto do --kind bench -- node scripts/bench-watch-recovery.mjs --out bench.jsonl
 *
 * One JSON record per page load and one for the sweeps go to `--out`, with every timing in it.
 */
import { appendFileSync, statSync } from 'node:fs';
import { cpus, hostname, loadavg } from 'node:os';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const loads = Number(opt('loads', 2));
const sweeps = Number(opt('sweeps', 50));
const out = opt('out');
const root = resolve(import.meta.dirname, '..');
const machine = { host: hostname(), cpus: cpus().length, cpu: cpus()[0]?.model, load: loadavg() };
const record = (r) => {
  const line = JSON.stringify({ ...r, machine, at: new Date().toISOString() });
  if (out) appendFileSync(out, line + '\n');
};

const server = await createServer({
  configFile: resolve(root, 'apps/forge/vite.config.ts'),
  server: { port: 0, host: '127.0.0.1', strictPort: false, open: false },
  logLevel: 'warn',
});
let recoveries = 0;
const warn = server.config.logger.warn;
server.config.logger.warn = (msg, o) => {
  if (msg.includes('changed with no file event')) recoveries++;
  warn(msg, o);
};
const layer = server.middlewares.stack.find((l) => l.handle.name === 'weaselWatchRecovery');
if (!layer) throw new Error('no weaselWatchRecovery middleware on the forge server');
let spent = [];
const handle = layer.handle;
layer.handle = (req, res, next) => {
  const t0 = process.hrtime.bigint();
  handle(req, res, () => {});
  spent.push(Number(process.hrtime.bigint() - t0) / 1e3);
  next();
};
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
console.log(`forge at ${base}`);

const IMPORT = /(?:^|[;\n])\s*(?:import|export)\s*(?:[\w*{}\s,$]*?\bfrom\s*)?["']([^"']+)["']/g;
const HTML_REF = /<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g;

async function load() {
  spent = [];
  const seen = new Set(['/', '/frame.html']);
  const queue = [...seen];
  const statuses = {};
  const t0 = performance.now();
  const fetchOne = async (url) => {
    let res = await fetch(base + url, { headers: { accept: '*/*' } });
    if (res.status === 504) res = await fetch(base + url, { headers: { accept: '*/*' } });
    statuses[res.status] = (statuses[res.status] ?? 0) + 1;
    if (res.status !== 200) return;
    const text = await res.text();
    const type = res.headers.get('content-type') ?? '';
    const refs = type.includes('html') ? text.matchAll(HTML_REF) : type.includes('javascript') ? text.matchAll(IMPORT) : [];
    for (const [, ref] of refs) {
      if (/^(?:https?:|data:)/.test(ref)) continue;
      const next = new URL(ref, base + url);
      const path = next.pathname + next.search;
      if (!seen.has(path)) {
        seen.add(path);
        queue.push(path);
      }
    }
  };
  await new Promise((done, fail) => {
    let inflight = 0;
    const pump = () => {
      while (inflight < 16 && queue.length) {
        inflight++;
        fetchOne(queue.shift()).then(() => {
          inflight--;
          if (queue.length) pump();
          else if (!inflight) done();
        }, fail);
      }
    };
    pump();
  });
  return { ms: performance.now() - t0, requests: seen.size, statuses };
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (let i = 0; i < loads; i++) {
  const page = await load();
  const timings = spent;
  record({ kind: 'load', load: i, ...page, middlewareCalls: timings.length, middlewareUs: timings, recoveries });
  console.log(
    `load ${i + 1}/${loads}: ${page.requests} urls, ${timings.length} middleware calls in ${page.ms.toFixed(0)} ms; ` +
      `middleware ${(sum(timings) / 1e3).toFixed(2)} ms total, median ${median(timings).toFixed(1)} µs, ` +
      `max ${Math.max(...timings).toFixed(1)} µs; statuses ${JSON.stringify(page.statuses)}; recoveries ${recoveries}`,
  );
}

const cacheDir = server.config.cacheDir + '/';
const files = [...server.environments.client.moduleGraph.fileToModulesMap.keys()].filter(
  (f) => f.startsWith('/') && !f.includes('/node_modules/') && !f.startsWith(cacheDir),
);
const passes = [];
for (let i = 0; i < sweeps; i++) {
  const t0 = process.hrtime.bigint();
  for (const file of files) {
    try {
      statSync(file);
    } catch {}
  }
  passes.push(Number(process.hrtime.bigint() - t0) / 1e6);
}
record({ kind: 'sweep', files: files.length, passMs: passes });
console.log(
  `sweep: ${files.length} files, median ${median(passes).toFixed(2)} ms, max ${Math.max(...passes).toFixed(2)} ms over ${sweeps} passes`,
);
await server.close();
