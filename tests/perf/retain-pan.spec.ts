/**
 * What a frame of a pan costs with unchanged world layers retained through
 * it, against submitting them, at `N` layers of `M` commands each.
 *
 *   - `control`     — the live layer alone.
 *   - `submitPan`   — plus `N` world-space layers whose `deps` never change,
 *                     retaining off, under a view panning 1 CSS px a frame.
 *                     What a pan cost before retained surfaces moved with it:
 *                     a moving view stopped every world layer retaining.
 *   - `retainedPan` — the same layers retained, panning 1 CSS px a frame
 *                     (2 device px): each surface composites moved, and is
 *                     drawn again only when the pan runs past its margin.
 *   - `retainedFrac`— retained, panning 0.37 CSS px a frame: every move is a
 *                     fraction of a device pixel, so every layer is drawn
 *                     straight through, its surface kept.
 *   - `retainedFixed` — retained, panning 1 CSS px a frame, each layer also
 *                     holding a gradient in screen units, which does not move
 *                     with the view: every layer is drawn straight through.
 *   - `retainedStill` — retained under a still view, for reference.
 *   - `retainedRedraw` — retained, the view jumping 170 CSS px and back each
 *                     frame, past the margin either way: every surface is
 *                     drawn again with its margin every frame. What a frame
 *                     that redraws costs, and the scratch buffer at its
 *                     largest.
 *
 * The layers' content spans twice the canvas each way, so a surface really
 * does run out of margin and draw again. Each sample is one frame; the raw
 * samples are kept, so the redraw frames hidden by a median are in the
 * result. `WEASEL_PERF_LAYERS` and `WEASEL_PERF_CMDS` override the ladders,
 * `WEASEL_PERF_TILE` the scratch buffer's tile side (`none` draws every
 * surface whole), and `WEASEL_PERF_BUDGET` the retain budget in MiB. Each cell
 * also records the most GPU memory retained surfaces held at the end of a
 * frame, as the renderer counts its allocations.
 * This reports; it does not gate.
 */
import { test, expect } from '@playwright/test';
import { isolate } from './lib/isolate';
import { metric, rounds, startRun } from './lib/result';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** A Retina laptop's canvas: a 2560x1600 drawing buffer. */
const W = 1280;
const H = 800;
const DPR = 2;

const ladder = (env: string | undefined, fallback: number[]) =>
  env?.split(',').map(Number).filter((n) => n >= 1) ?? fallback;
const LAYERS = ladder(process.env.WEASEL_PERF_LAYERS, [4, 16]);
const CMDS = ladder(process.env.WEASEL_PERF_CMDS, [300, 1000]);
const RUNS = rounds(3);
const TILE = process.env.WEASEL_PERF_TILE === 'none' ? Infinity : Number(process.env.WEASEL_PERF_TILE) || undefined;
const BUDGET = Number(process.env.WEASEL_PERF_BUDGET) * 1024 * 1024 || undefined;

const VARIANTS = ['control', 'submitPan', 'retainedPan', 'retainedFrac', 'retainedFixed', 'retainedStill', 'retainedRedraw'] as const;
type Variant = (typeof VARIANTS)[number];
/** CSS px the view moves a frame; `retainedRedraw`'s moves there and back. */
const STEP: Record<Variant, number> = {
  control: 1, submitPan: 1, retainedPan: 1, retainedFrac: 0.37, retainedFixed: 1, retainedStill: 0, retainedRedraw: 170,
};

interface Cell {
  run: number; layers: number; cmds: number; variant: Variant;
  perFrameMs: number; meanMs: number; maxMs: number; samples: number[]; cpuMs: number;
  composited: number; redrawn: number; declined: number; peakBytes: number;
}

test.setTimeout(3_600_000);

