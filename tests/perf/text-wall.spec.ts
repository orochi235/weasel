/**
 * A wall of static text under a still and a moving camera: what the renderer costs a frame as
 * the glyph count grows, measured the way astv's stage bench measures its own (`packages/bench`
 * there), so the two can be read against each other.
 *
 * Every rung fills one 1600x1000 viewport, the font shrinking as the count grows, so the painted
 * area stays put and only the glyph count moves. The text is random printable ASCII with no
 * spaces, so every character is a glyph. Two layouts:
 *
 *   - `line`  — one text command per 80-glyph line, as a code view would emit.
 *   - `block` — 64 text commands, each a block of newline-separated lines, as astv's 64 cards.
 *
 * Each layout draws as plain `text` commands, or as one `layer` holding them (`text-layer`,
 * whose glyphs stay on the GPU as instances).
 *
 * `moving` zooms and pans the view matrix every frame; the commands are built once and never
 * change, so a frame is the renderer's walk of unchanged text and nothing a scene graph adds.
 *
 * A frame is timed as astv's are: CPU is `performance.now()` around `render`, on a
 * requestAnimationFrame loop, and GPU is `EXT_disjoint_timer_query_webgl2` over the same window.
 *
 * Knobs: `WEASEL_PERF_GLYPHS` (the ladder), `WEASEL_PERF_LAYOUTS`, `WEASEL_PERF_DRAWS`, `WEASEL_PERF_MOTIONS`, and
 * `WEASEL_PERF_PROFILE=1`, which records a CPU profile of each cell's measured frames (warmup
 * left out) beside `WEASEL_PERF_OUT` as `text-wall-<cell>.cpuprofile`.
 *
 * This reports; it does not gate. See `tests/perf/README.md`.
 */
import { test, expect } from '@playwright/test';
import { isolate } from './lib/isolate';
import { metric, startRun } from './lib/result';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const W = 1600;
const H = 1000;
const WARMUP = 20;
const MEASURE = 90;
/** A rung far past the frame budget can take seconds a frame; it stops here and reports what it got. */
const MAX_MS = 20_000;

const list = (raw: string | undefined): string[] | undefined =>
  raw?.split(',').map((x) => x.trim()).filter(Boolean);

const GLYPHS = list(process.env.WEASEL_PERF_GLYPHS)?.map(Number) ?? [5_000, 20_000, 80_000, 320_000, 1_280_000];
const LAYOUTS = list(process.env.WEASEL_PERF_LAYOUTS) ?? ['line', 'block'];
const MOTIONS = list(process.env.WEASEL_PERF_MOTIONS) ?? ['still', 'moving'];
const DRAWS = list(process.env.WEASEL_PERF_DRAWS) ?? ['text', 'layer'];
const PROFILE = process.env.WEASEL_PERF_PROFILE === '1';

interface Cell { glyphs: number; layout: string; draw: string; motion: string }
interface Measured {
  glyphs: number;
  commands: number;
  fontPx: number;
  frames: number;
  /** CPU of the first frame, which lays the wall out and builds a layer. */
  firstMs: number;
  truncated: boolean;
  cpu: number[];
  gpu: number[];
  paints: boolean;
  /** Per measured frame: draw calls, and bytes written to GL buffers. */
  drawCalls: number[];
  uploaded: number[];
  /** Between consecutive measured frames' starts: what a viewer sees, CPU and GPU together. */
  intervals: number[];
  /** Render and a one-pixel readback, which waits for the GPU. */
  synced: number[];
}

test.setTimeout(1_800_000);

