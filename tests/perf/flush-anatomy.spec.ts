/**
 * What a batch flush spends outside the draw.
 *
 * `clip-cost.spec.ts` prices one flush through the renderer. This strips that
 * flush one GL call at a time to say where the price goes. Every variant
 * renders the same frame — `N` one-rect groups whose color matrices alternate,
 * so each closes the run and `flushBatch` runs `N` times with one rect apiece —
 * through the real `WeaselRenderer`. A variant drops calls by replacing methods
 * on the live context with no-ops, so the calls measured are whatever
 * `flushBatch` issues today, and a call added to it shows up in the `flush`
 * row without anything here changing.
 *
 * Removals are cumulative: each row drops one more thing than the row above,
 * so the delta between adjacent rows is that thing's cost. Read the deltas,
 * not the absolute rows. A dropped call is not replaced, so the lower rows
 * draw from stale state; that is what makes them a floor, and the paint probe
 * only checks they still draw.
 *
 * A method dropped only for some arguments (`bindVertexArray(null)`,
 * `disable(STENCIL_TEST)`) is wrapped rather than replaced, which adds a JS
 * call to the calls it keeps — a few tens of nanoseconds, below the noise of a
 * row.
 *
 * This reports; it does not gate. See `tests/perf/README.md`.
 */
import { test, expect } from '@playwright/test';
import { metric, rounds, startRun } from './lib/result';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Flushes per frame. Each carries one rect — the shape a broken run has, and
 *  the one that makes the per-flush overhead the whole cost. */
const N = 512;

const RUNS = rounds(3);

/**
 * Each row drops one more call than the row above. `drops` names what this
 * row no longer does, so the delta from the previous row prices exactly that.
 * `rule` is evaluated in the page: a method name, and optionally the first
 * argument that marks the calls to drop.
 */
const VARIANTS = [
  { id: 'flush',        drops: '— the full flushBatch sequence', rule: null },
  { id: '-unbind',      drops: 'bindVertexArray(null) after the draw', rule: { method: 'bindVertexArray', arg0: null } },
  { id: '-activetex',   drops: 'activeTexture(TEXTURE0), before the binds and after the draw', rule: { method: 'activeTexture' } },
  { id: '-cliptest',    drops: 'disable(STENCIL_TEST) (applyClipTest at depth 0)', rule: { method: 'disable', arg0: 'STENCIL_TEST' } },
  { id: '-samplers',    drops: 'uniform1iv(u_samplers) + uniform2fv(u_fieldScale)', rule: { method: ['uniform1iv', 'uniform2fv'] } },
  { id: '-synthbold',   drops: 'uniform1f(u_synthBold)', rule: { method: 'uniform1f' } },
  { id: '-colormatrix', drops: 'the color-matrix uniforms, which are this frame\'s run-breaker', rule: { method: ['uniform4f', 'uniformMatrix4fv'] } },
  { id: '-whitetex',    drops: 'bindTexture(white) to unit 0', rule: { method: 'bindTexture' } },
  { id: '-useprogram',  drops: 'useProgram', rule: { method: 'useProgram' } },
  { id: '-idxupload',   drops: 'the index bufferSubData', rule: { method: 'bufferSubData', arg0: 'ELEMENT_ARRAY_BUFFER' } },
  { id: 'bind+draw',    drops: 'the vertex bufferSubData — bind and draw only', rule: { method: 'bufferSubData', arg0: 'ARRAY_BUFFER' } },
] as const;

type VariantId = (typeof VARIANTS)[number]['id'];

interface Cell { run: number; variant: VariantId; perFrameMs: number }

test.setTimeout(1_800_000);

