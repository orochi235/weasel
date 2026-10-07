/**
 * What submitting unchanged layers costs a frame, against compositing each one
 * from a cached texture.
 *
 * `RenderLayer.deps` lets `drawLayers` reuse a layer's command tree, but the
 * reused tree still goes through `WeaselRenderer.render` every frame. Skipping
 * that would mean drawing each cached layer into a texture once and then
 * drawing one quad per layer. This prices both against a control, at `N`
 * layers of `M` commands each, none of which change between frames.
 *
 * Every variant draws one rect in a `live` layer that rebuilds each frame, so
 * the frame is never empty, and goes through the real `drawLayers` with a
 * command cache:
 *
 *   - `control`   — the live layer alone: what the frame costs without the
 *                   unchanged layers.
 *   - `submit`    — the live layer plus `N` world-space layers whose `deps`
 *                   never change, so every one is a cache hit. Today's path.
 *   - `composite` — the live layer plus `N` screen-space layers of one
 *                   canvas-sized image each, standing in for a cached layer
 *                   texture: one texture bind, one quad and a full-canvas fill
 *                   with blending per layer. It does not price re-rendering a
 *                   layer into its texture when it changes, nor the texture
 *                   memory (a 2560x1600 RGBA layer is 16 MB).
 *
 * The composite quads cycle through 8 distinct bitmaps, so neighbors always
 * rebind, without holding 64 canvas-sized textures. Each quad reads every texel
 * of a 16 MB texture once, so which of the 8 it reads does not change the cost.
 *
 * A layer's `M` commands are a mix: half solid rects, a quarter text labels,
 * 15% images from six 64px bitmaps, and 10% linear gradients (`lib/kinds.ts`).
 *
 * `WEASEL_PERF_LAYERS` and `WEASEL_PERF_CMDS` override the ladders
 * (comma-separated). This reports; it does not gate. See `tests/perf/README.md`.
 */
import { test, expect } from '@playwright/test';
import { isolate } from './lib/isolate';
import { metric, rounds, startRun } from './lib/result';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** CSS size and dpr of a Retina laptop's canvas: a 2560x1600 drawing buffer. */
const W = 1280;
const H = 800;
const DPR = 2;

const ladder = (env: string | undefined, fallback: number[]) =>
  env?.split(',').map(Number).filter((n) => n >= 1) ?? fallback;
const LAYERS = ladder(process.env.WEASEL_PERF_LAYERS, [1, 4, 16, 64]);
const CMDS = ladder(process.env.WEASEL_PERF_CMDS, [10, 100, 1000]);

const RUNS = rounds(3);

const VARIANTS = ['control', 'submit', 'composite'] as const;
type Variant = (typeof VARIANTS)[number];

interface Cell { run: number; layers: number; cmds: number; variant: Variant; perFrameMs: number; cpuMs: number }
interface Counts { layers: number; cmds: number; variant: Variant; draws: number }

test.setTimeout(3_600_000);