test('text wall: frame cost of static text against glyph count', async ({ page, browser, browserName }) => {
  const run = startRun('text-wall', {
    viewport: `${W}x${H}`, dpr: 1, warmup: WARMUP, measure: MEASURE, maxMs: MAX_MS,
    glyphs: GLYPHS, layouts: LAYOUTS, draws: DRAWS, motions: MOTIONS,
  });
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  await isolate(page);
  const cdp = PROFILE ? await page.context().newCDPSession(page) : null;
  if (cdp) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  }
  await page.exposeFunction('__textWallProfile', async (on: boolean) => {
    if (!cdp) return;
    if (on) await cdp.send('Profiler.start');
    else profiled = (await cdp.send('Profiler.stop')).profile;
  });
  let profiled: unknown = null;
  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { glRenderer, gpuTimer } = await page.evaluate(async ({ root, w, h }) => {
    const { WeaselRenderer, registerFont, textCommandFromRuns } = await import(
      /* @vite-ignore */ `/weasel/@fs${root}/packages/renderer/src/index.ts`
    );
    await registerFont('sans-serif', { weight: 400, style: 'normal' }, '/weasel/inter/inter.json', '/weasel/inter/inter.png');

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
    if (!gl) throw new Error('no WebGL2 context');
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const glRenderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2') as
      { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
    const renderer = new WeaselRenderer({ gl, canvas, width: w, height: h, dpr: 1 });
    // Bytes the frame writes into GL buffers, counted at the context.
    let uploadedBytes = 0;
    const g = gl as unknown as Record<string, (...a: unknown[]) => unknown>;
    for (const name of ['bufferSubData', 'bufferData'] as const) {
      const orig = g[name].bind(gl);
      g[name] = (...a: unknown[]) => {
        const src = a[name === 'bufferSubData' ? 2 : 1];
        const len = a[4];
        if (ArrayBuffer.isView(src)) {
          const el = (src as unknown as { BYTES_PER_ELEMENT?: number }).BYTES_PER_ELEMENT ?? 1;
          uploadedBytes += typeof len === 'number' && len > 0 ? len * el : src.byteLength;
        }
        return orig(...a);
      };
    }

    const COLS = 80;
    const INK = { paint: { kind: 'solid' as const, color: '#e8e8e8' } };
    const BLOCKS = 64;
    let seed = 1;
    const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
    const line = () => {
      let s = '';
      for (let i = 0; i < COLS; i++) s += String.fromCharCode(33 + Math.floor(rand() * 94));
      return s;
    };

    /** Lines of `COLS` glyphs in columns across the viewport, sized so `n` of them fill it. */
    function wall(n: number, layout: string) {
      seed = 1;
      const lines = Math.max(1, Math.round(n / COLS));
      const fontPx = Math.sqrt((w * h) / (0.62 * 1.25 * lines * COLS));
      const colW = COLS * 0.62 * fontPx + fontPx;
      const cols = Math.max(1, Math.floor(w / colW));
      const perCol = Math.ceil(lines / cols);
      const lead = h / perCol;
      const style = { fontSize: fontPx, fontFamily: 'sans-serif', lineHeight: lead / fontPx };
      const commands: unknown[] = [];
      if (layout === 'line') {
        for (let i = 0; i < lines; i++) {
          commands.push(textCommandFromRuns((i / perCol | 0) * colW, (i % perCol) * lead, [{ text: line(), fill: INK }], style));
        }
      } else {
        // Contiguous runs of a column's lines, so a block is a card's worth of text.
        const perBlock = Math.ceil(lines / BLOCKS);
        for (let b = 0; b * perBlock < lines; b++) {
          const first = b * perBlock;
          const count = Math.min(perBlock, lines - first);
          const rows: string[] = [];
          for (let k = 0; k < count; k++) rows.push(line());
          commands.push(textCommandFromRuns(
            (first / perCol | 0) * colW, (first % perCol) * lead, [{ text: rows.join('\n'), fill: INK }], style,
          ));
        }
      }
      return { commands, glyphs: lines * COLS, fontPx };
    }

    const view = (f: number, moving: boolean) => {
      if (!moving) return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
      const t = f * 0.05;
      const z = 1 + 0.1 * Math.sin(t);
      const tx = (w / 2) * (1 - z) + 20 * Math.sin(t * 0.7);
      const ty = (h / 2) * (1 - z) + 15 * Math.cos(t * 0.9);
      return new Float32Array([z, 0, 0, 0, z, 0, tx, ty, 1]);
    };

    const px = new Uint8Array(w * h * 4);
    const paints = () => {
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (let p = 3; p < px.length; p += 4) if (px[p] !== 0) return true;
      return false;
    };

    (globalThis as Record<string, unknown>).__textWall = async (
      cell: { glyphs: number; layout: string; draw: string; motion: string },
      opts: { warmup: number; measure: number; maxMs: number; profile: boolean },
    ) => {
      const built = wall(cell.glyphs, cell.layout);
      const { glyphs, fontPx } = built;
      const commands = cell.draw === 'layer' ? [{ kind: 'text-layer', texts: built.commands }] : built.commands;
      const moving = cell.motion === 'moving';
      // The atlas page reaches the GPU a few frames after its first use.
      let painted = false;
      let firstMs = NaN;
      for (let k = 0; k < 60 && !painted; k++) {
        const t0 = performance.now();
        renderer.render(commands, view(0, false));
        if (k === 0) firstMs = performance.now() - t0;
        painted = paints();
        if (!painted) await new Promise((r) => setTimeout(r, 50));
      }
      const cpu: number[] = [];
      const gpu: number[] = [];
      const drawCalls: number[] = [];
      const intervals: number[] = [];
      let last = NaN;
      const uploaded: number[] = [];
      const mark = (globalThis as unknown as { __textWallProfile: (on: boolean) => Promise<void> }).__textWallProfile;
      const pending: { q: WebGLQuery; measured: boolean }[] = [];
      const collect = () => {
        while (pending.length) {
          const { q, measured } = pending[0];
          if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
          pending.shift();
          const disjoint = timer && gl.getParameter(timer.GPU_DISJOINT_EXT);
          if (measured && !disjoint) gpu.push(Number(gl.getQueryParameter(q, gl.QUERY_RESULT)) / 1e6);
          gl.deleteQuery(q);
        }
      };
      const started = performance.now();
      let f = 0;
      await new Promise<void>((done) => {
        const tick = async () => {
          if (opts.profile && f === opts.warmup) await mark(true);
          const measured = f >= opts.warmup;
          uploadedBytes = 0;
          const q = timer ? gl.createQuery() : null;
          if (q && timer) gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
          const t0 = performance.now();
          renderer.render(commands, view(f, moving));
          const t1 = performance.now();
          if (q && timer) { gl.endQuery(timer.TIME_ELAPSED_EXT); pending.push({ q, measured }); }
          if (measured) {
            if (!Number.isNaN(last)) intervals.push(t0 - last);
            cpu.push(t1 - t0);
            drawCalls.push(renderer.lastFrameStats().drawCalls);
            uploaded.push(uploadedBytes);
          }
          last = t0;
          collect();
          f += 1;
          if (cpu.length >= opts.measure || performance.now() - started > opts.maxMs) {
            if (opts.profile) await mark(false);
            done();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      // The last queries land a frame or two late.
      for (let k = 0; k < 10 && pending.length; k++) {
        await new Promise((r) => requestAnimationFrame(r));
        collect();
      }
      // A one-pixel readback waits for the GPU, so this is the frame's CPU and GPU end to end. The
      // timer query alone is not that: under ANGLE's Metal backend it has read a draw at 187 ms
      // while frames came every 16.8 ms.
      const synced: number[] = [];
      const one = new Uint8Array(4);
      for (let k = 0; k < Math.min(30, opts.measure); k++) {
        const t0 = performance.now();
        renderer.render(commands, view(f + k, moving));
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one);
        synced.push(performance.now() - t0);
      }
      return {
        glyphs, commands: built.commands.length, fontPx, frames: cpu.length, firstMs,
        truncated: cpu.length < opts.measure, cpu, gpu, paints: painted, drawCalls, uploaded, intervals, synced,
      };
    };
    return { glRenderer, gpuTimer: !!timer };
  }, { root: repoRoot, w: W, h: H });

  console.log(`GL renderer: ${glRenderer}${gpuTimer ? '' : ' (no timer query: GPU column empty)'}`);
  run.machine({ glRenderer, browser: `${browserName} ${browser.version()}` });

  const cells: Cell[] = GLYPHS.flatMap((glyphs) =>
    LAYOUTS.flatMap((layout) => DRAWS.flatMap((draw) => MOTIONS.map((motion) => ({ glyphs, layout, draw, motion })))));
  const q = (xs: number[], p: number) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN;
  };

  let i = 0;
  for (const cell of cells) {
    i += 1;
    const m = await page.evaluate(
      ({ cell, opts }) => (globalThis as any).__textWall(cell, opts) as Promise<Measured>,
      { cell, opts: { warmup: WARMUP, measure: MEASURE, maxMs: MAX_MS, profile: PROFILE } },
    );
    if (PROFILE && profiled) {
      const out = process.env.WEASEL_PERF_OUT ?? 'tests/perf/results';
      const dir = out.endsWith('.json') ? dirname(out) : out;
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `text-wall-${cell.layout}-${cell.draw}-${cell.motion}-${cell.glyphs}.cpuprofile`), JSON.stringify(profiled));
      profiled = null;
    }
    expect(m.paints, `${cell.layout} n=${cell.glyphs} painted nothing`).toBe(true);
    const cpu50 = q(m.cpu, 0.5);
    const cpu95 = q(m.cpu, 0.95);
    const gpu50 = q(m.gpu, 0.5);
    const metrics: Record<string, ReturnType<typeof metric>> = {
      cpuP50: metric(cpu50, 'ms', `p50 of ${m.frames} frames`, m.cpu),
      cpuP95: metric(cpu95, 'ms', `p95 of ${m.frames} frames`),
      drawCalls: metric(q(m.drawCalls, 0.5), 'count', 'p50 draw calls a frame', m.drawCalls),
      uploadedMB: metric(q(m.uploaded, 0.5) / 1e6, 'MB', 'p50 bytes written to GL buffers a frame', m.uploaded),
      firstMs: metric(m.firstMs, 'ms', 'CPU of the first frame, which lays the wall out and builds a layer'),
      frameP50: metric(q(m.intervals, 0.5), 'ms', 'p50 interval between frames', m.intervals),
      syncedP50: metric(q(m.synced, 0.5), 'ms', 'p50 of render and a one-pixel readback, which waits for the GPU', m.synced),
    };
    if (m.gpu.length) metrics.gpuP50 = metric(gpu50, 'ms', `p50 of ${m.gpu.length} timer queries`, m.gpu);
    run.item(`${cell.layout} ${cell.draw} ${cell.motion} n=${cell.glyphs}`, metrics, {
      ...cell, drawnGlyphs: m.glyphs, commands: m.commands, fontPx: m.fontPx, truncated: m.truncated,
    });
    console.log(
      `${String(i).padStart(2)}/${cells.length}  ${cell.layout.padEnd(5)} ${cell.draw.padEnd(5)} ${cell.motion.padEnd(6)} ` +
      `glyphs ${String(m.glyphs).padStart(9)}  cmds ${String(m.commands).padStart(6)}  ` +
      `cpu p50 ${cpu50.toFixed(2).padStart(8)}ms  p95 ${cpu95.toFixed(2).padStart(8)}ms  ` +
      `gpu ${(m.gpu.length ? gpu50.toFixed(2) : '-').padStart(7)}ms  ` +
      `draws ${String(q(m.drawCalls, 0.5)).padStart(4)}  up ${(q(m.uploaded, 0.5) / 1e6).toFixed(2).padStart(7)}MB  ` +
      `first ${m.firstMs.toFixed(1).padStart(7)}ms  frame ${q(m.intervals, 0.5).toFixed(1).padStart(6)}ms  synced ${q(m.synced, 0.5).toFixed(1).padStart(6)}ms` +
      `${m.truncated ? `  (stopped at ${m.frames} frames)` : ''}`,
    );
  }

  expect(errors).toEqual([]);
  run.write();
});
