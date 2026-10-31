/**
 * Renderer draw loop: frame cost against commands per frame, under real GL.
 *
 * The spec logs the unmasked GL renderer: a software backend (SwiftShader)
 * produces numbers that say nothing about a GPU.
 *
 * The variants:
 *   - `alternating` — solid and even-odd fill alternating. An even-odd fill
 *     whose outlines touch never joins the batched run, so every command
 *     flushes it and switches program. A pattern did this until 2026-10-30, when patterns joined the run.
 *   - `stacked` — every rect at the same spot: the same number of draw calls
 *     over a fraction of the fragments.
 *   - `scene` — each command in its own group, which is what `buildSceneTree`
 *     emits and therefore what the app actually renders.
 *
 * Each cell is the median of single frames, one per task, the way a frame loop
 * draws them (`lib/frameTiming.ts`), less the least frame that reaches the GPU.
 * A cell near zero is a frame that costs about that much, and can read a few
 * hundredths of a millisecond below it.
 *
 * This reports; it does not gate. See `tests/perf/README.md`.
 */
import { test, expect } from '@playwright/test';
import { metric, startRun } from './lib/result';
import { isolate } from './lib/isolate';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Commands per frame. */
const SWEEP = [{ n: 100 }, { n: 400 }, { n: 1600 }, { n: 3200 }];

const VARIANTS = ['solid', 'alternating', 'stacked', 'scene', 'rotated', 'meshes', 'stroked'] as const;

/** Measured in this order, reported in the order above. `alternating` goes
 *  last: the cell measured right after it pays for collecting its garbage. */
const MEASURE_ORDER = ['solid', 'stacked', 'scene', 'rotated', 'meshes', 'stroked', 'alternating'] as const;

/** A batched frame of a few hundred rects costs under 0.1 ms over the least frame, so a cell is sampled until its median is known to less. */
const SETTLE = { withinMs: 0.02, maxSamples: 150 };

/** Commands in the frame whose draw calls pin what `alternating` measures. */
const PROBE_N = 100;

test.setTimeout(300_000);