test('flush anatomy: what a flush spends outside the draw', async ({ page, browser, browserName }) => {
  const run = startRun('flush-anatomy', { viewport: '800x600', dpr: 1, flushesPerFrame: N, runs: RUNS });
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  const cells: Cell[] = [];
  const total = VARIANTS.length * RUNS;

  await page.exposeFunction('__flushReport', (msg: unknown) => {
    const m = msg as { type: string } & Record<string, unknown>;
    if (m.type === 'header') {
      run.params({ gcAvailable: Boolean(m.gcAvailable) });
      console.log('');
      console.log(`Flush anatomy — 800x600, dpr 1, on ${String(m.glRenderer)}`);
      console.log(`collected between measurements: ${String(m.gcAvailable)}`);
      console.log(`draws per frame: ${String(m.draws)}`);
      console.log(`every variant paints something: ${String(m.allPaint)}`);
      if (m.notPainting) console.log(`  NOT PAINTING: ${String(m.notPainting)}`);
      console.log(`${N} flushes per frame, one rect each; ${total} cells`);
      console.log('');
      return;
    }
    const c = m as unknown as Cell & { index: number };
    cells.push({ run: c.run, variant: c.variant, perFrameMs: c.perFrameMs });
    console.log(
      `  ${String(c.index).padStart(2)}/${total}  run ${c.run}  `
      + `${c.variant.padEnd(12)} ${c.perFrameMs.toFixed(3)} ms/frame`
      + `  (${((c.perFrameMs * 1000) / N).toFixed(2)} us/flush)`,
    );
  });

  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { paints, glRenderer, draws } = await page.evaluate(
    async ({ root, n, runs, variants }) => {
      const report = (globalThis as unknown as {
        __flushReport: (m: unknown) => Promise<void>;
      }).__flushReport;

      const { WeaselRenderer } = await import(
        /* @vite-ignore */ `/weasel/@fs${root}/packages/core/src/renderer/index.ts`
      );
      const { timeInterleaved } = await import(
        /* @vite-ignore */ `/weasel/@fs${root}/tests/perf/lib/frameTiming.ts`
      );

      const W = 800;
      const H = 600;
      const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

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

      const px = (i: number) => 20 + ((i * 37) % (W - 160));
      const py = (i: number) => 20 + ((i * 53) % (H - 160));
      /** Off identity by a bias too small to see, alternating, so every group
       *  breaks the run without touching the stencil. */
      const cm = (i: number) => {
        const b = i % 2 === 0 ? 0.002 : 0.004;
        return [1, 0, 0, 0, b, 0, 1, 0, 0, b, 0, 0, 1, 0, b, 0, 0, 0, 1, 0];
      };
      /** Built once and held: the caches key on object identity. */
      const cmds: unknown[] = [];
      for (let i = 0; i < n; i++) {
        cmds.push({
          kind: 'group', colorMatrix: cm(i),
          children: [{
            kind: 'path',
            path: { kind: 'rect', x: px(i), y: py(i), width: 36, height: 36 },
            fill: { fill: 'solid', color: i % 2 ? '#3366cc' : '#cc6633' },
          }],
        });
      }

      type Rule = { method: string | readonly string[]; arg0?: string | null } | null;
      const glAny = gl as unknown as Record<string, unknown>;
      const originals = new Map<string, unknown>();

      /** Shadow each ruled method with an own property on the context, so the
       *  methods no rule names stay native. */
      function install(rules: Rule[]): void {
        uninstall();
        const byMethod = new Map<string, (string | null | undefined)[]>();
        for (const rule of rules) {
          if (!rule) continue;
          for (const m of typeof rule.method === 'string' ? [rule.method] : rule.method) {
            const list = byMethod.get(m) ?? [];
            list.push(rule.arg0);
            byMethod.set(m, list);
          }
        }
        for (const [m, args] of byMethod) {
          const native = (glAny[m] as (...a: unknown[]) => unknown);
          originals.set(m, native);
          if (args.includes(undefined)) {
            glAny[m] = () => undefined;
            continue;
          }
          const drop = args.map((a) => (a === null ? null : (gl as unknown as Record<string, number>)[a as string]));
          glAny[m] = function (this: unknown, ...a: unknown[]) {
            if (drop.includes(a[0] as number | null)) return undefined;
            return native.apply(gl, a);
          };
        }
      }
      function uninstall(): void {
        for (const m of originals.keys()) delete glAny[m];
        originals.clear();
      }

      const rulesUpTo = (id: string): Rule[] => {
        const at = variants.findIndex((v) => v.id === id);
        return variants.slice(0, at + 1).map((v) => v.rule as Rule);
      };

      // Warm every ring slot and cache with the full sequence first, so the
      // lower rows draw from state a real flush left behind.
      for (let i = 0; i < 4; i++) renderer.render(cmds, identity);
      gl.finish();
      const draws = renderer.lastFrameStats().drawCalls;

      function paintsAnything(id: string): boolean {
        install(rulesUpTo(id));
        renderer.render(cmds, identity);
        gl.finish();
        uninstall();
        const buf = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        for (let p = 3; p < buf.length; p += 4) if (buf[p] !== 0) return true;
        return false;
      }

      const paints: Record<string, boolean> = {};
      for (const v of variants) paints[v.id] = paintsAnything(v.id);
      const notPainting = variants.filter((v) => !paints[v.id]).map((v) => v.id);

      const collect = (globalThis as { gc?: (opts?: unknown) => void }).gc;
      const gcAvailable = typeof collect === 'function';

      await report({
        type: 'header', glRenderer, gcAvailable, draws,
        allPaint: notPainting.length === 0,
        notPainting: notPainting.join(', '),
      });

      // Interleaved sample by sample, so the GPU process's speed plateaus land
      // on every row alike; see lib/frameTiming.ts.
      let index = 0;
      for (let run = 1; run <= runs; run++) {
        if (collect) collect({ type: 'major', execution: 'sync' });
        const timed = timeInterleaved(gl, variants.map((v) => ({
          id: v.id,
          before: () => install(rulesUpTo(v.id)),
          frame: () => renderer.render(cmds, identity),
          after: uninstall,
        })));
        for (const v of variants) {
          const perFrameMs = +timed[v.id].stat.toFixed(4);
          index += 1;
          await report({ type: 'cell', index, run, variant: v.id, perFrameMs });
        }
      }

      renderer.dispose();
      return { paints, glRenderer, draws };
    },
    { root: repoRoot, n: N, runs: RUNS, variants: VARIANTS.map((v) => ({ id: v.id, rule: v.rule })) },
  );

  const median = (xs: number[]): number => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const perFlushUs = (id: string): number =>
    (median(cells.filter((c) => c.variant === id).map((c) => c.perFrameMs)) * 1000) / N;

  const lines = [
    '',
    `Flush anatomy — ${N} one-rect flushes per frame, on ${glRenderer}`,
    `median of ${RUNS} runs; "saves" is this row against the one above it.`,
    '',
    '| variant      | us/flush |  saves | no longer does |',
    '|---|---:|---:|---|',
  ];
  let prev: number | undefined;
  for (const { id, drops } of VARIANTS) {
    const us = perFlushUs(id);
    const saves = prev === undefined ? '     —' : (prev - us).toFixed(2).padStart(6);
    lines.push(`| ${id.padEnd(12)} | ${us.toFixed(2).padStart(8)} | ${saves} | ${drops} |`);
    prev = us;
  }
  console.log(lines.join('\n'));

  expect(errors).toEqual([]);
  // One draw per group, or the frame is not N one-rect flushes and every row
  // prices something else.
  expect(draws, 'each group should close the run and flush one rect').toBe(N);
  for (const { id } of VARIANTS) {
    expect(paints[id], `${id}: rendered nothing, so its cost is meaningless`).toBe(true);
  }

  run.machine({ glRenderer, browser: `${browserName} ${browser.version()}` });
  let above: number | undefined;
  for (const { id, drops } of VARIANTS) {
    const us = perFlushUs(id);
    const samples = cells.filter((c) => c.variant === id).map((c) => (c.perFrameMs * 1000) / N);
    run.item(id, {
      perFlush: metric(us, 'us', `median of ${RUNS} runs; each the p10 of 40 interleaved samples (lib/frameTiming.ts)`, samples),
      ...(above === undefined ? {} : { saves: metric(above - us, 'us', 'the row above minus this row, medians') }),
    }, { drops });
    above = us;
  }
  run.write();
});
