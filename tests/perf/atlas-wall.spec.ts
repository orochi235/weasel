/**
 * A wall of atlas cells: where the per-command cost steps, and what steps it.
 *
 * The shape comes from a consumer drawing a corpus wall — a grid of thumbnails,
 * each cell a ground rect under one atlas quad — through `renderSceneToCanvas`
 * with the whole list as `extraCommands`. Measured there, per-command cost was
 * flat at ~1.3 us up to ~800 commands and flat at ~7.3 us past ~1,400, with
 * nothing in between: a step, not a curve. A step reads as a limit being
 * crossed rather than as fill rate.
 *
 * That ladder walked two things at once, because it shrank the cell to fit more
 * on screen: the command count rose, and the tile the cell samples changed with
 * it. This separates them. Every rung holds the painted area constant (the grid
 * fills one 1200x900 viewport whatever the cell size), and the variants differ
 * only in what each cell samples:
 *
 *   - `rect`      — ground rects alone. The batched floor.
 *   - `img-1x`    — atlas quads alone, tile size == cell size.
 *   - `wall-1x`   — ground rect + quad per cell, tile == cell. The wall's shape
 *                   with sampling held at 1:1, so only N varies down the ladder.
 *   - `wall-mag`  — the same, sampling an 8px tile into every cell.
 *   - `wall-min`  — the same, sampling a 56px tile into every cell.
 *
 * `mag` and `min` run under both filters, because the consumer also measured
 * `sampling: 'nearest'` costing several times `'linear'` on a minified draw.
 *
 * Draw calls are counted in an untimed pass, so a variant whose run stopped
 * coalescing is visible as a count rather than inferred from a time.
 *
 * This reports; it does not gate. See `tests/bench/README.md`.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** The consumer's viewport, so the rung counts land near its own. */
const W = 1200;
const H = 900;
const GAP = 4;

/** On-screen cell sizes, largest first — the ladder the consumer walked. */
const CELLS = [56, 48, 32, 24, 16, 12, 8];

const RUNS = 3;

const VARIANTS = [
  'rect', 'img-1x', 'wall-1x',
  'wall-mag-near', 'wall-mag-lin',
  'wall-min-near', 'wall-min-lin',
] as const;
type Variant = (typeof VARIANTS)[number];

interface Cell {
  run: number;
  cellPx: number;
  variant: Variant;
  /** Draw commands in the frame — 1 or 2 per grid cell. */
  commands: number;
  perFrameMs: number;
}

interface Counts { cellPx: number; variant: Variant; commands: number; calls: Record<string, number> }

test.setTimeout(1_800_000);

