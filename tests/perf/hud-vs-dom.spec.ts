/**
 * HUD text against a transparent DOM overlay: which is cheaper per frame, and
 * where the answer flips.
 *
 * Two ways to put text over the canvas. `@weasel-js/hud` draws it as canvas
 * commands through the renderer; a DOM layer sits above the canvas and lets the
 * browser lay the text out and composite it. The sweep crosses glyph count,
 * whether the text changes every frame (a readout) or never (a label), and
 * whether it moves with the camera. Text comes in 10-glyph labels, so a glyph
 * count is ten times a label count.
 *
 * **Unlike the other specs here, the canvas is in the document.** The overlay's
 * cost lives in the compositor, the raster workers and the GPU process, so an
 * off-document canvas would hand the DOM side a free lunch. Every cell renders
 * the same background scene every frame on both sides, and a `none` cell prices
 * that scene alone; read a cell against it.
 *
 * **Time comes from a Chromium trace, not the page's clock.** Style, layout,
 * paint and raster happen outside any JavaScript a page can time. Each
 * measurement traces a window of frames and reports per frame: the renderer
 * main thread (split into script, style, layout, paint and other by the self
 * time of the trace events), the compositor thread, the raster workers, and the
 * GPU process. The GPU process figure is CPU time spent there — decoding the
 * command buffer and compositing — not GPU execution. GPU execution is timed
 * with `EXT_disjoint_timer_query_webgl2` where the browser exposes it, which
 * covers the canvas's own draws only; the result's `params.gpuTimer` says
 * whether it did.
 *
 * **Frame rate comes from an untraced window.** Tracing costs the browser
 * process enough to stretch frames on its own, so each measurement first runs
 * the same number of frames with tracing off and reads the rAF intervals from
 * those.
 *
 * **ABBA order.** Every configuration runs `hud dom dom hud`, then `dom hud hud
 * dom` on the next pass, so a machine drifting across a configuration charges
 * both sides alike, and node noise shows up as spread across samples rather
 * than as a difference between approaches.
 *
 * "Moves with the camera" means per-label repositioning under a pan and a zoom
 * whose glyph size stays fixed — the case for labels pinned to scene nodes. A
 * "pan" camera translates without zooming, which lets a DOM overlay move as one
 * element.
 *
 * Approaches: `hud` draws through `attachHud`'s layer; `dom` is plain DOM, each
 * label moved by its own `transform`; `react` is the same spans rendered by
 * React (`lib/hudDomReact.tsx`, bundled here with React's production build,
 * which is what a consumer ships), so it adds reconciliation; `dom-layer`, run
 * only under a pan, leaves the labels where they are and moves the overlay
 * with one `transform`. The HUD has no layer-level offset, so under a pan it
 * still moves each widget.
 *
 * This reports; it does not gate. See `tests/perf/README.md`.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';
import { metric, rounds, startRun } from './lib/result';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import os from 'node:os';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const REACT_URL = '/weasel/__perf/hud-dom-react.js';

const W = 1280;
const H = 800;
const GLYPHS_PER_LABEL = 10;

const ALL_GLYPHS = [10, 100, 500, 1000, 2500, 5000];
/** `HVD_GLYPHS=10,5000` narrows the sweep. */
const onlyGlyphs = process.env.HVD_GLYPHS?.split(',').map(Number).filter(Number.isFinite);
const GLYPHS = onlyGlyphs?.length ? onlyGlyphs : ALL_GLYPHS;
const ALL_UPDATES = ['static', 'every-frame'] as const;
/** `HVD_UPDATES=static` runs half the sweep, so each half fits a node's job
 *  deadline. */
