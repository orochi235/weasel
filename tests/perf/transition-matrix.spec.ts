/**
 * What a neighbour of a different kind costs: the pairwise transition matrix.
 *
 * `frame-budget.spec.ts` prices each command kind on its own, where a frame of
 * one kind batches and holds state. Its `mixed-doc` row costs ~3.5x what
 * pricing the same element mix from those rows predicts, and the difference has
 * to be the boundaries — a document interleaves kinds and every neighbour is a
 * state change. This measures a boundary directly.
 *
 * For an ordered pair the frame alternates A and B, so it holds N/2 of each and
 * N-1 boundaries. Subtracting half of each kind's homogeneous frame leaves the
 * boundaries alone, and dividing by N-1 puts the answer in microseconds per
 * boundary — a number that adds to a scene's cost once per adjacency, next to
 * per-command costs that add once per element.
 *
 * **An alternating frame cannot separate A→B from B→A.** Any cycle holds equal
 * counts of both, so a cell is the pair's cost, not a direction's. What it can
 * test is whether a boundary is a property of the *pair*: if every cell fits
 * `S(A,B) = f(A) + f(B)`, then each kind carries its own state cost and pays it
 * against any neighbour that is not itself. The report fits that model and
 * prints the residuals, so a pair that costs more than its two halves is
 * visible rather than assumed away.
 *
 * The diagonal is the instrument's resolution: `S(A,A)` is two measurements of
 * one frame, so it reports as noise in the same units as every other cell. Read
 * a cell against it. This laptop's floor is wide — see the header of
 * `frame-budget.spec.ts`.
 *
 * One renderer and one pool of leaves for the whole matrix, deliberately: the
 * caches key on object identity, so reusing the leaves is what makes every cell
 * a steady-state frame rather than a document load.
 *
 * This reports; it does not gate. See `tests/bench/README.md`.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { KIND_IDS, type KindId } from './lib/kinds';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Commands per frame. Every cell holds this many, so a mixed cell is N/2 of
 *  each kind and the homogeneous baselines halve cleanly. */
const N = 512;

/** Full passes over the matrix. The spread across them is the report. */
const RUNS = 3;

interface Cell {
  run: number;
  /** `hom1` / `hom2` bracket the mixed cells; `mix` is a pair. */
  slot: 'hom1' | 'hom2' | 'mix';
  a: KindId;
  b: KindId;
  perFrameMs: number;
}

test.setTimeout(1_800_000);