test('layer dispatch: unchanged layers submitted against composited', async ({ page, browser, browserName }) => {
  const run = startRun('layer-dispatch', {
    viewport: `${W}x${H}`, dpr: DPR, layers: LAYERS, cmds: CMDS, runs: RUNS,
  });
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  const cells: Cell[] = [];
  const counts: Counts[] = [];
  const total = LAYERS.length * CMDS.length * VARIANTS.length * RUNS;
  const started = Date.now();

  await page.exposeFunction('__layerReport', (msg: unknown) => {
    const m = msg as { type: string } & Record<string, unknown>;
    if (m.type === 'header') {
      run.params({ gcAvailable: Boolean(m.gcAvailable) });
      console.log('');
      console.log(`Layer dispatch — ${W}x${H} at dpr ${DPR}, on ${String(m.glRenderer)}`);
      console.log(`collected between measurements: ${String(m.gcAvailable)}`);
      console.log(`${total} cells (${LAYERS.length} layer counts x ${CMDS.length} command counts x ${VARIANTS.length} variants x ${RUNS} runs)`);
      console.log('');
      return;
    }
    if (m.type === 'calls') {
      counts.push(m as unknown as Counts);
      return;
    }
    if (m.type === 'paint') {
      if (!m.ok) errors.push(`${String(m.key)} painted nothing`);
      return;
    }
    const c = m as unknown as Cell & { index: number };
    cells.push({ run: c.run, layers: c.layers, cmds: c.cmds, variant: c.variant, perFrameMs: c.perFrameMs, cpuMs: c.cpuMs });
    console.log(
      `  ${String(c.index).padStart(3)}/${total}  run ${c.run}  `
      + `${String(c.layers).padStart(2)} x ${String(c.cmds).padStart(4)}  ${c.variant.padEnd(9)}`
      + ` ${c.perFrameMs.toFixed(3).padStart(8)} ms/frame  cpu ${c.cpuMs.toFixed(3).padStart(7)} ms`
      + `  ${((Date.now() - started) / 1000).toFixed(0).padStart(5)} s`,
    );
  });

  await isolate(page);
  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { glRenderer } = await page.evaluate(
    async ({ root, w, h, dpr, layerLadder, cmdLadder, runs, variants }) => {
      const report = (globalThis as unknown as {
        __layerReport: (m: unknown) => Promise<void>;
      }).__layerReport;

      // One import of the renderer barrel, so the font registry the renderer
      // reads is the one written here; `render.ts` reaches the same module.
      const base = `/weasel/@fs${root}`;
      const { WeaselRenderer, registerFont } = await import(/* @vite-ignore */ `${base}/packages/core/src/renderer/index.ts`);
      const { drawLayers } = await import(/* @vite-ignore */ `${base}/packages/core/src/core/layers/render.ts`);
      const { makeKindBuilders, imageBitmaps } = await import(/* @vite-ignore */ `${base}/tests/perf/lib/kinds.ts`);
      const { timeInterleaved } = await import(/* @vite-ignore */ `${base}/tests/perf/lib/frameTiming.ts`);

      await registerFont(
        'sans-serif', { weight: 400, style: 'normal' },
        '/weasel/inter/inter.json', '/weasel/inter/inter.png',
      );

      const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
      const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
      const dims = { width: w, height: h };

      let glRenderer = '';
      /** A fresh context per cell, as `frame-budget` does, so no cell inherits
       *  another's caches or GL state. Not attached to the document. */
      function freshContext(): { gl: WebGL2RenderingContext; canvas: HTMLCanvasElement } {
        const canvas = document.createElement('canvas');
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
        if (!gl) throw new Error('no WebGL2 context');
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        glRenderer = String(dbg
          ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER));
        return { gl, canvas };
      }
      freshContext();

      const kinds = makeKindBuilders({
        W: w, H: h, bitmaps: await imageBitmaps(6),
        // The mix uses neither; the builders want them.
        pattern: { id: 'unused' }, shader: null,
      });
      /** Half solid, a quarter text, 15% image, 10% gradient. */
      const leaf = (i: number): unknown => {
        const k = i % 20;
        if (k < 10) return kinds.solid(i);
        if (k < 15) return kinds.text(i);
        if (k < 18) return kinds.image(i);
        return kinds.gradient(i);
      };

      /** Stand-ins for cached layer textures: canvas-sized, partly transparent. */
      const layerTextures: ImageBitmap[] = [];
      for (let t = 0; t < 8; t++) {
        const oc = new OffscreenCanvas(w * dpr, h * dpr);
        const c2 = oc.getContext('2d')!;
        for (let s = 0; s < 40; s++) {
          c2.fillStyle = `hsla(${(t * 45 + s * 17) % 360}, 60%, 50%, 0.6)`;
          c2.fillRect((s * 197 + t * 61) % (w * dpr - 200), (s * 113 + t * 37) % (h * dpr - 200), 200, 200);
        }
        layerTextures.push(await createImageBitmap(oc));
      }

      /** The `RenderLayer` fields this uses; the module is imported untyped. */
      interface Layer {
        id: string;
        label: string;
        space?: 'world' | 'screen';
        draw: () => unknown[];
        deps?: () => readonly unknown[];
      }
      let tick = 0;
      const live: Layer = {
        id: 'live', label: 'live',
        // No deps: rebuilt every frame, like a cursor or a dragged node.
        draw: () => [{
          kind: 'path',
          path: { kind: 'rect', x: 40 + (tick++ % 200), y: 40, width: 24, height: 24 },
          fill: { fill: 'solid', color: '#e02040' },
        }],
      };
      const constDeps = [1] as const;

      function stackFor(variant: string, n: number, m: number): Layer[] {
        const out: Layer[] = [];
        if (variant === 'submit') {
          for (let l = 0; l < n; l++) {
            const cmds = Array.from({ length: m }, (_, j) => leaf(l * 7919 + j));
            out.push({ id: `L${l}`, label: `L${l}`, draw: () => cmds, deps: () => constDeps });
          }
        } else if (variant === 'composite') {
          for (let l = 0; l < n; l++) {
            const cmds = [{ kind: 'image', image: layerTextures[l % layerTextures.length], x: 0, y: 0, w, h }];
            out.push({ id: `L${l}`, label: `L${l}`, space: 'screen', draw: () => cmds, deps: () => constDeps });
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
            const renderer = new WeaselRenderer({ gl, canvas, width: w, height: h, dpr });
            const stacks = new Map<string, { layers: Layer[]; cache: Map<string, unknown> }>();
            for (const v of variants) stacks.set(v, { layers: stackFor(v, n, m), cache: new Map() });
            const frame = (v: string) => {
              const s = stacks.get(v)!;
              renderer.render(drawLayers(s.layers, null, {}, undefined, view, dims, s.cache), identity);
            };
            for (const v of variants) { frame(v); frame(v); }
            gl.finish();

            if (r === 1) {
              /** Pixels with any alpha: every variant draws the live rect, so
               *  the other two must cover more than the control does. */
              const covered = (): number => {
                gl.finish();
                const buf = new Uint8Array(4 * w * dpr * h * dpr);
                gl.readPixels(0, 0, w * dpr, h * dpr, gl.RGBA, gl.UNSIGNED_BYTE, buf);
                let k = 0;
                for (let p = 3; p < buf.length; p += 4) if (buf[p] !== 0) k++;
                return k;
              };
              const cover: Record<string, number> = {};
              for (const v of variants) {
                frame(v);
                await report({ type: 'calls', layers: n, cmds: m, variant: v, draws: renderer.lastFrameStats().drawCalls });
                cover[v] = covered();
              }
              for (const v of variants) {
                if (v !== 'control') await report({ type: 'paint', key: `${n}x${m} ${v}`, ok: cover[v] > cover.control });
              }
            }

            if (collect) collect({ type: 'major', execution: 'sync' });
            const cpu: Record<string, number[]> = {};
            const timed = await timeInterleaved(gl, variants.map((v: string) => {
              cpu[v] = [];
              return {
                id: v,
                frame: () => frame(v),
                after: () => { cpu[v].push(renderer.lastFrameStats().ms); },
              };
            }));
            for (const v of variants) {
              index += 1;
              const c = [...cpu[v]].sort((a, b) => a - b);
              await report({
                type: 'cell', index, run: r, layers: n, cmds: m, variant: v,
                perFrameMs: +timed[v].net.toFixed(4),
                cpuMs: +c[Math.floor(c.length / 2)].toFixed(4),
              });
            }
            renderer.dispose();
            // Each cell uploads up to 128 MB of layer textures; free them now
            // rather than whenever the browser evicts the context.
            gl.getExtension('WEBGL_lose_context')?.loseContext();
          }
        }
      }
      return { glRenderer };
    },
    {
      root: repoRoot, w: W, h: H, dpr: DPR, layerLadder: LAYERS, cmdLadder: CMDS,
      runs: RUNS, variants: [...VARIANTS],
    },
  );

  // ─── report ────────────────────────────────────────────────────────────

  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const frames = (n: number, m: number, v: Variant) =>
    cells.filter((c) => c.layers === n && c.cmds === m && c.variant === v).map((c) => c.perFrameMs);
  const cpus = (n: number, m: number, v: Variant) =>
    cells.filter((c) => c.layers === n && c.cmds === m && c.variant === v).map((c) => c.cpuMs);
  const draws = (n: number, m: number, v: Variant) =>
    counts.find((c) => c.layers === n && c.cmds === m && c.variant === v)?.draws ?? NaN;
  /** Over the control, medians. */
  const over = (n: number, m: number, v: Variant) => med(frames(n, m, v)) - med(frames(n, m, 'control'));

  const f = (x: number, width: number, d = 2) => x.toFixed(d).padStart(width);
  const lines: string[] = [
    '',
    `Layer dispatch — ${W}x${H} at dpr ${DPR}, on ${glRenderer}`,
    `median of ${RUNS} runs, ms per frame over the control (the live layer alone).`,
    '"cpu" is the renderer\'s own render() time; "draws" counts draw calls.',
    '',
    '| layers | cmds | control | submit | composite | submit cpu | composite cpu | draws s / c | composite / submit |',
    '|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const n of LAYERS) {
    for (const m of CMDS) {
      const s = over(n, m, 'submit');
      const c = over(n, m, 'composite');
      lines.push(
        `| ${String(n).padStart(2)} | ${String(m).padStart(4)} | ${f(med(frames(n, m, 'control')), 6, 3)}`
        + ` | ${f(s, 7, 3)} | ${f(c, 7, 3)} | ${f(med(cpus(n, m, 'submit')), 7, 3)} | ${f(med(cpus(n, m, 'composite')), 7, 3)}`
        + ` | ${String(draws(n, m, 'submit')).padStart(4)} / ${String(draws(n, m, 'composite')).padStart(3)}`
        + ` | ${f(c / s, 6, 2)} |`,
      );
    }
  }
  lines.push('');
  console.log(lines.join('\n'));

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([]);
  // A composite frame draws one quad per layer; fewer means the layers were
  // not all drawn, and the comparison is against less work than it claims.
  for (const n of LAYERS) {
    for (const m of CMDS) expect(draws(n, m, 'composite'), `${n}x${m} composite`).toBeGreaterThanOrEqual(n);
  }

  run.machine({ glRenderer, browser: `${browserName} ${browser.version()}` });
  const stat = `median of ${RUNS} runs; each the median of 40 single-frame samples less the least frame that draws, one frame a task (lib/frameTiming.ts)`;
  for (const n of LAYERS) {
    for (const m of CMDS) {
      const items: Record<string, ReturnType<typeof metric>> = {};
      for (const v of VARIANTS) {
        const fr = frames(n, m, v);
        items[`${v}PerFrame`] = metric(med(fr), 'ms', stat, fr);
        items[`${v}Cpu`] = metric(med(cpus(n, m, v)), 'ms', `median of ${RUNS} runs of the median renderer.render() time`, cpus(n, m, v));
        items[`${v}DrawCalls`] = metric(draws(n, m, v), 'count', 'one untimed frame');
      }
      items.submitOverControl = metric(over(n, m, 'submit'), 'ms', 'medians');
      items.compositeOverControl = metric(over(n, m, 'composite'), 'ms', 'medians');
      run.item(`${n}x${m}`, items, { layers: n, cmds: m });
    }
  }
  run.write();
});