const onlyUpdates = process.env.HVD_UPDATES?.split(',').map((x) => x.trim());
const UPDATES = onlyUpdates?.length ? ALL_UPDATES.filter((u) => onlyUpdates.includes(u)) : ALL_UPDATES;
const ALL_CAMERAS = ['fixed', 'moving', 'pan'] as const;
/** `HVD_CAMERAS=pan` narrows the sweep. */
const onlyCameras = process.env.HVD_CAMERAS?.split(',').map((x) => x.trim());
const CAMERAS = onlyCameras?.length ? ALL_CAMERAS.filter((c) => onlyCameras.includes(c)) : ALL_CAMERAS;
type Approach = 'hud' | 'dom' | 'react' | 'dom-layer' | 'none';
const ALL_APPROACHES = ['hud', 'dom', 'react', 'dom-layer'] as const;
/** `HVD_APPROACHES=hud,dom` narrows the sweep. */
const onlyApproaches = process.env.HVD_APPROACHES?.split(',').map((x) => x.trim());
const APPROACHES = onlyApproaches?.length ? ALL_APPROACHES.filter((a) => onlyApproaches.includes(a)) : ALL_APPROACHES;
const approachesFor = (camera: string) => APPROACHES.filter((a) => a !== 'dom-layer' || camera === 'pan');

/** Frames traced per measurement, and frames run untraced before it. */
const FRAMES = Number(process.env.HVD_FRAMES ?? 120);
const WARMUP = 30;

/** Passes. Each runs every configuration's approaches forward then backward
 *  (ABCCBA), so each gives every cell two samples. */
const PASSES = rounds(2);

const CATEGORIES = [
  'toplevel',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'blink.user_timing',
  'gpu',
].join(',');

interface Config { glyphs: number; update: typeof UPDATES[number]; camera: typeof CAMERAS[number] }
interface Cell extends Config { approach: Approach }

interface Breakdown {
  main: number; script: number; style: number; layout: number; paint: number; otherMain: number;
  compositor: number; raster: number; gpuProcess: number; total: number;
}
interface Sample extends Cell {
  pass: number;
  perFrame: Breakdown;
  frames: number;
  intervalMs: number;
  longFrames: number;
  gpuTimeMs: number | null;
  load1: number;
  /** From the untraced window. */
  freeIntervalMs: number;
  freeMissed: number;
}

// ─── trace analysis ──────────────────────────────────────────────────────

interface TraceEvent {
  ph: string; name: string; cat?: string; pid: number; tid: number;
  ts: number; dur?: number; args?: Record<string, unknown>;
}

const SCRIPT = /^(FunctionCall|EvaluateScript|FireAnimationFrame|TimerFire|EventDispatch|RunMicrotasks|v8\.|V8\.|MinorGC|MajorGC|BlinkGC|ThreadState::|CppGC|GCEvent)/;
const STYLE = /^(UpdateLayoutTree|RecalculateStyles|ParseAuthorStyleSheet|ScheduleStyleRecalculation|InvalidateLayout)/;
const LAYOUT = /^(Layout|LocalFrameView::layout|LayoutShift)$/;
const PAINT = /^(Paint|PrePaint|PaintImage|Layerize|UpdateLayer|UpdateLayerTree|CompositeLayers|Commit|PaintSetup|RasterTask)$/;

/** Busy time of a thread in [t0, t1]: the union of its complete events, so
 *  nesting is not counted twice. */
