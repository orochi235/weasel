/**
 * Cold dev-server startup for apps/draw: per round, wipe vite's dep cache, start
 * a fresh server, and load the app once in a fresh headless Chromium context.
 *
 * Two documents, as items:
 *
 *   - `starter` — what a first visit sees: the starter rectangle, whose label
 *                 is text, so the Inter atlas loads.
 *   - `empty`   — a saved empty document. Nothing lays out text, so nothing
 *                 should fetch the atlas; `atlasRequests` says whether it did.
 *
 * Run: node tests/perf/draw-cold-start.mjs [--rounds 3] [--port 4791]
 *        [--docs starter,empty] [--out results.json]
 *
 * The server runs with WAKE_EXTRA, so it neither takes over nor is taken over by
 * a draw server already running from another checkout.
 *
 * Writes one result file (see tests/perf/README.md). This reports; it does not gate.
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metric, rounds, startRun } from './lib/result.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const require = createRequire(join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const ROUNDS = Number(arg('rounds', rounds(3)));
const PORT = Number(arg('port', 4791));
const DOCS = arg('docs', 'starter,empty').split(',');
const OUT = arg('out', null);
// The draw config pins its dep cache here rather than vite's default.
const CACHE_DIR = join(ROOT, 'node_modules/.vite-draw');
const SCENE_KEY = 'weaseldraw:scene-v1';

const run = startRun('draw-cold-start', { rounds: ROUNDS, docs: DOCS });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer() {
  rmSync(CACHE_DIR, { recursive: true, force: true });
  const server = spawn('npx', ['vite', '--config', 'apps/draw/vite.config.ts', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    env: { ...process.env, WAKE_EXTRA: String(PORT), BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  const t0 = Date.now();
  while (!/Local:/.test(log)) {
    if (server.exitCode !== null || Date.now() - t0 > 60_000) {
      throw new Error(`draw dev server did not start:\n${log}`);
    }
    await sleep(50);
  }
  return async () => {
    try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already gone */ }
    await sleep(500);
  };
}

async function loadOnce(browser, doc) {
  const ctx = await browser.newContext();
  try {
    if (doc === 'empty') {
      await ctx.addInitScript(([key]) => {
        localStorage.setItem(key, JSON.stringify({ version: 1, nodes: [] }));
      }, [SCENE_KEY]);
    }
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    let requests = 0;
    let bytes = 0;
    let atlasRequests = 0;
    cdp.on('Network.requestWillBeSent', (e) => {
      requests++;
      // The `?import&url` modules are ~600-byte URL exports, not the atlas.
      if (/\/inter\.(json|png)$/.test(e.request.url)) atlasRequests++;
    });
    cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; });
    await page.goto(`http://localhost:${PORT}/weasel/draw/`, { waitUntil: 'load', timeout: 180_000 });
    await page.waitForLoadState('networkidle', { timeout: 180_000 });
    const fcp = await page.evaluate(() => new Promise((res) => {
      new PerformanceObserver((l) => res(l.getEntries().find((e) => e.name === 'first-contentful-paint')?.startTime ?? null))
        .observe({ type: 'paint', buffered: true });
      setTimeout(() => res(null), 10_000);
    }));
    if (fcp === null) throw new Error(`${doc}: no first-contentful-paint entry`);
    return { fcp, requests, bytes, atlasRequests };
  } finally {
    await ctx.close();
  }
}

const samples = Object.fromEntries(DOCS.map((d) => [d, []]));
const total = ROUNDS * DOCS.length;
let done = 0;
for (let r = 1; r <= ROUNDS; r++) {
  for (const doc of DOCS) {
    const stop = await startServer();
    const browser = await chromium.launch({ headless: true });
    try {
      if (done === 0) run.machine({ browser: `chromium ${browser.version()}` });
      const s = await loadOnce(browser, doc);
      samples[doc].push(s);
      done++;
      console.log(`${String(done).padStart(2)}/${total}  round ${r}  ${doc.padEnd(7)}  FCP ${s.fcp.toFixed(0).padStart(6)} ms  ${String(s.requests).padStart(5)} req  ${(s.bytes / 1e6).toFixed(2).padStart(6)} MB  atlas ${s.atlasRequests}`);
    } finally {
      await browser.close();
      await stop();
    }
  }
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const doc of DOCS) {
  const col = (k) => samples[doc].map((s) => s[k]);
  const stat = `median of ${ROUNDS} cold rounds`;
  run.item(doc, {
    fcp: metric(median(col('fcp')), 'ms', stat, col('fcp')),
    requests: metric(median(col('requests')), 'count', stat, col('requests')),
    bytes: metric(median(col('bytes')), 'bytes', stat, col('bytes')),
    atlasRequests: metric(Math.max(...col('atlasRequests')), 'count', `max of ${ROUNDS} rounds`, col('atlasRequests')),
  });
}
run.write({ out: OUT ?? undefined });
