/**
 * Loads a built page in a fresh headless Chromium on ANGLE Metal, a browser per round, and reports
 * the main thread's long tasks and where a CPU profile of the load spent its time.
 *
 * Run: node probe.mjs <dir> <base> [--rounds 3] [--out file.json] [--headed] [--channel chrome] [--dpr 2] [--cold]
 *
 * `--cold` renames every shader's `main` per browser, as `first-frame.spec.ts`'s `WEASEL_PERF_COLD_METAL` does,
 * so the first load compiles against a cold Metal cache and its reload finds what that load compiled.
 * where <dir> holds the build (`index.html` and its assets) and <base> is the path it was built
 * for, e.g. `/skulkr/`.
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
const require = createRequire(join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');

const [dir, base] = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const ROUNDS = Number(arg('rounds', 3));
const OUT = arg('out', null);
const SETTLE_MS = Number(arg('settle', 4000));
const HEADED = process.argv.includes('--headed');
const CHANNEL = arg('channel', undefined);
const DPR = Number(arg('dpr', 2));
const COLD = process.argv.includes('--cold');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const rel = path.startsWith(base) ? path.slice(base.length) : null;
  if (rel === null) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(join(resolve(dir), rel || 'index.html'));
    res.writeHead(200, { 'content-type': TYPES[extname(rel || 'index.html')] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '::', r));
const url = `http://localhost:${server.address().port}${base}`;

const GL_CALLS = /^(getShaderParameter|getProgramParameter|linkProgram|compileShader|readPixels|getUniformLocation|getError|getParameter|drawElements|drawArrays|texImage2D|texSubImage2D|bufferData|getContext)$/;

function summarize(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const self = new Map();
  const gl = new Map();
  const dt = profile.timeDeltas;
  for (let i = 0; i < profile.samples.length; i++) {
    const ms = (dt[i + 1] ?? 0) / 1000;
    const node = byId.get(profile.samples[i]);
    const f = node.callFrame;
    const key = `${f.functionName || '(anonymous)'} ${f.url.split('/').pop()}:${f.lineNumber}`;
    self.set(key, (self.get(key) ?? 0) + ms);
    for (let id = node.id; id !== undefined; id = parent.get(id)) {
      const name = byId.get(id).callFrame.functionName;
      if (GL_CALLS.test(name)) { gl.set(name, (gl.get(name) ?? 0) + ms); break; }
    }
  }
  const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => [k, +v.toFixed(1)]);
  return { top, gl: Object.fromEntries([...gl].map(([k, v]) => [k, +v.toFixed(1)])) };
}

async function load(page, cdp, how) {
  await cdp.send('Profiler.start');
  const t0 = Date.now();
  if (how === 'goto') await page.goto(url); else await page.reload();
  await page.waitForTimeout(SETTLE_MS);
  const { profile } = await cdp.send('Profiler.stop');
  const longtasks = await page.evaluate(() => globalThis.__longtasks);
  const links = await page.evaluate(() => globalThis.__links);
  const canvases = await page.evaluate(() => document.querySelectorAll('canvas').length);
  return { how, wallMs: Date.now() - t0, canvases, longtasks, links, ...summarize(profile) };
}

const rounds = [];
console.log(`probe ${url} headed ${HEADED} channel ${CHANNEL ?? 'chromium'} dpr ${DPR} cold ${COLD}`);
for (let r = 0; r < ROUNDS; r++) {
  const browser = await chromium.launch({
    headless: !HEADED, channel: CHANNEL, args: ['--use-angle=metal', '--disable-features=LocalNetworkAccessChecks'],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: DPR });
    if (COLD) {
      await context.addInitScript((nonce) => {
        const proto = WebGL2RenderingContext.prototype;
        const source = proto.shaderSource;
        const MAIN = /\bvoid\s+main\s*\(\s*(?:void\s*)?\)/;
        proto.shaderSource = function (shader, src) {
          if (!MAIN.test(src)) return source.call(this, shader, src);
          const name = `cold_${nonce}`;
          return source.call(this, shader, `${src.replace(MAIN, `void ${name}()`)}\nvoid main() { ${name}(); }\n`);
        };
      }, Math.random().toString(36).slice(2));
    }
    await context.addInitScript(() => {
      // Each program linked: when, its fragment source's length, and how long the page waited on its status.
      globalThis.__links = [];
      const proto = WebGL2RenderingContext.prototype;
      const src = new WeakMap(), frag = new WeakMap(), rec = new WeakMap(), fragShaders = new WeakSet();
      const create = proto.createShader;
      proto.createShader = function (type) {
        const sh = create.call(this, type);
        if (sh && type === this.FRAGMENT_SHADER) fragShaders.add(sh);
        return sh;
      };
      const shaderSource = proto.shaderSource;
      proto.shaderSource = function (sh, s) { src.set(sh, s.length); return shaderSource.call(this, sh, s); };
      const attach = proto.attachShader;
      proto.attachShader = function (p, sh) {
        if (fragShaders.has(sh)) frag.set(p, src.get(sh));
        return attach.call(this, p, sh);
      };
      const link = proto.linkProgram;
      proto.linkProgram = function (p) {
        const r = { at: +performance.now().toFixed(1), frag: frag.get(p) ?? -1, waited: 0 };
        rec.set(p, r); globalThis.__links.push(r);
        return link.call(this, p);
      };
      const param = proto.getProgramParameter;
      proto.getProgramParameter = function (p, pname) {
        const t0 = performance.now();
        try { return param.call(this, p, pname); } finally { const r = rec.get(p); if (r) r.waited = +(r.waited + performance.now() - t0).toFixed(1); }
      };
      globalThis.__longtasks = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) globalThis.__longtasks.push([+e.startTime.toFixed(0), +e.duration.toFixed(0)]);
      }).observe({ type: 'longtask', buffered: true });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    const glRenderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
      return gl ? String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : null;
    });
    const loads = [await load(page, cdp, 'goto'), await load(page, cdp, 'reload')];
    rounds.push({ round: r + 1, browser: browser.version(), glRenderer, errors, loads });
    for (const l of loads) {
      const longest = Math.max(0, ...l.longtasks.map((t) => t[1]));
      console.log(`${r + 1}/${ROUNDS} ${l.how.padEnd(6)} longest task ${String(longest).padStart(5)} ms  canvases ${l.canvases}`
        + `  tasks ${JSON.stringify(l.longtasks)}`);
      console.log(`    gl (profile, inclusive) ${JSON.stringify(l.gl)}`);
      console.log(`    links [at ms, frag length, waited ms] ${JSON.stringify(l.links.map((k) => [k.at, k.frag, k.waited]))}`);
      console.log(`    top self ${JSON.stringify(l.top.slice(0, 8))}`);
    }
    if (errors.length) console.log(`    page errors: ${errors.join(' | ')}`);
  } finally {
    await browser.close();
  }
}
server.close();
if (OUT) await writeFile(OUT, `${JSON.stringify({ url, headed: HEADED, channel: CHANNEL ?? null, dpr: DPR, cold: COLD, rounds }, null, 2)}\n`);
