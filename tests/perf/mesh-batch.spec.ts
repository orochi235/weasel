/**
 * Where a mesh stops being cheaper to batch than to draw on its own.
 *
 * `MAX_BATCHED_MESH_VERTICES` in `packages/core/src/renderer/draw.ts` decides
 * it. A batched mesh is copied into the run and uploaded again every frame; one
 * drawn alone sits in the persistent mesh cache and costs a draw call, plus the
 * flush of whatever run was open before it. This times both at each rung of a
 * vertex-count ladder by moving the cap itself (`meshBatching.maxVertices`)
 * around each frame, so the two sides run the same commands through the same
 * renderer, interleaved sample by sample.
 *
 * Two shapes of frame, each `K` meshes:
 *
 *   - `interleaved` — a rect before every mesh. A mesh drawn alone also
 *                     closes the rect's run, so this is the case the cap meets
 *                     in a scene of mixed shapes.
 *   - `meshes`      — meshes alone. Drawn alone, nothing else is flushed, so
 *                     this is the break-even at its most favorable to batching.
 *
 * Every mesh is a convex polygon of `v` points, tessellated once and held:
 * `getMesh` keys on the path's identity. Draw calls per frame are read from
 * `lastFrameStats` in an untimed pass, which is also what shows the cap moved.
 *
 * `WEASEL_PERF_VERTS` overrides the ladder (comma-separated vertex counts).
 *
 * This reports; it does not gate. See `tests/perf/README.md`.
 */
import { test, expect } from '@playwright/test';
import { isolate } from './lib/isolate';
import { metric, rounds, startRun } from './lib/result';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const W = 800;
const H = 600;
/** Meshes per frame. */
const K = 256;

const VERTS = process.env.WEASEL_PERF_VERTS?.split(',').map(Number).filter((n) => n >= 3)
  ?? [8, 16, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072];

const RUNS = rounds(5);

const SHAPES = ['interleaved', 'meshes'] as const;
type Shape = (typeof SHAPES)[number];
const MODES = ['batched', 'alone'] as const;
type Mode = (typeof MODES)[number];

interface Cell { run: number; verts: number; shape: Shape; mode: Mode; perFrameMs: number }
interface Counts { verts: number; meshVerts: number; shape: Shape; mode: Mode; draws: number }

test.setTimeout(1_800_000);