function busy(events: TraceEvent[], t0: number, t1: number): number {
  const spans = events
    .map((e) => [Math.max(e.ts, t0), Math.min(e.ts + (e.dur ?? 0), t1)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let sum = 0;
  let curA = -1;
  let curB = -1;
  for (const [a, b] of spans) {
    if (a > curB) {
      if (curB > curA) sum += curB - curA;
      curA = a; curB = b;
    } else if (b > curB) curB = b;
  }
  if (curB > curA) sum += curB - curA;
  return sum;
}

/** Self time by event name on one thread, for events wholly inside the
 *  window. An event's self time is its duration less its direct children's. */
function selfTimes(events: TraceEvent[], t0: number, t1: number): Map<string, number> {
  const inside = events
    .filter((e) => e.ts >= t0 && e.ts + (e.dur ?? 0) <= t1)
    .sort((a, b) => a.ts - b.ts || (b.dur ?? 0) - (a.dur ?? 0));
  const self = new Map<string, number>();
  const stack: Array<{ e: TraceEvent; end: number; child: number }> = [];
  const close = (f: { e: TraceEvent; child: number }) => {
    self.set(f.e.name, (self.get(f.e.name) ?? 0) + Math.max(0, (f.e.dur ?? 0) - f.child));
  };
  for (const e of inside) {
    const end = e.ts + (e.dur ?? 0);
    while (stack.length && stack[stack.length - 1].end <= e.ts) close(stack.pop()!);
    if (stack.length) stack[stack.length - 1].child += e.dur ?? 0;
    stack.push({ e, end, child: 0 });
  }
  while (stack.length) close(stack.pop()!);
  return self;
}

function analyze(trace: Buffer, frames: number): Breakdown & { found: string[] } {
  const parsed = JSON.parse(trace.toString('utf8')) as { traceEvents?: TraceEvent[] } | TraceEvent[];
  const events = Array.isArray(parsed) ? parsed : (parsed.traceEvents ?? []);
  const threadName = new Map<string, string>();
  const processName = new Map<number, string>();
  for (const e of events) {
    if (e.ph !== 'M') continue;
    const name = String((e.args as { name?: string } | undefined)?.name ?? '');
    if (e.name === 'thread_name') threadName.set(`${e.pid}:${e.tid}`, name);
    if (e.name === 'process_name') processName.set(e.pid, name);
  }
  const start = events.find((e) => e.name === 'hvd-start');
  const end = events.find((e) => e.name === 'hvd-end');
  if (!start || !end) throw new Error('trace holds no hvd-start / hvd-end marks');
  const t0 = start.ts;
  const t1 = end.ts;
  const rendererPid = start.pid;

  const byThread = new Map<string, TraceEvent[]>();
  for (const e of events) {
    if (e.ph !== 'X' || e.dur === undefined) continue;
    const k = `${e.pid}:${e.tid}`;
    let list = byThread.get(k);
    if (!list) { list = []; byThread.set(k, list); }
    list.push(e);
  }

  let main = 0; let compositor = 0; let raster = 0; let gpuProcess = 0;
  let mainEvents: TraceEvent[] = [];
  const found: string[] = [];
  for (const [k, list] of byThread) {
    const pid = Number(k.split(':')[0]);
    const tname = threadName.get(k) ?? '';
    const pname = processName.get(pid) ?? '';
    if (pid === rendererPid) {
      if (tname === 'CrRendererMain') { main = busy(list, t0, t1); mainEvents = list; found.push('main'); }
      else if (tname === 'Compositor') { compositor += busy(list, t0, t1); found.push('compositor'); }
      else if (tname.startsWith('CompositorTileWorker')) { raster += busy(list, t0, t1); found.push('raster'); }
    } else if (/gpu/i.test(pname)) {
      gpuProcess += busy(list, t0, t1);
      found.push('gpu');
    }
  }

  let script = 0; let style = 0; let layout = 0; let paint = 0; let otherMain = 0;
  for (const [name, us] of selfTimes(mainEvents, t0, t1)) {
    if (SCRIPT.test(name)) script += us;
    else if (STYLE.test(name)) style += us;
    else if (LAYOUT.test(name)) layout += us;
    else if (PAINT.test(name)) paint += us;
    else otherMain += us;
  }
  const ms = (us: number) => us / 1000 / frames;
  return {
    main: ms(main), script: ms(script), style: ms(style), layout: ms(layout), paint: ms(paint),
    otherMain: ms(otherMain), compositor: ms(compositor), raster: ms(raster),
    gpuProcess: ms(gpuProcess), total: ms(main + compositor + raster + gpuProcess),
    found: [...new Set(found)],
  };
}

interface FrameStats { frames: number; intervalMs: number; longFrames: number; missed: number; gpuTimeMs: number | null }

const countFrames = (page: Page, frames: number) => page.evaluate(
  (n) => (globalThis as unknown as { __hvd: { traceFrames(n: number): Promise<unknown> } }).__hvd.traceFrames(n),
  frames,
) as Promise<FrameStats>;

async function traced(page: Page, browser: Browser, frames: number) {
  await browser.startTracing(page, { categories: CATEGORIES.split(',') });
  const stats = await countFrames(page, frames);
  const buf = await browser.stopTracing();
  return { stats, breakdown: analyze(buf, stats.frames) };
}

// ─── the page ────────────────────────────────────────────────────────────

/** Installed into the page: builds a cell, drives its frame loop, and counts
 *  frames for the traced window. Runs in the browser. */
async function install(
  { root, w, h, glyphsPerLabel, reactUrl }: { root: string; w: number; h: number; glyphsPerLabel: number; reactUrl: string },
): Promise<{ glRenderer: string; gpuTimer: boolean }> {
  const base = `/weasel/@fs${root}`;
  // One import of the renderer barrel, so the font registry the renderer reads
  // is the one written here; a second specifier can load a second copy.
  const { WeaselRenderer, registerFont } = await import(/* @vite-ignore */ `${base}/packages/core/src/renderer/index.ts`);
  const { createHud, attachHud } = await import(/* @vite-ignore */ `${base}/packages/hud/src/index.ts`);
  const { mountReactOverlay } = await import(/* @vite-ignore */ reactUrl);

  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  canvas.width = w;
  canvas.height = h;
  const gl = canvas.getContext('webgl2', { stencil: true });
  if (!gl) throw new Error('no WebGL2 context');
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const glRenderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2') as
    { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;

  await registerFont('sans-serif', { weight: 400, style: 'normal' }, '/weasel/inter/inter.json', '/weasel/inter/inter.png');
  const renderer = new WeaselRenderer({ gl, canvas, width: w, height: h, dpr: 1 });
  const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

  /** The same background on both sides, every frame: an animated scene is the
   *  case where overlay cost matters, and it keeps the canvas layer dirty. */
  const background: unknown[] = [];
  for (let i = 0; i < 200; i++) {
    background.push({
      kind: 'path',
      path: { kind: 'rect', x: (i * 67) % (w - 40), y: (i * 41) % (h - 40), width: 36, height: 36 },
      fill: { fill: 'solid', color: i % 2 ? '#1d3557' : '#2a4d3a' },
    });
  }

  const overlay = document.getElementById('overlay') as HTMLDivElement;
  const COLS = 12;
  const home = (i: number) => ({ x: 16 + (i % COLS) * 104, y: 16 + Math.floor(i / COLS) * 18 });
  const pad = (i: number) => String(i).padStart(4, '0');
  const label = (i: number, frame: number) => `L${pad(i)} ${(((frame + i) % 100) / 10).toFixed(2)}`;
  const camera = (frame: number, zoom: boolean) => {
    const t = frame * 0.05;
    return { z: zoom ? 1 + 0.1 * Math.sin(t) : 1, px: 20 * Math.sin(t * 0.7), py: 15 * Math.cos(t * 0.9) };
  };
  const place = (p: { x: number; y: number }, c: { z: number; px: number; py: number }) => ({
    x: w / 2 + (p.x - w / 2) * c.z + c.px,
    y: h / 2 + (p.y - h / 2) * c.z + c.py,
  });

  let step: (frame: number) => void = () => {};
  let teardown: () => void = () => {};
  let frame = 0;
  let gpuMs: number[] | null = null;
  const pending: WebGLQuery[] = [];

  const render = (cmds: unknown[]) => {
    let q: WebGLQuery | null = null;
    if (timer && gpuMs) {
      q = gl.createQuery();
      gl.beginQuery(timer.TIME_ELAPSED_EXT, q!);
    }
    renderer.render(cmds, identity);
    if (q && timer) { gl.endQuery(timer.TIME_ELAPSED_EXT); pending.push(q); }
  };
  const drainQueries = () => {
    if (!timer) return;
    while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = pending.shift()!;
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
      if (gpuMs && !gl.getParameter(timer.GPU_DISJOINT_EXT)) gpuMs.push(ns / 1e6);
      gl.deleteQuery(q);
    }
  };

  let onFrame: ((ts: number) => void) | null = null;
  const loop = (ts: number) => {
    frame += 1;
    drainQueries();
    step(frame);
    onFrame?.(ts);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const nextFrames = (n: number) => new Promise<number[]>((done) => {
    const stamps: number[] = [];
    onFrame = (ts) => {
      stamps.push(ts);
      if (stamps.length >= n) { onFrame = null; done(stamps); }
    };
  });

  const api = {
    glRenderer,
    gpuTimer: Boolean(timer),
    setup(cell: { approach: string; glyphs: number; update: string; camera: string }): { paints: boolean } {
      teardown();
      const n = Math.max(1, Math.round(cell.glyphs / glyphsPerLabel));
      const every = cell.update === 'every-frame';
      const moving = cell.camera !== 'fixed';
      const zoom = cell.camera === 'moving';
      let paints = true;

      if (cell.approach === 'none') {
        step = () => render(background);
        teardown = () => {};
      } else if (cell.approach === 'hud') {
        const hud = createHud();
        const widgets = Array.from({ length: n }, (_, i) => {
          const p = home(i);
          return hud.text({ id: `l${i}`, x: p.x, y: p.y, text: label(i, 0), fontSize: 14, color: '#e8e8e8' });
        });
        // `attachHud`'s own layer, drawn after the scene underneath, so the
        // cell pays whatever the real layer does per repaint — its widget
        // command cache included.
        let layer: { draw(data: unknown, view: unknown, dims: unknown): unknown[] } | null = null;
        const detach = attachHud({
          element: null,
          requestRedraw: () => {},
          subscribeFrame: () => () => {},
          registerLayer: (l: typeof layer) => { layer = l; return () => {}; },
        }, hud, { font: 'sans-serif' });
        const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
        const dims = { width: w, height: h };
        const frameCommands = () => [...background, ...layer!.draw(null, view, dims)];
        step = (f) => {
          const c = moving ? camera(f, zoom) : null;
          for (let i = 0; i < n; i++) {
            if (every) widgets[i].setText(label(i, f));
            if (c) {
              const p = place(home(i), c);
              widgets[i].setBounds({ x: p.x, y: p.y, w: 0, h: 14 });
            }
          }
          render(frameCommands());
        };
        // Text alone, read back in the same task: a HUD that draws nothing
        // measures free.
        renderer.render(layer!.draw(null, view, dims), identity);
        const px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        paints = false;
        for (let p = 3; p < px.length; p += 4) if (px[p] !== 0) { paints = true; break; }
        teardown = () => { detach(); for (const wd of widgets) wd.dispose(); };
      } else if (cell.approach === 'react') {
        const at = (i: number, f: number) => {
          const c = moving ? camera(f, zoom) : null;
          const p = c ? place(home(i), c) : home(i);
          return { text: label(i, every ? f : 0), x: p.x, y: p.y };
        };
        const ov = mountReactOverlay(overlay, Array.from({ length: n }, (_, i) => at(i, 0)));
        step = (f) => {
          render(background);
          // A frame with nothing to change sets no state, as a consumer's
          // would not.
          if (every || moving) ov.update(Array.from({ length: n }, (_, i) => at(i, f)));
        };
        const spans = [...overlay.querySelectorAll('span')];
        paints = spans.length === n && spans.every((s) => s.getBoundingClientRect().width > 0);
        teardown = () => { ov.unmount(); overlay.replaceChildren(); };
      } else {
        const layerMove = cell.approach === 'dom-layer';
        const nodes: Text[] = [];
        const spans: HTMLSpanElement[] = [];
        for (let i = 0; i < n; i++) {
          const span = document.createElement('span');
          span.className = 'label';
          const t = document.createTextNode(label(i, 0));
          span.appendChild(t);
          const p = home(i);
          span.style.transform = `translate(${p.x}px, ${p.y}px)`;
          overlay.appendChild(span);
          nodes.push(t);
          spans.push(span);
        }
        step = (f) => {
          render(background);
          const c = moving ? camera(f, zoom) : null;
          if (c && layerMove) overlay.style.transform = `translate(${c.px}px, ${c.py}px)`;
          for (let i = 0; i < n; i++) {
            if (every) nodes[i].data = label(i, f);
            if (c && !layerMove) {
              const p = place(home(i), c);
              spans[i].style.transform = `translate(${p.x}px, ${p.y}px)`;
            }
          }
        };
        paints = spans.every((s) => s.getBoundingClientRect().width > 0);
        teardown = () => { overlay.replaceChildren(); overlay.style.transform = ''; };
      }
      return { paints };
    },
    async warm(n: number) { await nextFrames(n); },
    async traceFrames(n: number) {
      gpuMs = timer ? [] : null;
      performance.mark('hvd-start');
      const stamps = await nextFrames(n);
      performance.mark('hvd-end');
      // Queries lag their frames; give the last few a chance to land.
      await nextFrames(4);
      const samples = gpuMs;
      gpuMs = null;
      const iv = stamps.slice(1).map((t, i) => t - stamps[i]);
      const mean = iv.reduce((s, x) => s + x, 0) / Math.max(1, iv.length);
      const sorted = [...iv].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      const gpuTimeMs = samples && samples.length
        ? samples.reduce((s, x) => s + x, 0) / samples.length
        : null;
      return {
        frames: stamps.length,
        intervalMs: mean,
        longFrames: iv.filter((x) => x > median * 1.5).length,
        // Half a 60 Hz frame late: a vsync was skipped.
        missed: iv.filter((x) => x > 25).length,
        gpuTimeMs,
      };
    },
  };
  (globalThis as unknown as { __hvd: typeof api }).__hvd = api;
  return { glRenderer, gpuTimer: Boolean(timer) };
}

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>hud vs dom</title>
<style>
  html, body { margin: 0; background: #101418; overflow: hidden; }
  #scene { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
  #overlay { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px;
    pointer-events: none; font: 14px sans-serif; color: #e8e8e8; }
  .label { position: absolute; left: 0; top: 0; white-space: pre; }
</style></head>
<script type="module">
  // What vite's index.html transform injects for @vitejs/plugin-react; the hud
  // barrel reaches .tsx modules that refuse to load without it.
  import RefreshRuntime from '/weasel/@react-refresh';
  RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => (type) => type;
  window.__vite_plugin_react_preamble_installed__ = true;
</script>
<body><canvas id="scene"></canvas><div id="overlay"></div></body></html>`;

// ─── the sweep ───────────────────────────────────────────────────────────

const fmt = (x: number, w = 6, d = 2) => x.toFixed(d).padStart(w);
const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

test('hud vs dom: text over the canvas, per frame', async ({ page, browser, browserName }) => {
  const configs: Config[] = [];
  for (const update of UPDATES) for (const cam of CAMERAS) for (const glyphs of GLYPHS) {
    configs.push({ glyphs, update, camera: cam });
  }
  const plan: Array<Cell & { pass: number }> = [];
  for (let pass = 1; pass <= PASSES; pass++) {
    const none = { approach: 'none' as const, glyphs: 0, update: 'static' as const, camera: 'fixed' as const, pass };
    plan.push(none);
    for (const c of configs) {
      const fwd = pass % 2 ? approachesFor(c.camera) : [...approachesFor(c.camera)].reverse();
      for (const approach of [...fwd, ...[...fwd].reverse()]) plan.push({ ...c, approach, pass });
    }
    plan.push({ ...none });
  }
  // Sized from the plan: a fixed hour cut a three-pass sweep off with nothing
  // written.
  test.setTimeout(120_000 + plan.length * 30_000);

  const run = startRun(UPDATES.length === ALL_UPDATES.length ? 'hud-vs-dom' : `hud-vs-dom-${UPDATES.join('-')}`, {
    viewport: `${W}x${H}`, dpr: 1, glyphs: GLYPHS, glyphsPerLabel: GLYPHS_PER_LABEL,
    updates: [...UPDATES], cameras: [...CAMERAS], approaches: [...APPROACHES], frames: FRAMES, warmup: WARMUP, passes: PASSES,
    order: 'each configuration\'s approaches forward then backward (ABCCBA), reversed on alternate passes', backgroundRects: 200,
  });
  const errors: string[] = [];
  // The fixture page has no HMR socket to reach; vite's client says so.
  const hmrNoise = /websocket|\[vite\]/i;
  page.on('console', (m) => { if (m.type() === 'error' && !hmrNoise.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  await page.route('**/weasel/__perf/hud-vs-dom', (r) => r.fulfill({ contentType: 'text/html', body: PAGE }));
  const reactBundle = await build({
    entryPoints: [resolve(here, 'lib/hudDomReact.tsx')], bundle: true, format: 'esm', write: false,
    minify: true, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
  });
  const reactJs = reactBundle.outputFiles[0].text;
  await page.route(`**${REACT_URL}`, (r) => r.fulfill({ contentType: 'text/javascript', body: reactJs }));
  await page.goto('/weasel/__perf/hud-vs-dom');
  const { glRenderer, gpuTimer } = await page.evaluate(install, { root: repoRoot, w: W, h: H, glyphsPerLabel: GLYPHS_PER_LABEL, reactUrl: REACT_URL });
  run.params({ gpuTimer });

  console.log('');
  console.log(`HUD vs DOM overlay — ${W}x${H}, dpr 1, on ${String(glRenderer)}`);
  console.log(`GPU timer query: ${gpuTimer ? 'available' : 'not exposed; GPU column is GPU-process CPU time only'}`);
  console.log(`${plan.length} measurements (${configs.length} configurations, each approach twice a pass, + 2 baselines, x ${PASSES} passes), ${FRAMES} frames each`);
  console.log(`load at start ${os.loadavg().map((x) => x.toFixed(1)).join(' ')} on ${os.cpus().length} cores`);
  console.log(`onto: plan ${plan.length} measurements`);
  console.log('');

  const samples: Sample[] = [];
  const paintFailures: string[] = [];
  const t0 = Date.now();
  for (const [idx, cell] of plan.entries()) {
    const { paints } = await page.evaluate(
      (c) => (globalThis as unknown as { __hvd: { setup(c: unknown): { paints: boolean } } }).__hvd.setup(c),
      cell,
    );
    if (!paints) paintFailures.push(`${cell.approach} ${cell.glyphs}`);
    await page.evaluate((n) => (globalThis as unknown as { __hvd: { warm(n: number): Promise<void> } }).__hvd.warm(n), WARMUP);
    const free = await countFrames(page, FRAMES);
    const { stats, breakdown } = await traced(page, browser, FRAMES);
    for (const t of ['main', 'gpu']) {
      if (!breakdown.found.includes(t)) throw new Error(`trace has no ${t} thread; found ${breakdown.found.join(', ')}`);
    }
    const { found: _found, ...perFrame } = breakdown;
    samples.push({ ...cell, perFrame, frames: stats.frames, intervalMs: stats.intervalMs, longFrames: stats.longFrames, gpuTimeMs: stats.gpuTimeMs, load1: os.loadavg()[0], freeIntervalMs: free.intervalMs, freeMissed: free.missed });
    const b = perFrame;
    console.log(
      `  ${String(idx + 1).padStart(3)}/${plan.length}  pass ${cell.pass}  ${cell.approach.padEnd(9)}`
      + `  ${String(cell.glyphs).padStart(4)} glyphs  ${cell.update.padEnd(11)}  ${cell.camera.padEnd(6)}`
      + `  main ${fmt(b.main)}  (js ${fmt(b.script, 5)} style ${fmt(b.style, 5)} layout ${fmt(b.layout, 5)} paint ${fmt(b.paint, 5)})`
      + `  comp ${fmt(b.compositor, 5)}  raster ${fmt(b.raster, 5)}  gpu-proc ${fmt(b.gpuProcess, 5)}`
      + `  total ${fmt(b.total)} ms/frame  interval ${fmt(free.intervalMs, 5)} (traced ${fmt(stats.intervalMs, 5)})  missed ${String(free.missed).padStart(3)}`
      + `${stats.gpuTimeMs !== null ? `  gpu ${fmt(stats.gpuTimeMs, 5)}` : ''}`
      + `  load ${fmt(os.loadavg()[0], 6, 1)}  ${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s`,
    );
    console.log(`onto: progress ${idx + 1}/${plan.length}`);
  }

  // ─── report ────────────────────────────────────────────────────────────

  const of = (c: Cell) => samples.filter((s) => s.approach === c.approach && s.glyphs === c.glyphs
    && (c.approach === 'none' || (s.update === c.update && s.camera === c.camera)));
  const noneSamples = samples.filter((s) => s.approach === 'none');
  const baseMain = med(noneSamples.map((s) => s.perFrame.main));
  const baseTotal = med(noneSamples.map((s) => s.perFrame.total));

  const lines = [
    '',
    `HUD vs DOM overlay — ${W}x${H}, dpr 1, on ${String(glRenderer)}`,
    `Per frame, ms; median of ${PASSES * 2} samples (ABBA x ${PASSES}), spread = max - min.`,
    `Baseline (background scene alone): main ${baseMain.toFixed(2)}, all threads ${baseTotal.toFixed(2)}.`,
  ];
  for (const update of UPDATES) for (const cam of CAMERAS) {
    const as = approachesFor(cam);
    lines.push('', `**${update}, camera ${cam}**: main thread / all threads / untraced frame interval, median [spread of all threads]`, '',
      `| glyphs | ${as.join(' | ')} |`, `|---:|${as.map(() => '---:').join('|')}|`);
    for (const glyphs of GLYPHS) {
      const row = as.map((approach) => {
        const ss = of({ approach, glyphs, update, camera: cam });
        const tot = ss.map((s) => s.perFrame.total);
        return `${fmt(med(ss.map((s) => s.perFrame.main)))} / ${fmt(med(tot))} / ${fmt(med(ss.map((s) => s.freeIntervalMs)), 5)} [${fmt(spread(tot), 4)}]`;
      });
      lines.push(`| ${String(glyphs).padStart(4)} | ${row.join(' | ')} |`);
    }
  }
  console.log(lines.join('\n'));

  expect(errors).toEqual([]);
  expect(paintFailures, 'a cell that paints nothing measures free').toEqual([]);
  expect(samples.length).toBe(plan.length);

  run.machine({ glRenderer: String(glRenderer), browser: `${browserName} ${browser.version()}` });
  const cells: Cell[] = [{ approach: 'none', glyphs: 0, update: 'static', camera: 'fixed' }];
  for (const c of configs) for (const approach of approachesFor(c.camera)) cells.push({ ...c, approach });
  const KEYS = ['main', 'script', 'style', 'layout', 'paint', 'otherMain', 'compositor', 'raster', 'gpuProcess', 'total'] as const;
  for (const c of cells) {
    const ss = of(c);
    const stat = `median of ${ss.length} traced windows of ${FRAMES} frames`;
    const metrics: Record<string, ReturnType<typeof metric>> = {};
    for (const k of KEYS) {
      const xs = ss.map((s) => +s.perFrame[k].toFixed(4));
      metrics[k] = metric(med(xs), 'ms', `${stat}, per frame`, xs);
    }
    metrics.totalSpread = metric(spread(ss.map((s) => s.perFrame.total)), 'ms', `max - min of total across ${ss.length} samples`);
    const iv = ss.map((s) => +s.intervalMs.toFixed(3));
    metrics.frameInterval = metric(med(iv), 'ms', `${stat}, mean rAF interval while tracing`, iv);
    const fiv = ss.map((s) => +s.freeIntervalMs.toFixed(3));
    metrics.untracedFrameInterval = metric(med(fiv), 'ms', `median of ${ss.length} untraced windows of ${FRAMES} frames, mean rAF interval`, fiv);
    const fm = ss.map((s) => s.freeMissed);
    metrics.untracedMissed = metric(med(fm), 'count', `median of ${ss.length} untraced windows of ${FRAMES} frames, intervals over 25 ms`, fm);
    metrics.longFrames = metric(med(ss.map((s) => s.longFrames)), 'count', `${stat}, intervals over 1.5x the median`);
    const gt = ss.map((s) => s.gpuTimeMs).filter((x): x is number => x !== null);
    if (gt.length) metrics.gpuTime = metric(med(gt), 'ms', `${stat}, EXT_disjoint_timer_query of the canvas render`, gt);
    const id = c.approach === 'none' ? 'none' : `${c.approach} ${c.glyphs} ${c.update} ${c.camera}`;
    const loads = ss.map((s) => +s.load1.toFixed(2));
    metrics.load1 = metric(med(loads), 'load', 'median 1-minute load average as each sample finished', loads);
    run.item(id, metrics, { ...c });
  }
  run.write();
});