test('retained layers through a pan', async ({ page, browser, browserName }) => {
  const run = startRun('retain-pan', {
    viewport: `${W}x${H}`, dpr: DPR, layers: LAYERS, cmds: CMDS, runs: RUNS, step: STEP,
    tile: TILE === Infinity ? 'none' : TILE ?? 'default', budgetMiB: BUDGET ? BUDGET / 1024 / 1024 : 'default',
  });
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  const cells: Cell[] = [];
  const total = LAYERS.length * CMDS.length * VARIANTS.length * RUNS;
  await page.exposeFunction('__panReport', (msg: unknown) => {
    const m = msg as { type: string } & Record<string, unknown>;
    if (m.type === 'header') {
      run.params({ gcAvailable: Boolean(m.gcAvailable) });
      console.log(`\nRetained pan — ${W}x${H} at dpr ${DPR}, on ${String(m.glRenderer)}; ${total} cells\n`);
      return;
    }
    const c = m as unknown as Cell & { index: number };
    cells.push(c);
    console.log(
      `  ${String(c.index).padStart(3)}/${total}  run ${c.run}  ${String(c.layers).padStart(2)} x ${String(c.cmds).padStart(4)}`
      + `  ${c.variant.padEnd(13)} ${c.perFrameMs.toFixed(3).padStart(8)} ms/frame  mean ${c.meanMs.toFixed(3).padStart(8)}`
      + `  max ${c.maxMs.toFixed(3).padStart(8)}  cpu ${c.cpuMs.toFixed(3).padStart(7)}`
      + `  kept ${String(c.composited).padStart(4)} redrawn ${String(c.redrawn).padStart(3)} through ${String(c.declined).padStart(4)}`
      + `  peak ${(c.peakBytes / 1024 / 1024).toFixed(1).padStart(6)} MiB`,
    );
  });

  await isolate(page);
  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { glRenderer } = await page.evaluate(
    async ({ root, w, h, dpr, layerLadder, cmdLadder, runs, variants, steps, tile, budget }) => {
      const report = (globalThis as unknown as { __panReport: (m: unknown) => Promise<void> }).__panReport;
      const base = `/weasel/@fs${root}`;
      const { WeaselRenderer, registerFont } = await import(/* @vite-ignore */ `${base}/packages/renderer/src/index.ts`);
      const { drawLayers } = await import(/* @vite-ignore */ `${base}/packages/core/src/core/layers/render.ts`);
      const { makeKindBuilders, imageBitmaps } = await import(/* @vite-ignore */ `${base}/tests/perf/lib/kinds.ts`);
      const { timeInterleaved } = await import(/* @vite-ignore */ `${base}/tests/perf/lib/frameTiming.ts`);
      await registerFont('sans-serif', { weight: 400, style: 'normal' }, '/weasel/inter/inter.json', '/weasel/inter/inter.png');

      let glRenderer = '';
      function freshContext(): { gl: WebGL2RenderingContext; canvas: HTMLCanvasElement } {
        const canvas = document.createElement('canvas');
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
        if (!gl) throw new Error('no WebGL2 context');
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        glRenderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
        return { gl, canvas };
      }
      freshContext();

      // Laid out over twice the canvas each way, then moved so it centers on it.
      const kinds = makeKindBuilders({ W: 2 * w, H: 2 * h, bitmaps: await imageBitmaps(6), pattern: { id: 'unused' }, shader: null });
      /** Half solid, a third text, the rest image: no screen-unit paint, which
       *  would keep a layer from moving with the view. */
      const leaf = (i: number): unknown => {
        const k = i % 6;
        return k < 3 ? kinds.solid(i) : k < 5 ? kinds.text(i) : kinds.image(i);
      };
      const centered = new Float32Array([1, 0, 0, 0, 1, 0, -w / 2, -h / 2, 1]);

      interface Layer { id: string; label: string; draw: () => unknown[]; deps?: () => readonly unknown[]; retain?: boolean }
      let tick = 0;
      const live: Layer = {
        id: 'live', label: 'live',
        draw: () => [{ kind: 'path', path: { kind: 'rect', x: 40 + (tick++ % 200), y: 40, width: 24, height: 24 }, fill: { paint: { kind: 'solid', color: '#e02040' } } }],
      };
      const constDeps = [1] as const;
      function stackFor(variant: string, n: number, m: number): Layer[] {
        const out: Layer[] = [];
        if (variant !== 'control') {
          for (let l = 0; l < n; l++) {
            const children = Array.from({ length: m }, (_, j) => leaf(l * 7919 + j));
            if (variant === 'retainedFixed') children.push(kinds.gradient(l));
            const cmds = [{ kind: 'group', transform: centered, children }];
            out.push({ id: `L${l}`, label: `L${l}`, draw: () => cmds, deps: () => constDeps, retain: variant.startsWith('retained') });
          }
        }
        out.push(live);
        return out;
      }

      const collect = (globalThis as { gc?: (opts?: unknown) => void }).gc;
      await report({ type: 'header', glRenderer, gcAvailable: typeof collect === 'function' });

      let index = 0;
      for (let r = 1; r <= runs; r++) {
        for (const n of layerLadder) {
          for (const m of cmdLadder) {
            const { gl, canvas } = freshContext();
            const stacks = new Map<string, { layers: Layer[]; cache: Map<string, unknown>; renderer: InstanceType<typeof WeaselRenderer>; x: number }>();
            for (const v of variants) {
              const renderer = new WeaselRenderer(v === 'control' ? { gl, canvas, width: w, height: h, dpr } : { gl, width: w, height: h, dpr, retainBudget: budget ?? undefined });
              // The renderer's own store; the tile side is not public API.
              if (tile !== null) (renderer as unknown as { retained: { tile: number } }).retained.tile = tile === 'none' ? Infinity : tile;
              stacks.set(v, { layers: stackFor(v, n, m), cache: new Map(), renderer, x: 0 });
            }
            const totals: Record<string, { composited: number; redrawn: number; declined: number; peakBytes: number }> = {};
            const frame = (v: string) => {
              const s = stacks.get(v)!;
              s.x = v === 'retainedRedraw' ? (s.x === 0 ? steps[v] : 0) : s.x + steps[v];
              const view = { x: s.x, y: 0, scale: { x: 1, y: 1 } };
              const viewMatrix = new Float32Array([1, 0, 0, 0, 1, 0, -view.x, -view.y, 1]);
              const policy = v.startsWith('retained') ? undefined : false;
              s.renderer.render(drawLayers(s.layers, null, {}, undefined, view, { width: w, height: h }, s.cache, undefined, undefined, undefined, policy), viewMatrix);
            };
            for (const v of variants) { frame(v); frame(v); frame(v); }
            gl.finish();
            if (collect) collect({ type: 'major', execution: 'sync' });
            const cpu: Record<string, number[]> = {};
            const timed = await timeInterleaved(gl, variants.map((v: string) => {
              cpu[v] = [];
              totals[v] = { composited: 0, redrawn: 0, declined: 0, peakBytes: 0 };
              return {
                id: v,
                frame: () => frame(v),
                after: () => {
                  const st = stacks.get(v)!.renderer.lastFrameStats();
                  cpu[v].push(st.ms);
                  totals[v].composited += st.retained.composited;
                  totals[v].redrawn += st.retained.redrawn;
                  totals[v].declined += st.retained.declined;
                  totals[v].peakBytes = Math.max(totals[v].peakBytes, st.retained.bytes);
                },
              };
            }));
            for (const v of variants) {
              index += 1;
              const c = [...cpu[v]].sort((a, b) => a - b);
              const net = timed[v].samples;
              await report({
                type: 'cell', index, run: r, layers: n, cmds: m, variant: v,
                perFrameMs: +timed[v].net.toFixed(4),
                meanMs: +(net.reduce((a, b) => a + b, 0) / net.length).toFixed(4),
                maxMs: +Math.max(...net).toFixed(4),
                samples: net.map((x) => +x.toFixed(4)),
                cpuMs: +c[Math.floor(c.length / 2)].toFixed(4),
                ...totals[v],
              });
            }
            for (const st of stacks.values()) st.renderer.dispose();
            gl.getExtension('WEBGL_lose_context')?.loseContext();
          }
        }
      }
      return { glRenderer };
    },
    {
      root: repoRoot, w: W, h: H, dpr: DPR, layerLadder: LAYERS, cmdLadder: CMDS, runs: RUNS, variants: [...VARIANTS], steps: STEP,
      tile: TILE === Infinity ? 'none' as const : TILE ?? null, budget: BUDGET ?? null,
    },
  );

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([]);
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const of = (n: number, m: number, v: Variant) => cells.filter((c) => c.layers === n && c.cmds === m && c.variant === v);
  const f = (x: number, width: number) => x.toFixed(3).padStart(width);
  const lines = [
    '', `Retained pan — ${W}x${H} at dpr ${DPR}, on ${glRenderer}`,
    `ms per frame, median of ${RUNS} runs of the median single-frame sample less the least frame that draws.`, '',
    '| layers | cmds | control | submit pan | retained pan | retained frac | retained fixed | retained still | retained redraw | pan / submit | peak MiB, redraw |',
    '|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  run.machine({ glRenderer, browser: `${browserName} ${browser.version()}` });
  const stat = `median of ${RUNS} runs; each the median of 40 single-frame samples less the least frame that draws (lib/frameTiming.ts)`;
  for (const n of LAYERS) {
    for (const m of CMDS) {
      const at = (v: Variant) => med(of(n, m, v).map((c) => c.perFrameMs));
      lines.push(`| ${String(n).padStart(2)} | ${String(m).padStart(4)} | ${f(at('control'), 7)} | ${f(at('submitPan'), 7)}`
        + ` | ${f(at('retainedPan'), 7)} | ${f(at('retainedFrac'), 7)} | ${f(at('retainedFixed'), 7)} | ${f(at('retainedStill'), 7)}`
        + ` | ${f(at('retainedRedraw'), 7)} | ${f(at('retainedPan') / at('submitPan'), 6)}`
        + ` | ${(Math.max(...of(n, m, 'retainedRedraw').map((c) => c.peakBytes)) / 1024 / 1024).toFixed(1).padStart(6)} |`);
      const items: Record<string, ReturnType<typeof metric>> = {};
      for (const v of VARIANTS) {
        const cs = of(n, m, v);
        items[`${v}PerFrame`] = metric(at(v), 'ms', stat, cs.map((c) => c.perFrameMs));
        items[`${v}Mean`] = metric(med(cs.map((c) => c.meanMs)), 'ms', `median of ${RUNS} runs of the mean frame, sync included`, cs.map((c) => c.meanMs));
        items[`${v}Max`] = metric(Math.max(...cs.map((c) => c.maxMs)), 'ms', `slowest single frame across ${RUNS} runs, sync included`, cs.flatMap((c) => c.samples));
        items[`${v}Cpu`] = metric(med(cs.map((c) => c.cpuMs)), 'ms', `median of ${RUNS} runs of the median renderer.render() time`, cs.map((c) => c.cpuMs));
        items[`${v}Redrawn`] = metric(cs.reduce((a, c) => a + c.redrawn, 0), 'count', `layer surfaces drawn over every timed frame of ${RUNS} runs`);
        items[`${v}Composited`] = metric(cs.reduce((a, c) => a + c.composited, 0), 'count', `layer surfaces composited over every timed frame of ${RUNS} runs`);
        items[`${v}Through`] = metric(cs.reduce((a, c) => a + c.declined, 0), 'count', `layers drawn straight through over every timed frame of ${RUNS} runs`);
        items[`${v}PeakBytes`] = metric(Math.max(...cs.map((c) => c.peakBytes)), 'bytes', `most GPU memory retained surfaces held at the end of a timed frame, scratch included, across ${RUNS} runs`, cs.map((c) => c.peakBytes));
      }
      run.item(`${n}x${m}`, items, { layers: n, cmds: m });
    }
  }
  console.log(lines.join('\n'));
  run.write();
});