test('mesh batch: where batching a mesh stops paying', async ({ page, browser, browserName }) => {
  const run = startRun('mesh-batch', { viewport: `${W}x${H}`, dpr: 1, meshesPerFrame: K, verts: VERTS, runs: RUNS });
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  const cells: Cell[] = [];
  const counts: Counts[] = [];
  const total = VERTS.length * SHAPES.length * MODES.length * RUNS;

  await page.exposeFunction('__meshReport', (msg: unknown) => {
    const m = msg as { type: string } & Record<string, unknown>;
    if (m.type === 'header') {
      run.params({ gcAvailable: Boolean(m.gcAvailable) });
      console.log('');
      console.log(`Mesh batch — ${W}x${H}, dpr 1, ${K} meshes a frame, on ${String(m.glRenderer)}`);
      console.log(`collected between measurements: ${String(m.gcAvailable)}`);
      console.log(`every cell paints something: ${String(m.allPaint)}`);
      if (m.notPainting) console.log(`  NOT PAINTING: ${String(m.notPainting)}`);
      console.log(`${total} cells (${VERTS.length} rungs x ${SHAPES.length} shapes x ${MODES.length} modes x ${RUNS} runs)`);
      console.log('');
      return;
    }
    if (m.type === 'calls') {
      counts.push(m as unknown as Counts);
      return;
    }
    const c = m as unknown as Cell & { index: number };
    cells.push({ run: c.run, verts: c.verts, shape: c.shape, mode: c.mode, perFrameMs: c.perFrameMs });
    console.log(
      `  ${String(c.index).padStart(3)}/${total}  run ${c.run}  `
      + `${String(c.verts).padStart(5)} v  ${c.shape.padEnd(11)} ${c.mode.padEnd(7)}`
      + ` ${c.perFrameMs.toFixed(3).padStart(7)} ms/frame`
      + `  ${((c.perFrameMs * 1000) / K).toFixed(2).padStart(6)} us/mesh`,
    );
  });

  await isolate(page);
  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { paints, glRenderer } = await page.evaluate(
    async ({ root, w, h, k, verts, runs, shapes, modes }) => {
      const report = (globalThis as unknown as {
        __meshReport: (m: unknown) => Promise<void>;
      }).__meshReport;

      const base = `/weasel/@fs${root}`;
      const { WeaselRenderer, tessellate } = await import(/* @vite-ignore */ `${base}/packages/core/src/renderer/index.ts`);
      const { meshBatching } = await import(/* @vite-ignore */ `${base}/packages/core/src/renderer/draw.ts`);
      const { timeInterleaved } = await import(/* @vite-ignore */ `${base}/tests/perf/lib/frameTiming.ts`);
      const defaultCap: number = meshBatching.maxVertices;

      const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
      if (!gl) throw new Error('no WebGL2 context');
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const glRenderer = String(dbg
        ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER));
      const renderer = new WeaselRenderer({ gl, canvas, width: w, height: h, dpr: 1 });

      const M = 0, L = 1, Z = 4; // PathVerb
      const R = 18;
      /** A convex `n`-gon: earcut keeps its points as the mesh's vertices. */
      const ngon = (cx: number, cy: number, n: number) => {
        const coords = new Float32Array(n * 2);
        for (let j = 0; j < n; j++) {
          coords[j * 2] = cx + R * Math.cos((j * 2 * Math.PI) / n);
          coords[j * 2 + 1] = cy + R * Math.sin((j * 2 * Math.PI) / n);
        }
        const commands = new Uint8Array(n + 1).fill(L);
        commands[0] = M;
        commands[n] = Z;
        return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
      };

      const COLORS = ['#3366cc', '#cc6633', '#33aa66', '#aa3388'];
      /** Built once and held: every cache in the kit keys on object identity. */
      function build(n: number, shape: string): unknown[] {
        const out: unknown[] = [];
        for (let i = 0; i < k; i++) {
          const x = 2 * R + ((i * 37) % (w - 4 * R));
          const y = 2 * R + ((i * 53) % (h - 4 * R));
          if (shape === 'interleaved') {
            out.push({
              kind: 'path',
              path: { kind: 'rect', x: x - R - 6, y: y - R - 6, width: 8, height: 8 },
              fill: { fill: 'solid', color: '#222222' },
            });
          }
          out.push({ kind: 'path', path: ngon(x, y, n), fill: { fill: 'solid', color: COLORS[i % COLORS.length] } });
        }
        return out;
      }

      const pools = new Map<string, unknown[]>();
      const meshVerts = new Map<number, number>();
      for (const n of verts) {
        for (const s of shapes) pools.set(`${n}|${s}`, build(n, s));
        const probe = tessellate(ngon(100, 100, n) as never);
        meshVerts.set(n, probe.vertices.length >> 1);
      }

      const capFor = (mode: string): number => (mode === 'batched' ? Infinity : -1);
      function frameUnder(cmds: unknown[], mode: string): void {
        meshBatching.maxVertices = capFor(mode);
        try { renderer.render(cmds, identity); } finally { meshBatching.maxVertices = defaultCap; }
      }

      // Uploads, program links and batch growth for both sides, before anything is timed.
      for (const [, cmds] of pools) for (const m of modes) frameUnder(cmds, m);
      gl.finish();

      function paintsAnything(cmds: unknown[], mode: string): boolean {
        frameUnder(cmds, mode);
        gl.finish();
        const buf = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        for (let p = 3; p < buf.length; p += 4) if (buf[p] !== 0) return true;
        return false;
      }
      const paints: Record<string, boolean> = {};
      for (const n of [verts[0], verts[verts.length - 1]]) {
        for (const s of shapes) for (const m of modes) paints[`${n} ${s} ${m}`] = paintsAnything(pools.get(`${n}|${s}`)!, m);
      }
      const notPainting = Object.keys(paints).filter((key) => !paints[key]);

      for (const n of verts) {
        for (const s of shapes) {
          for (const m of modes) {
            frameUnder(pools.get(`${n}|${s}`)!, m);
            await report({
              type: 'calls', verts: n, meshVerts: meshVerts.get(n), shape: s, mode: m,
              draws: renderer.lastFrameStats().drawCalls,
            });
          }
        }
      }

      const collect = (globalThis as { gc?: (opts?: unknown) => void }).gc;
      await report({
        type: 'header', glRenderer, gcAvailable: typeof collect === 'function',
        allPaint: notPainting.length === 0, notPainting: notPainting.join(', '),
      });

      let index = 0;
      for (let r = 1; r <= runs; r++) {
        for (const n of verts) {
          if (collect) collect({ type: 'major', execution: 'sync' });
          const variants = shapes.flatMap((s: string) => modes.map((m: string) => ({
            id: `${s}|${m}`,
            frame: () => frameUnder(pools.get(`${n}|${s}`)!, m),
          })));
          const timed = await timeInterleaved(gl, variants);
          for (const s of shapes) {
            for (const m of modes) {
              index += 1;
              await report({
                type: 'cell', index, run: r, verts: n, shape: s, mode: m,
                perFrameMs: +timed[`${s}|${m}`].net.toFixed(4),
              });
            }
          }
        }
      }

      renderer.dispose();
      return { paints, glRenderer };
    },
    { root: repoRoot, w: W, h: H, k: K, verts: VERTS, runs: RUNS, shapes: [...SHAPES], modes: [...MODES] },
  );

  // ─── report ────────────────────────────────────────────────────────────

  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const frames = (n: number, s: Shape, m: Mode) =>
    cells.filter((c) => c.verts === n && c.shape === s && c.mode === m).map((c) => c.perFrameMs);
  const draws = (n: number, s: Shape, m: Mode) =>
    counts.find((c) => c.verts === n && c.shape === s && c.mode === m)?.draws ?? NaN;
  /** Per mesh, alone less batched: positive means batching is cheaper. */
  const saving = (n: number, s: Shape) => ((med(frames(n, s, 'alone')) - med(frames(n, s, 'batched'))) * 1000) / K;

  /** Where `saving` first crosses zero going up the ladder, linearly
   *  interpolated in vertex count between the rungs either side. */
  function breakEven(s: Shape): number | null {
    for (let i = 1; i < VERTS.length; i++) {
      const a = saving(VERTS[i - 1], s);
      const b = saving(VERTS[i], s);
      if (a > 0 && b <= 0) return VERTS[i - 1] + ((VERTS[i] - VERTS[i - 1]) * a) / (a - b);
    }
    return null;
  }

  const lines: string[] = [
    '',
    `Mesh batch — ${K} meshes a frame, on ${glRenderer}`,
    `median of ${RUNS} runs; us per mesh. "saves" is alone less batched: positive favors batching.`,
    '',
    '| verts | mesh v | shape | batched | alone | saves | draws b / a |',
    '|---:|---:|---|---:|---:|---:|---:|',
  ];
  for (const s of SHAPES) {
    for (const n of VERTS) {
      const b = (med(frames(n, s, 'batched')) * 1000) / K;
      const a = (med(frames(n, s, 'alone')) * 1000) / K;
      const mv = counts.find((c) => c.verts === n)?.meshVerts ?? NaN;
      lines.push(
        `| ${String(n).padStart(5)} | ${String(mv).padStart(6)} | ${s.padEnd(11)} | ${b.toFixed(2).padStart(7)} | ${a.toFixed(2).padStart(6)}`
        + ` | ${saving(n, s).toFixed(2).padStart(6)} | ${String(draws(n, s, 'batched')).padStart(4)} / ${String(draws(n, s, 'alone')).padStart(4)} |`,
      );
    }
  }
  for (const s of SHAPES) {
    const be = breakEven(s);
    lines.push('', `break-even, ${s}: ${be === null ? 'no crossing on this ladder' : `${be.toFixed(0)} vertices`}`);
  }
  lines.push('');
  console.log(lines.join('\n'));

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([]);
  for (const [key, ok] of Object.entries(paints)) expect(ok, `${key} painted nothing`).toBe(true);
  // The cap has to have moved, or both modes timed the same frame.
  for (const n of VERTS) {
    for (const s of SHAPES) {
      expect(draws(n, s, 'alone'), `${n} ${s}: alone should draw every mesh itself`).toBeGreaterThanOrEqual(K);
      expect(draws(n, s, 'batched'), `${n} ${s}: batched should coalesce`).toBeLessThan(K / 2);
    }
  }

  run.machine({ glRenderer, browser: `${browserName} ${browser.version()}` });
  const stat = `median of ${RUNS} runs; each the median of 40 single-frame samples less the least frame that draws, one frame a task (lib/frameTiming.ts)`;
  for (const s of SHAPES) {
    for (const n of VERTS) {
      const items: Record<string, ReturnType<typeof metric>> = {};
      for (const m of MODES) {
        const f = frames(n, s, m);
        items[`${m}PerMesh`] = metric((med(f) * 1000) / K, 'us', stat, f.map((x) => (x * 1000) / K));
        items[`${m}DrawCalls`] = metric(draws(n, s, m), 'count', 'one untimed frame');
      }
      items.saves = metric(saving(n, s), 'us', 'alone less batched, per mesh, medians');
      run.item(`${s} ${n}v`, items, { shape: s, verts: n, meshVerts: counts.find((c) => c.verts === n)?.meshVerts });
    }
    const be = breakEven(s);
    if (be !== null) run.item(`${s} break-even`, { vertices: metric(+be.toFixed(1), 'count', 'first zero crossing of saves, linear between rungs') }, { shape: s });
  }
  run.write();
});