test('transition matrix: what a neighbour of a different kind costs', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  const cells: Cell[] = [];
  const pairCount = (KIND_IDS.length * (KIND_IDS.length - 1)) / 2;
  const perRun = KIND_IDS.length * 2 + pairCount;
  const total = perRun * RUNS;

  await page.exposeFunction('__matrixReport', (msg: unknown) => {
    const m = msg as { type: string } & Record<string, unknown>;
    if (m.type === 'header') {
      console.log('');
      console.log(`Transition matrix — 800x600, dpr 1, on ${String(m.glRenderer)}`);
      console.log(`collected between measurements: ${String(m.gcAvailable)}`);
      console.log(`every kind paints something: ${String(m.allPaint)}`);
      if (m.notPainting) console.log(`  NOT PAINTING: ${String(m.notPainting)}`);
      console.log(`${N} commands per frame; ${total} cells (${perRun} x ${RUNS} runs)`);
      console.log('');
      return;
    }
    const c = m as unknown as Cell & { index: number };
    cells.push({ run: c.run, slot: c.slot, a: c.a, b: c.b, perFrameMs: c.perFrameMs });
    const label = c.slot === 'mix' ? `${c.a} + ${c.b}` : `${c.a} (${c.slot})`;
    console.log(
      `  ${String(c.index).padStart(3)}/${total}  run ${c.run}  `
      + `${label.padEnd(24)} ${c.perFrameMs.toFixed(3)} ms/frame`,
    );
  });

  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { paints, glRenderer } = await page.evaluate(
    async ({ root, n, runs, kinds }) => {
      const report = (globalThis as unknown as {
        __matrixReport: (m: unknown) => Promise<void>;
      }).__matrixReport;

      const base = `/weasel/@fs${root}`;
      // One import of the renderer barrel, so the font and program registries
      // it reads are the module instances this code writes to. A second
      // specifier can land on a second copy, and the symptom is a kind that
      // silently paints nothing and therefore measures free.
      const rendererMod = await import(/* @vite-ignore */ `${base}/packages/core/src/renderer/index.ts`);
      const { WeaselRenderer, registerFont, registerProgram, registerTexture } = rendererMod;
      const kindsMod = await import(/* @vite-ignore */ `${base}/tests/perf/lib/kinds.ts`);
      const { makeKindBuilders, checkerBitmap, imageBitmaps, PANEL_FRAG } = kindsMod;

      const W = 800;
      const H = 600;
      const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

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

      await registerFont(
        'sans-serif', { weight: 400, style: 'normal' },
        '/weasel/inter/inter.json', '/weasel/inter/inter.png',
      );
      const shaderHandle = registerProgram('perf-transition-panel', '', PANEL_FRAG);

      const renderer = new WeaselRenderer({ gl, canvas, width: W, height: H, dpr: 1 });
      renderer.registerProgram(shaderHandle);

      const builders = makeKindBuilders({
        W, H,
        bitmaps: await imageBitmaps(6),
        pattern: registerTexture(await checkerBitmap()),
        shader: shaderHandle,
      });

      /** Built once and held: the kit's caches key on object identity, so
       *  minting fresh leaves per cell would measure tessellation, atlas
       *  layout and GL uploads instead of a steady-state frame. */
      const pools: Record<string, unknown[]> = {};
      for (const k of kinds) {
        const pool: unknown[] = [];
        for (let i = 0; i < n; i++) pool.push(builders[k](i));
        pools[k] = pool;
      }

      /** N commands, even indices from A and odd from B — so a mixed frame
       *  holds N/2 of each at the same positions their homogeneous frames use,
       *  and N-1 boundaries. */
      function mix(a: string, b: string): unknown[] {
        if (a === b) return pools[a];
        const out: unknown[] = [];
        for (let i = 0; i < n; i++) out.push(i % 2 === 0 ? pools[a][i] : pools[b][i]);
        return out;
      }

      const collect = (globalThis as { gc?: (opts?: unknown) => void }).gc;
      const gcAvailable = typeof collect === 'function';

      /** Total across `frames`, divided. Never time one frame. */
      function timeBlock(cmds: unknown[], frames: number): number {
        if (collect) {
          collect({ type: 'major', execution: 'sync' });
          collect({ type: 'major', execution: 'sync' });
        }
        // One untimed frame between the collect and the clock: collecting
        // finalizes dropped meshes, each of which queues GL deletes that
        // `render` drains at the top of the next frame. Without this a block is
        // charged for its predecessor's teardown.
        renderer.render(cmds, identity);
        gl.finish();
        const t0 = performance.now();
        for (let f = 0; f < frames; f++) renderer.render(cmds, identity);
        gl.finish();
        return (performance.now() - t0) / frames;
      }

      /** The frame count is derived because the cells span two orders of
       *  magnitude: a fixed count is either below the ~100us clock at the cheap
       *  end or half a minute at the dear one. */
      const TARGET_BLOCK_MS = 100;
      function measure(cmds: unknown[]): number {
        for (let i = 0; i < 3; i++) renderer.render(cmds, identity);
        gl.finish();
        const rough = timeBlock(cmds, 4);
        const frames = Math.min(60, Math.max(4, Math.round(TARGET_BLOCK_MS / Math.max(rough, 0.05))));
        return timeBlock(cmds, frames);
      }

      /** A kind that silently draws nothing measures free, which would make
       *  every cell holding it a lie rather than merely a wrong number. */
      function paintsAnything(kind: string): boolean {
        renderer.render([pools[kind][0]], identity);
        gl.finish();
        const buf = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        for (let p = 3; p < buf.length; p += 4) if (buf[p] !== 0) return true;
        return false;
      }

      const paints: Record<string, boolean> = {};
      for (const k of kinds) paints[k] = paintsAnything(k);
      const notPainting = kinds.filter((k) => !paints[k]);

      // Pay this context's one-time costs — program links, atlas upload, image
      // textures, the solid batch's buffer growth — before the first timed
      // block, so no cell is charged for the feature it happens to reach first.
      for (const k of kinds) {
        for (let i = 0; i < 3; i++) renderer.render(pools[k], identity);
      }
      gl.finish();

      await report({
        type: 'header', glRenderer, gcAvailable,
        allPaint: notPainting.length === 0,
        notPainting: notPainting.join(', '),
      });

      let index = 0;
      const emit = async (run: number, slot: string, a: string, b: string, cmds: unknown[]) => {
        const perFrameMs = +measure(cmds).toFixed(4);
        index += 1;
        await report({ type: 'cell', index, run, slot, a, b, perFrameMs });
      };

      // Homogeneous passes bracket the mixed cells rather than preceding them:
      // averaging a baseline measured before and after straddles any drift the
      // machine does while the 36 pairs run, instead of pinning the baseline to
      // one end of it.
      for (let run = 1; run <= runs; run++) {
        for (const k of kinds) await emit(run, 'hom1', k, k, pools[k]);
        for (let i = 0; i < kinds.length; i++) {
          for (let j = i + 1; j < kinds.length; j++) {
            await emit(run, 'mix', kinds[i], kinds[j], mix(kinds[i], kinds[j]));
          }
        }
        for (const k of kinds) await emit(run, 'hom2', k, k, pools[k]);
      }

      renderer.dispose();
      return { paints, glRenderer };
    },
    { root: repoRoot, n: N, runs: RUNS, kinds: [...KIND_IDS] },
  );

  // ─── analysis ──────────────────────────────────────────────────────────

  const boundaries = N - 1;
  /** ms per frame → us per boundary. */
  const perBoundary = (ms: number) => (ms * 1000) / boundaries;

  const homFor = (run: number, k: KindId, slot: 'hom1' | 'hom2') =>
    cells.find((c) => c.run === run && c.slot === slot && c.a === k)!.perFrameMs;
  const homMean = (run: number, k: KindId) => (homFor(run, k, 'hom1') + homFor(run, k, 'hom2')) / 2;

  /** Surcharge for one pair in one run: what the mixed frame cost above half
   *  of each kind's own frame, spread over the boundaries between them. */
  const surcharge = (run: number, a: KindId, b: KindId) => {
    const mixed = cells.find(
      (c) => c.run === run && c.slot === 'mix' && c.a === a && c.b === b,
    )!.perFrameMs;
    return perBoundary(mixed - (homMean(run, a) + homMean(run, b)) / 2);
  };

  const runs = Array.from({ length: RUNS }, (_, i) => i + 1);
  const med = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)];
  const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

  const S: Record<string, number> = {};
  const Sspread: Record<string, number> = {};
  const key = (a: KindId, b: KindId) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (let i = 0; i < KIND_IDS.length; i++) {
    for (let j = i + 1; j < KIND_IDS.length; j++) {
      const a = KIND_IDS[i];
      const b = KIND_IDS[j];
      const vs = runs.map((r) => surcharge(r, a, b));
      S[key(a, b)] = med(vs);
      Sspread[key(a, b)] = spread(vs);
    }
  }

  /**
   * Least squares fit of `S(A,B) = f(A) + f(B)` over the off-diagonal cells.
   * Closed form: differentiating gives `(n-2) f(A) + T = rowSum(A)` with
   * `T = sum(f) = total / (n - 1)`.
   */
  const n = KIND_IDS.length;
  const totalS = Object.values(S).reduce((s, v) => s + v, 0);
  const T = totalS / (n - 1);
  const f: Record<string, number> = {};
  for (const a of KIND_IDS) {
    const rowSum = KIND_IDS.filter((b) => b !== a).reduce((s, b) => s + S[key(a, b)], 0);
    f[a] = (rowSum - T) / (n - 2);
  }

  const noise = KIND_IDS.map((k) => ({
    kind: k,
    us: med(runs.map((r) => Math.abs(perBoundary(homFor(r, k, 'hom1') - homFor(r, k, 'hom2'))))),
  }));

  const num = (x: number) => (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(2));
  const lines = [
    '',
    `Transition matrix — 800x600, dpr 1, on ${glRenderer}`,
    `${N} commands per frame, ${RUNS} runs; median across runs.`,
    '',
    '**Per-command cost, one kind per frame** (us/command)',
    '',
    `| kind | ${KIND_IDS.map((k) => k).join(' | ')} |`,
    `|---|${KIND_IDS.map(() => '---:').join('|')}|`,
    `| us/cmd | ${KIND_IDS.map((k) => num(med(runs.map((r) => (homMean(r, k) * 1000) / N)))).join(' | ')} |`,
    '',
    '**Transition surcharge** (us per boundary, above the two kinds\' own cost)',
    '',
    `| pair | ${KIND_IDS.join(' | ')} |`,
    `|---|${KIND_IDS.map(() => '---:').join('|')}|`,
  ];
  for (const a of KIND_IDS) {
    const row = KIND_IDS.map((b) => (a === b ? '·' : num(S[key(a, b)])));
    lines.push(`| ${a} | ${row.join(' | ')} |`);
  }
  lines.push(
    '',
    '**Additive fit** `S(A,B) = f(A) + f(B)` — a kind\'s own per-boundary state cost',
    '',
    `| kind | ${KIND_IDS.join(' | ')} |`,
    `|---|${KIND_IDS.map(() => '---:').join('|')}|`,
    `| f (us) | ${KIND_IDS.map((k) => num(f[k])).join(' | ')} |`,
    '',
    '**Residual** `S(A,B) - f(A) - f(B)` — what the pair costs beyond its two halves',
    '',
    `| pair | ${KIND_IDS.join(' | ')} |`,
    `|---|${KIND_IDS.map(() => '---:').join('|')}|`,
  );
  for (const a of KIND_IDS) {
    const row = KIND_IDS.map((b) => (a === b ? '·' : num(S[key(a, b)] - f[a] - f[b])));
    lines.push(`| ${a} | ${row.join(' | ')} |`);
  }
  lines.push(
    '',
    '**Resolution** — same frame measured twice, in the same units as a cell (us/boundary)',
    '',
    `| kind | ${noise.map((x) => x.kind).join(' | ')} |`,
    `|---|${noise.map(() => '---:').join('|')}|`,
    `| noise | ${noise.map((x) => num(x.us)).join(' | ')} |`,
    '',
    `| pair | run-to-run spread (us/boundary) |`,
    `|---|---:|`,
  );
  const worstSpread = Object.entries(Sspread).sort((x, y) => y[1] - x[1]).slice(0, 5);
  for (const [k, v] of worstSpread) lines.push(`| ${k.replace('|', ' + ')} | ${num(v)} |`);
  console.log(lines.join('\n'));

  expect(errors).toEqual([]);
  for (const k of KIND_IDS) {
    expect(paints[k], `${k}: rendered nothing, so every cell holding it is meaningless`).toBe(true);
  }
  expect(cells.length).toBe(total);
});