test('atlas wall: where per-command cost steps', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  const cells: Cell[] = [];
  const counts: Counts[] = [];
  const total = CELLS.length * VARIANTS.length * RUNS;

  await page.exposeFunction('__wallReport', (msg: unknown) => {
    const m = msg as { type: string } & Record<string, unknown>;
    if (m.type === 'header') {
      console.log('');
      console.log(`Atlas wall — ${W}x${H}, dpr 1, on ${String(m.glRenderer)}`);
      console.log(`collected between measurements: ${String(m.gcAvailable)}`);
      console.log(`every variant paints something: ${String(m.allPaint)}`);
      if (m.notPainting) console.log(`  NOT PAINTING: ${String(m.notPainting)}`);
      console.log(`${total} cells (${CELLS.length} rungs x ${VARIANTS.length} variants x ${RUNS} runs)`);
      console.log('');
      return;
    }
    if (m.type === 'calls') {
      counts.push(m as unknown as Counts);
      return;
    }
    const c = m as unknown as Cell & { index: number };
    cells.push({
      run: c.run, cellPx: c.cellPx, variant: c.variant,
      commands: c.commands, perFrameMs: c.perFrameMs,
    });
    console.log(
      `  ${String(c.index).padStart(3)}/${total}  run ${c.run}  `
      + `${c.cellPx}px`.padStart(5) + `  ${c.variant}`.padEnd(16)
      + ` ${String(c.commands).padStart(5)} cmds`
      + ` ${c.perFrameMs.toFixed(3)} ms/frame`
      + `  ${((c.perFrameMs * 1000) / c.commands).toFixed(2)} us/cmd`,
    );
  });

  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { paints, glRenderer } = await page.evaluate(
    async ({ root, w, h, gap, cellSizes, runs, variants }) => {
      const report = (globalThis as unknown as {
        __wallReport: (m: unknown) => Promise<void>;
      }).__wallReport;

      const base = `/weasel/@fs${root}`;
      const rendererMod = await import(/* @vite-ignore */ `${base}/packages/core/src/renderer/index.ts`);
      const { WeaselRenderer } = rendererMod;

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

      /** One atlas per tile size: 16x16 tiles of `tile` px, each a distinct
       *  block of color so a wrong source rect shows up as a flat cell. */
      const TILES = 16;
      async function atlas(tile: number): Promise<ImageBitmap> {
        const side = tile * TILES;
        const px = new ImageData(side, side);
        for (let y = 0; y < side; y++) {
          for (let x = 0; x < side; x++) {
            const t = (Math.floor(y / tile) * TILES + Math.floor(x / tile)) % 251;
            const p = (y * side + x) * 4;
            px.data[p] = (t * 37) % 256;
            px.data[p + 1] = (t * 17 + (x % tile) * 8) % 256;
            px.data[p + 2] = (t * 91 + (y % tile) * 8) % 256;
            px.data[p + 3] = 255;
          }
        }
        return createImageBitmap(px);
      }

      const tileSizes = Array.from(new Set([...cellSizes, 8, 56]));
      const sheets = new Map<number, ImageBitmap>();
      for (const t of tileSizes) sheets.set(t, await atlas(t));

      const renderer = new WeaselRenderer({ gl, canvas, width: w, height: h, dpr: 1 });

      interface Rung { cellPx: number; cols: number; rows: number; n: number }
      const rungs: Rung[] = cellSizes.map((cellPx: number) => {
        const cols = Math.max(1, Math.floor((w + gap) / (cellPx + gap)));
        const rows = Math.max(1, Math.floor((h + gap) / (cellPx + gap)));
        return { cellPx, cols, rows, n: cols * rows };
      });

      const GROUNDS = ['#2b3a55', '#553a2b', '#2b553a', '#4a2b55'];

      function build(rung: Rung, variant: string): unknown[] {
        const { cellPx, cols, n } = rung;
        const tile = variant === 'wall-mag-near' || variant === 'wall-mag-lin'
          ? 8
          : variant === 'wall-min-near' || variant === 'wall-min-lin'
            ? 56
            : cellPx;
        const sheet = sheets.get(tile)!;
        const sampling = variant.endsWith('-lin') ? 'linear' : 'nearest';
        const withGround = variant === 'rect' || variant.startsWith('wall');
        const withImage = variant !== 'rect';
        const out: unknown[] = [];
        for (let i = 0; i < n; i++) {
          const x = (i % cols) * (cellPx + gap);
          const y = Math.floor(i / cols) * (cellPx + gap);
          if (withGround) {
            out.push({
              kind: 'path',
              path: { kind: 'rect', x, y, width: cellPx, height: cellPx },
              fill: { fill: 'solid', color: GROUNDS[i % GROUNDS.length] },
            });
          }
          if (withImage) {
            const t = i % (TILES * TILES);
            out.push({
              kind: 'image',
              image: sheet,
              x, y, w: cellPx, h: cellPx,
              source: {
                x: (t % TILES) * tile, y: Math.floor(t / TILES) * tile,
                w: tile, h: tile,
              },
              sampling,
            });
          }
        }
        return out;
      }

      /** Built once and held: every cache in the kit keys on object identity,
       *  so rebuilding per measurement would price tessellation and uploads. */
      const pools = new Map<string, unknown[]>();
      for (const rung of rungs) {
        for (const v of variants) pools.set(`${rung.cellPx}|${v}`, build(rung, v));
      }

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

      const TARGET_BLOCK_MS = 100;
      function measure(cmds: unknown[]): number {
        for (let i = 0; i < 3; i++) renderer.render(cmds, identity);
        gl.finish();
        const rough = timeBlock(cmds, 4);
        const frames = Math.min(60, Math.max(4, Math.round(TARGET_BLOCK_MS / Math.max(rough, 0.05))));
        return timeBlock(cmds, frames);
      }

      /** GL calls one frame makes, counted with the clock off. Wrappers are own
       *  properties shadowing the prototype, removed before anything is timed. */
      const COUNTED = [
        'drawElements', 'drawArrays', 'bufferSubData', 'bufferData',
        'bindTexture', 'bindVertexArray', 'useProgram', 'texImage2D', 'texSubImage2D',
      ];
      function countCalls(cmds: unknown[]): Record<string, number> {
        const tally: Record<string, number> = {};
        const anyGl = gl as unknown as Record<string, unknown>;
        for (const name of COUNTED) {
          tally[name] = 0;
          const orig = (anyGl[name] as (...a: unknown[]) => unknown).bind(gl);
          anyGl[name] = (...a: unknown[]) => { tally[name] += 1; return orig(...a); };
        }
        renderer.render(cmds, identity);
        gl.finish();
        for (const name of COUNTED) delete anyGl[name];
        return tally;
      }

      function paintsAnything(cmds: unknown[]): boolean {
        renderer.render(cmds, identity);
        gl.finish();
        const buf = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        for (let p = 3; p < buf.length; p += 4) if (buf[p] !== 0) return true;
        return false;
      }

      // One-time costs — program links, texture uploads, batch buffer growth —
      // paid before the first timed block, so no cell is charged for the
      // feature it happened to reach first.
      for (const [, cmds] of pools) renderer.render(cmds, identity);
      gl.finish();

      const paints: Record<string, boolean> = {};
      for (const v of variants) {
        paints[v] = paintsAnything(pools.get(`${rungs[0].cellPx}|${v}`)!);
      }
      const notPainting = variants.filter((v: string) => !paints[v]);

      await report({
        type: 'header', glRenderer, gcAvailable,
        allPaint: notPainting.length === 0,
        notPainting: notPainting.join(', '),
      });

      for (const rung of rungs) {
        for (const v of variants) {
          const cmds = pools.get(`${rung.cellPx}|${v}`)!;
          await report({
            type: 'calls', cellPx: rung.cellPx, variant: v,
            commands: cmds.length, calls: countCalls(cmds),
          });
        }
      }

      let index = 0;
      for (let run = 1; run <= runs; run++) {
        for (const rung of rungs) {
          for (const v of variants) {
            const cmds = pools.get(`${rung.cellPx}|${v}`)!;
            const perFrameMs = +measure(cmds).toFixed(4);
            index += 1;
            await report({
              type: 'cell', index, run, cellPx: rung.cellPx, variant: v,
              commands: cmds.length, perFrameMs,
            });
          }
        }
      }

      renderer.dispose();
      return { paints, glRenderer };
    },
    { root: repoRoot, w: W, h: H, gap: GAP, cellSizes: CELLS, runs: RUNS, variants: [...VARIANTS] },
  );

  // ─── report ────────────────────────────────────────────────────────────

  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const at = (cellPx: number, v: Variant) =>
    cells.filter((c) => c.cellPx === cellPx && c.variant === v);
  const pad = (s: string, n: number) => s.padStart(n);

  const lines: string[] = [
    '',
    `Atlas wall — ${W}x${H}, dpr 1, on ${glRenderer}`,
    `${RUNS} runs; median across runs. Painted area is constant down the ladder.`,
    '',
    '**Per draw command** (us)',
    '',
    `| cell | ${VARIANTS.map((v) => v).join(' | ')} |`,
    `|---:|${VARIANTS.map(() => '---:').join('|')}|`,
  ];
  for (const cellPx of CELLS) {
    const row = VARIANTS.map((v) => {
      const cs = at(cellPx, v);
      if (!cs.length) return '—';
      return ((med(cs.map((c) => c.perFrameMs)) * 1000) / cs[0].commands).toFixed(2);
    });
    lines.push(`| ${cellPx}px | ${row.join(' | ')} |`);
  }

  lines.push('', '**Per frame** (ms)', '',
    `| cell | cells | ${VARIANTS.map((v) => v).join(' | ')} |`,
    `|---:|---:|${VARIANTS.map(() => '---:').join('|')}|`);
  for (const cellPx of CELLS) {
    const n = at(cellPx, 'rect')[0]?.commands ?? 0;
    const row = VARIANTS.map((v) => {
      const cs = at(cellPx, v);
      return cs.length ? med(cs.map((c) => c.perFrameMs)).toFixed(2) : '—';
    });
    lines.push(`| ${cellPx}px | ${n} | ${row.join(' | ')} |`);
  }

  lines.push('', '**Draw calls per frame** (drawElements + drawArrays / buffer writes)', '',
    `| cell | cmds | ${VARIANTS.map((v) => v).join(' | ')} |`,
    `|---:|---:|${VARIANTS.map(() => '---:').join('|')}|`);
  for (const cellPx of CELLS) {
    const n = counts.find((c) => c.cellPx === cellPx && c.variant === 'rect')?.commands ?? 0;
    const row = VARIANTS.map((v) => {
      const c = counts.find((x) => x.cellPx === cellPx && x.variant === v);
      if (!c) return '—';
      const draws = (c.calls.drawElements ?? 0) + (c.calls.drawArrays ?? 0);
      const writes = (c.calls.bufferSubData ?? 0) + (c.calls.bufferData ?? 0);
      return `${draws} / ${writes}`;
    });
    lines.push(`| ${cellPx}px | ${n} | ${row.join(' | ')} |`);
  }

  lines.push('');
  console.log(lines.join('\n'));
  void pad;

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([]);
  for (const v of VARIANTS) expect(paints[v], `${v} painted nothing`).toBe(true);
});
