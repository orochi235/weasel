/**
 * What entering a clip actually pays for: the stencil, or the batch break.
 *
 * `frame-budget.spec.ts` prices a clipped group holding one rect at ~65 us
 * against ~0.1 us for a bare rect, and nesting is nearly free — so the price is
 * entry. Two mechanisms could be charging it, and only one is fixable:
 *
 *   - the **stencil**: `pushClip` and `popClip` each rasterize the clip path
 *     into the stencil buffer and move colorMask / stencilMask / stencilFunc
 *     around it. Inherent to how clipping works here.
 *   - the **batch break**: `stagedStateIsLive` compares `clipDepth`, so a
 *     clipped rect cannot share a draw with its unclipped neighbours, and
 *     `popClip` flushes a batch holding one rect. Fixable in principle.
 *
 * Separating them needs contents that would not have batched anyway. A
 * gradient rect never joins the solid batch, so wrapping one in a clip adds the
 * stencil and nothing else; wrapping a *solid* rect adds the stencil and the
 * break. The difference between those two deltas is the break's share.
 *
 * `cmbreak` checks that answer from the other side: a group carrying a color
 * matrix that differs from its neighbour's breaks the run through the same test
 * without touching the stencil. Its gradient twin subtracts the color-matrix
 * upload that the trick itself costs, leaving a second, independent estimate of
 * one flush.
 *
 * `-k8` puts eight leaves under each clip instead of one. If entry is the whole
 * price, the per-group figure holds and the per-leaf figure falls by eight.
 *
 * This reports; it does not gate. See `tests/bench/README.md`.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Leaves per frame. Every variant holds this many, so the deltas between
 *  them are per-leaf and comparable without rescaling. */
const N = 512;

/** Leaves per group in the `-k8` variants. */
const K = 8;

const RUNS = 3;

/** `groups` is how many clips (or color-matrix breaks) the frame contains —
 *  the divisor for a per-entry figure, where `N` is the divisor for a
 *  per-leaf one. */
const VARIANTS = [
  { id: 'rect-plain',      groups: 0,     note: 'N solid rects, one batch' },
  { id: 'rect-clipped',    groups: N,     note: 'each rect in its own clip' },
  { id: 'rect-cmbreak',    groups: N,     note: 'each rect in its own color-matrix break' },
  { id: 'rect-clipped-k8', groups: N / K, note: `${K} rects per clip` },
  { id: 'grad-plain',      groups: 0,     note: 'N gradient rects, never batched' },
  { id: 'grad-clipped',    groups: N,     note: 'each gradient in its own clip' },
  { id: 'grad-cmbreak',    groups: N,     note: 'each gradient in its own color-matrix break' },
  { id: 'grad-clipped-k8', groups: N / K, note: `${K} gradients per clip` },
] as const;

type VariantId = (typeof VARIANTS)[number]['id'];

interface Cell { run: number; variant: VariantId; perFrameMs: number }

test.setTimeout(1_800_000);