test('draw loop: frame cost vs commands per frame', async ({ page, browser, browserName }) => {
  const run = startRun('draw-loop', { viewport: '800x600', dpr: 1, sweep: SWEEP, variants: [...VARIANTS] });
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  await isolate(page);
  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { rows, glRenderer, breakerPaints, draws, gcAvailable } = await page.evaluate(
    async ({ root, sweep, variants, probeN, settle }) => {
      const { WeaselRenderer } = await import(/* @vite-ignore */ `/weasel/@fs${root}/packages/renderer/src/index.ts`);
      const { frameMs } = await import(/* @vite-ignore */ `/weasel/@fs${root}/tests/perf/lib/frameTiming.ts`);

      const W = 800;
      const H = 600;
      // Not attached to the document: a composited canvas puts the
      // compositor's schedule into every measurement.
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
      if (!gl) throw new Error('no WebGL2 context');
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const glRenderer = String(dbg
        ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER));

      const renderer = new WeaselRenderer({ gl, canvas, width: W, height: H, dpr: 1 });
      const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

      const solidFill = (i: number) => ({ kind: 'solid' as const, color: i % 2 ? '#3366cc' : '#cc6633' });
      const M = 0, L = 1, Z = 4; // PathVerb
      /** A rect as an even-odd polygon, with a contour of no area along its
       *  first edge: 1026 edges back and forth along it put the fill past what the tessellator
       *  resolves (`MAX_EVENODD_RESOLVE_WORK`), so it keeps the stencil and paints itself. */
      const PAD = 1026;
      const evenOddRect = (x: number, y: number, size: number): unknown => {
        const coords = [x, y, x + size, y, x + size, y + size, x, y + size];
        for (let k = 0; k <= PAD; k++) coords.push(k % 2 ? x + size : x, y);
        return {
          kind: 'polygon',
          commands: new Uint8Array([M, L, L, L, Z, M, ...new Array(PAD).fill(L), Z]),
          coords: new Float32Array(coords),
          fillRule: 'evenodd',
        };
      };
      const breaks = (variant: string, i: number): boolean => variant === 'alternating' && i % 2 === 1;
      /** An octagon, so the command is a tessellated mesh rather than a rect.
       *  One Path object per command, built once: `getMesh` is keyed on Path
       *  identity, and rebuilding them per frame would measure tessellation. */
      const octagon = (cx: number, cy: number, r: number): unknown => {
        const coords = new Float32Array(16);
        for (let k = 0; k < 8; k++) {
          coords[k * 2] = cx + r * Math.cos((k * Math.PI) / 4);
          coords[k * 2 + 1] = cy + r * Math.sin((k * Math.PI) / 4);
        }
        return {
          kind: 'polygon',
          commands: new Uint8Array([M, L, L, L, L, L, L, L, Z]),
          coords,
        };
      };

      function build(n: number, variant: string): unknown[] {
        const out: unknown[] = [];
        for (let i = 0; i < n; i++) {
          const spread = variant !== 'stacked';
          const x = spread ? (i * 37) % (W - 40) : 10;
          const y = spread ? (i * 53) % (H - 40) : 10;
          const cmd: Record<string, unknown> = {
            kind: 'path',
            path: variant === 'meshes'
              ? octagon(x + 18, y + 18, 18)
              : breaks(variant, i) ? evenOddRect(x, y, 36) : { kind: 'rect', x, y, width: 36, height: 36 },
            fill: { paint: solidFill(i) },
          };
          if (variant === 'stroked') cmd.stroke = { width: 2, paint: { color: '#222222' } };
          if (variant === 'rotated') {
            // What `wrapNodeOutput` emits for a rotated node: its own group
            // carrying a transform, one per command.
            const t = (i % 8) * (Math.PI / 16);
            const cos = Math.cos(t);
            const sin = Math.sin(t);
            out.push({
              kind: 'group',
              transform: new Float32Array([cos, sin, 0, -sin, cos, 0, 0, 0, 1]),
              children: [cmd],
            });
          } else {
            out.push(variant === 'scene' ? { kind: 'group', children: [cmd] } : cmd);
          }
        }
        return out;
      }

      /**
       * Collects what the previous cell left behind first, so a major GC does
       * not land inside this one. The first frames at a new count pay one-off
       * costs, so more of them go untimed than `frameMs` skips by default.
       */
      async function measure(n: number, variant: string): Promise<number> {
        const cmds = build(n, variant);
        const collect = (globalThis as { gc?: (opts?: unknown) => void }).gc;
        if (collect) {
          collect({ type: 'major', execution: 'sync' });
          collect({ type: 'major', execution: 'sync' });
        }
        return frameMs(gl, () => renderer.render(cmds, identity), { warm: 10, samples: 15, settle });
      }

      /** The middle of an even-odd rect. Nothing painted would mean the fill
       *  drew nothing, which would make the switch look free. */
      function checkBreakerPaints(): boolean {
        renderer.render([{
          kind: 'path', path: evenOddRect(100, 100, 100), fill: { paint: { color: '#cc3366' } },
        }], identity);
        gl.finish();
        const px = new Uint8Array(4);
        gl.readPixels(150, H - 150, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return px[0] > 150 && px[3] > 200;
      }

      const drawsFor = (variant: string): number => {
        renderer.render(build(probeN, variant), identity);
        return renderer.lastFrameStats().drawCalls;
      };

      const paints = checkBreakerPaints();
      const draws = { solid: drawsFor('solid'), alternating: drawsFor('alternating') };
      const rows: Array<{ variant: string; n: number; perFrameMs: number; usPerCmd: number }> = [];
      for (const variant of variants) {
        for (const { n } of sweep) {
          const perFrameMs = await measure(n, variant);
          rows.push({
            variant,
            n,
            perFrameMs: +perFrameMs.toFixed(3),
            usPerCmd: +((perFrameMs * 1000) / n).toFixed(2),
          });
        }
      }
      return {
        rows, glRenderer, breakerPaints: paints, draws,
        gcAvailable: typeof (globalThis as { gc?: () => void }).gc === 'function',
      };
    },
    { root: repoRoot, sweep: SWEEP, variants: [...MEASURE_ORDER], probeN: PROBE_N, settle: SETTLE },
  );

  const lines = [
    '',
    `Draw loop — 800x600, dpr 1, on ${glRenderer}`,
    `even-odd fills actually paint: ${breakerPaints}`,
    `draw calls at ${PROBE_N} commands: solid ${draws.solid}, alternating ${draws.alternating}`,
    `collected between measurements: ${gcAvailable}`,
    '',
    `| commands | ${VARIANTS.map((v) => `${v} (ms/frame · us/cmd)`).join(' | ')} |`,
    `|---:|${VARIANTS.map(() => '---:').join('|')}|`,
  ];
  for (const { n } of SWEEP) {
    const cells = VARIANTS.map((v) => {
      const r = rows.find((x) => x.variant === v && x.n === n)!;
      return `${r.perFrameMs.toFixed(2)} · ${r.usPerCmd.toFixed(1)}`;
    });
    lines.push(`| ${n} | ${cells.join(' | ')} |`);
  }
  console.log(lines.join('\n'));

  expect(errors).toEqual([]);
  // A breaker that silently draws nothing would read as a free program switch.
  expect(breakerPaints, 'even-odd fill did not paint').toBe(true);
  expect(draws.solid, 'solid rects should share one batched run').toBeLessThan(PROBE_N / 10);
  expect(draws.alternating, 'every alternating command should break the run').toBeGreaterThanOrEqual(PROBE_N);
  for (const v of VARIANTS) {
    const gr = rows.filter((r) => r.variant === v).sort((a, b) => a.n - b.n);
    expect(gr[gr.length - 1].perFrameMs, `${v}: more commands should cost more`)
      .toBeGreaterThan(gr[0].perFrameMs);
  }

  run.machine({ glRenderer, browser: `${browserName} ${browser.version()}` });
  run.params({ gcAvailable, breakerPaints, draws });
  for (const r of rows) {
    const stat = `median of 15 to ${SETTLE.maxSamples} single frames, one per task, after 10 untimed, until known to ${SETTLE.withinMs} ms or 2%`;
    run.item(`${r.variant} n=${r.n}`, {
      perFrame: metric(r.perFrameMs, 'ms', stat),
      perCommand: metric(r.usPerCmd, 'us', stat),
    }, { variant: r.variant, commands: r.n });
  }
  run.write();
});