test('clip cost: stencil versus batch break', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  const cells: Cell[] = [];
  const total = VARIANTS.length * RUNS;

  await page.exposeFunction('__clipReport', (msg: unknown) => {
    const m = msg as { type: string } & Record<string, unknown>;
    if (m.type === 'header') {
      console.log('');
      console.log(`Clip cost — 800x600, dpr 1, on ${String(m.glRenderer)}`);
      console.log(`collected between measurements: ${String(m.gcAvailable)}`);
      console.log(`every variant paints something: ${String(m.allPaint)}`);
      if (m.notPainting) console.log(`  NOT PAINTING: ${String(m.notPainting)}`);
      console.log(`${N} leaves per frame; ${total} cells`);
      console.log('');
      return;
    }
    const c = m as unknown as Cell & { index: number };
    cells.push({ run: c.run, variant: c.variant, perFrameMs: c.perFrameMs });
    console.log(
      `  ${String(c.index).padStart(2)}/${total}  run ${c.run}  `
      + `${c.variant.padEnd(16)} ${c.perFrameMs.toFixed(3)} ms/frame`,
    );
  });

  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { paints, glRenderer } = await page.evaluate(
    async ({ root, n, k, runs, variants }) => {
      const report = (globalThis as unknown as {
        __clipReport: (m: unknown) => Promise<void>;
      }).__clipReport;

      const { WeaselRenderer } = await import(
        /* @vite-ignore */ `/weasel/@fs${root}/packages/core/src/renderer/index.ts`
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

      const solidLeaf = (i: number) => ({
        kind: 'path',
        path: { kind: 'rect', x: px(i), y: py(i), width: 36, height: 36 },
        fill: { fill: 'solid', color: i % 2 ? '#3366cc' : '#cc6633' },
      });

      const gradLeaf = (i: number) => {
        const x = px(i);
        const y = py(i);
        return {
          kind: 'path',
          path: { kind: 'rect', x, y, width: 36, height: 36 },
          fill: {
            fill: 'linear-gradient',
            from: { x, y }, to: { x: x + 36, y: y + 36 },
            stops: [{ offset: 0, color: '#204080' }, { offset: 1, color: '#f0b040' }],
          },
        };
      };

      const clipPath = (i: number) => ({
        kind: 'rect', x: px(i) - 6, y: py(i) - 6, width: 100, height: 100,
      });

      /**
       * Two color matrices that differ, alternated per group. Each is
       * off-identity by a bias too small to see, which is all
       * `stagedStateIsLive` needs to declare the run dead — and identity is
       * excluded on purpose, since it would fold alpha and compare equal.
       */
      const cm = (i: number) => {
        const b = i % 2 === 0 ? 0.002 : 0.004;
        return [
          1, 0, 0, 0, b, 0, 1, 0, 0, b,
          0, 0, 1, 0, b, 0, 0, 0, 1, 0,
        ];
      };

      /** Built once and held: the caches key on object identity, so fresh
       *  leaves per measurement would price tessellation and uploads instead of
       *  a steady-state frame. */
      const solids: unknown[] = [];
      const grads: unknown[] = [];
      for (let i = 0; i < n; i++) { solids.push(solidLeaf(i)); grads.push(gradLeaf(i)); }

      function chunk(leaves: unknown[], size: number, wrap: (i: number, kids: unknown[]) => unknown) {
        const out: unknown[] = [];
        for (let i = 0; i < leaves.length; i += size) {
          out.push(wrap(i, leaves.slice(i, i + size)));
        }
        return out;
      }

      function buildVariant(id: string): unknown[] {
        const leaves = id.startsWith('grad') ? grads : solids;
        if (id.endsWith('-plain')) return leaves;
        if (id.endsWith('-k8')) {
          return chunk(leaves, k, (i, kids) => ({ kind: 'group', clip: clipPath(i), children: kids }));
        }
        if (id.endsWith('-cmbreak')) {
          return chunk(leaves, 1, (i, kids) => ({ kind: 'group', colorMatrix: cm(i), children: kids }));
        }
        return chunk(leaves, 1, (i, kids) => ({ kind: 'group', clip: clipPath(i), children: kids }));
      }

      /** Built once per variant, then reused: rebuilding the wrappers per
       *  measurement would add allocation to the timed comparison. */
      const built: Record<string, unknown[]> = {};
      for (const v of variants) built[v.id] = buildVariant(v.id);

      const collect = (globalThis as { gc?: (opts?: unknown) => void }).gc;
      const gcAvailable = typeof collect === 'function';

      function timeBlock(cmds: unknown[], frames: number): number {
        if (collect) {
          collect({ type: 'major', execution: 'sync' });
          collect({ type: 'major', execution: 'sync' });
        }
        renderer.render(cmds, identity);
        gl.finish();
        const t0 = performance.now();
        for (let f = 0; f < frames; f++) renderer.render(cmds, identity);
        gl.finish();
        return (performance.now() - t0) / frames;
      }

      const TARGET_BLOCK_MS = 150;
      function measure(cmds: unknown[]): number {
        for (let i = 0; i < 3; i++) renderer.render(cmds, identity);
        gl.finish();
        const rough = timeBlock(cmds, 4);
        const frames = Math.min(80, Math.max(4, Math.round(TARGET_BLOCK_MS / Math.max(rough, 0.05))));
        return timeBlock(cmds, frames);
      }

      /** A variant that silently draws nothing measures free, which is the one
       *  failure mode that turns a wrong number into a confident one. */
      function paintsAnything(id: string): boolean {
        renderer.render([built[id][0]], identity);
        gl.finish();
        const buf = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        for (let p = 3; p < buf.length; p += 4) if (buf[p] !== 0) return true;
        return false;
      }

      const paints: Record<string, boolean> = {};
      for (const v of variants) paints[v.id] = paintsAnything(v.id);
      const notPainting = variants.filter((v) => !paints[v.id]).map((v) => v.id);

      // Pay this context's one-time costs before the first timed block.
      for (const v of variants) {
        for (let i = 0; i < 3; i++) renderer.render(built[v.id], identity);
      }
      gl.finish();

      await report({
        type: 'header', glRenderer, gcAvailable,
        allPaint: notPainting.length === 0,
        notPainting: notPainting.join(', '),
      });

      let index = 0;
      for (let run = 1; run <= runs; run++) {
        for (const v of variants) {
          const perFrameMs = +measure(built[v.id]).toFixed(4);
          index += 1;
          await report({ type: 'cell', index, run, variant: v.id, perFrameMs });
        }
      }

      renderer.dispose();
      return { paints, glRenderer };
    },
    { root: repoRoot, n: N, k: K, runs: RUNS, variants: VARIANTS.map((v) => ({ id: v.id })) },
  );

  // ─── analysis ──────────────────────────────────────────────────────────

  const runs = Array.from({ length: RUNS }, (_, i) => i + 1);
  const med = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)];
  const at = (run: number, v: VariantId) => cells.find((c) => c.run === run && c.variant === v)!.perFrameMs;
  const ms = (v: VariantId) => med(runs.map((r) => at(r, v)));
  const lo = (v: VariantId) => Math.min(...runs.map((r) => at(r, v)));
  const hi = (v: VariantId) => Math.max(...runs.map((r) => at(r, v)));

  /** Per-run deltas, then a median — not a delta of medians, which would mix
   *  two runs' thermal states into one figure. */
  const deltaUs = (a: VariantId, b: VariantId, divisor: number) =>
    med(runs.map((r) => ((at(r, a) - at(r, b)) * 1000) / divisor));

  const stencilOnly = deltaUs('grad-clipped', 'grad-plain', N);
  const clipTotal = deltaUs('rect-clipped', 'rect-plain', N);
  const breakShare = clipTotal - stencilOnly;
  const cmBreakRaw = deltaUs('rect-cmbreak', 'rect-plain', N);
  const cmUploadOnly = deltaUs('grad-cmbreak', 'grad-plain', N);
  const cmBreak = cmBreakRaw - cmUploadOnly;
  const clipEntryK8 = deltaUs('rect-clipped-k8', 'rect-plain', N / K);
  const stencilEntryK8 = deltaUs('grad-clipped-k8', 'grad-plain', N / K);

  const num = (x: number) => x.toFixed(2);
  const lines = [
    '',
    `Clip cost — 800x600, dpr 1, on ${glRenderer}`,
    `${N} leaves per frame, ${RUNS} runs; median across runs, range in parens.`,
    '',
    '| variant | ms/frame | what it holds |',
    '|---|---:|---|',
  ];
  for (const v of VARIANTS) {
    lines.push(`| ${v.id} | ${ms(v.id).toFixed(2)} (${lo(v.id).toFixed(2)}–${hi(v.id).toFixed(2)}) | ${v.note} |`);
  }
  lines.push(
    '',
    '| what | us | how |',
    '|---|---:|---|',
    `| stencil push + pop | ${num(stencilOnly)} | grad-clipped − grad-plain, per clip |`,
    `| clip entry, all in | ${num(clipTotal)} | rect-clipped − rect-plain, per clip |`,
    `| ...of which the batch break | ${num(breakShare)} | the difference between those two |`,
    `| one solid-batch flush | ${num(cmBreak)} | rect-cmbreak − grad-cmbreak, both net of plain |`,
    `| clip entry at ${K} leaves | ${num(clipEntryK8)} | rect-clipped-k8 − rect-plain, per clip |`,
    `| stencil at ${K} leaves | ${num(stencilEntryK8)} | grad-clipped-k8 − grad-plain, per clip |`,
    '',
    `stencil is ${((stencilOnly / clipTotal) * 100).toFixed(0)}% of clip entry; `
    + `the batch break is ${((breakShare / clipTotal) * 100).toFixed(0)}%.`,
  );
  console.log(lines.join('\n'));

  expect(errors).toEqual([]);
  for (const v of VARIANTS) {
    expect(paints[v.id], `${v.id}: rendered nothing`).toBe(true);
  }
  expect(cells.length).toBe(total);
  // A clipped frame that did not cost more than its unclipped twin means the
  // variant is not doing what its name says.
  expect(clipTotal, 'clipping a rect should cost more than not clipping it').toBeGreaterThan(0);
  expect(stencilOnly, 'clipping a gradient should cost more than not clipping it').toBeGreaterThan(0);
});
