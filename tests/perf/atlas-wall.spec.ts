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
 * Our sheets are 16x16 tiles, the largest under 1MB. Three knobs reach the
 * consumer's instead:
 *
 *   - `WEASEL_PERF_SHEET`    — every sheet this many px square (theirs was
 *                              5652, ~122MB), tiles kept at their size and
 *                              cells sampling tiles spread across all of it.
 *   - `WEASEL_PERF_CELLS`    — the rung ladder, e.g. `56,42,28` for 1:1,
 *                              1.33:1 and 2:1 under `wall-min`.
 *   - `WEASEL_PERF_VARIANTS` — the variants to run; only their sheets are built.
 *
 * This reports; it does not gate. See `tests/perf/README.md`.
 */
import { test, expect } from '@playwright/test';
import { isolate } from './lib/isolate';
import { metric, rounds, startRun } from './lib/result';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** The consumer's viewport, so the rung counts land near its own. */
const W = 1200;
const H = 900;
const GAP = 4;

const list = (raw: string | undefined): string[] | undefined =>
  raw?.split(',').map((x) => x.trim()).filter(Boolean);

/** On-screen cell sizes, largest first — the ladder the consumer walked. */
const CELLS = list(process.env.WEASEL_PERF_CELLS)?.map(Number) ?? [56, 48, 32, 24, 16, 12, 8];

/** Side of every sheet in px, or 0 for 16x16 tiles of the tile's size. */
const SHEET = Number(process.env.WEASEL_PERF_SHEET ?? 0);

const RUNS = rounds(3);

const ALL_VARIANTS = [
  'rect', 'img-1x', 'wall-1x',
  'wall-mag-near', 'wall-mag-lin',
  'wall-min-near', 'wall-min-lin',
] as const;
type Variant = (typeof ALL_VARIANTS)[number];
const ONLY = list(process.env.WEASEL_PERF_VARIANTS);
const VARIANTS: readonly Variant[] = ONLY ? ALL_VARIANTS.filter((v) => ONLY.includes(v)) : ALL_VARIANTS;

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

test('atlas wall: where per-command cost steps', async ({ page, browser, browserName }) => {
  const run = startRun('atlas-wall', {
    viewport: `${W}x${H}`, dpr: 1, gap: GAP, cells: CELLS, variants: [...VARIANTS], runs: RUNS,
    sheetPx: SHEET || 'tile x 16',
  });
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
      run.params({ gcAvailable: Boolean(m.gcAvailable) });
      console.log('');
      console.log(`Atlas wall — ${W}x${H}, dpr 1, on ${String(m.glRenderer)}`);
      console.log(`sheets: ${String(m.sheets)}`);
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

  await isolate(page);
  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { paints, glRenderer } = await page.evaluate(
    async ({ root, w, h, gap, cellSizes, runs, variants, sheetPx }) => {
      const report = (globalThis as unknown as {
        __wallReport: (m: unknown) => Promise<void>;
      }).__wallReport;

      const base = `/weasel/@fs${root}`;
      const rendererMod = await import(/* @vite-ignore */ `${base}/packages/core/src/renderer/index.ts`);
      const { WeaselRenderer } = rendererMod;
      const { timeInterleaved } = await import(/* @vite-ignore */ `${base}/tests/perf/lib/frameTiming.ts`);

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

      /** One atlas per tile size: 16x16 tiles of `tile` px, or as many as fit
       *  `sheetPx` square, each a distinct block of color so a wrong source
       *  rect shows up as a flat cell. */
      const tilesPerSide = (tile: number): number => (sheetPx ? Math.floor(sheetPx / tile) : 16);
      async function atlas(tile: number): Promise<ImageBitmap> {
        const side = sheetPx || tile * 16;
        const across = tilesPerSide(tile);
        const px = new ImageData(side, side);
        for (let y = 0; y < side; y++) {
          for (let x = 0; x < side; x++) {
            const t = (Math.floor(y / tile) * across + Math.floor(x / tile)) % 251;
            const p = (y * side + x) * 4;
            px.data[p] = (t * 37) % 256;
            px.data[p + 1] = (t * 17 + (x % tile) * 8) % 256;
            px.data[p + 2] = (t * 91 + (y % tile) * 8) % 256;
            px.data[p + 3] = 255;
          }
        }
        return createImageBitmap(px);
      }

      const tileFor = (variant: string, cellPx: number): number =>
        variant.startsWith('wall-mag') ? 8 : variant.startsWith('wall-min') ? 56 : cellPx;
      const tileSizes = Array.from(new Set(
        variants.filter((v: string) => v !== 'rect')
          .flatMap((v: string) => cellSizes.map((c: number) => tileFor(v, c))),
      ));
      const sheets = new Map<number, ImageBitmap>();
      for (const t of tileSizes) sheets.set(t, await atlas(t));
      const sheetsLabel = tileSizes.map((t) => {
        const b = sheets.get(t)!;
        return `${t}px tiles on ${b.width}px (${((b.width * b.height * 4) / 2 ** 20).toFixed(1)} MiB)`;
      }).join('; ') || 'none';

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
        const tile = tileFor(variant, cellPx);
        const sheet = sheets.get(tile)!;
        const across = tilesPerSide(tile);
        const count = across * across;
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
            // On a large sheet, a stride coprime with the tile count spreads
            // the wall's reads across all of it rather than its first rows.
            const t = sheetPx ? (i * 7919) % count : i % count;
            out.push({
              kind: 'image',
              image: sheet,
              x, y, w: cellPx, h: cellPx,
              source: {
                x: (t % across) * tile, y: Math.floor(t / across) * tile,
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
        type: 'header', glRenderer, gcAvailable, sheets: sheetsLabel,
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
          if (collect) collect({ type: 'major', execution: 'sync' });
          const timed = await timeInterleaved(gl, variants.map((v: string) => ({
            id: v, frame: () => renderer.render(pools.get(`${rung.cellPx}|${v}`)!, identity),
          })));
          for (const v of variants) {
            const cmds = pools.get(`${rung.cellPx}|${v}`)!;
            const perFrameMs = +timed[v].net.toFixed(4);
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
    { root: repoRoot, w: W, h: H, gap: GAP, cellSizes: CELLS, runs: RUNS, variants: [...VARIANTS], sheetPx: SHEET },
  );

  // ─── report ────────────────────────────────────────────────────────────

  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const at = (cellPx: number, v: Variant) =>
    cells.filter((c) => c.cellPx === cellPx && c.variant === v);
  const pad = (s: string, n: number) => s.padStart(n);
  const gridCells = (cellPx: number) =>
    Math.max(1, Math.floor((W + GAP) / (cellPx + GAP))) * Math.max(1, Math.floor((H + GAP) / (cellPx + GAP)));

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
    const n = gridCells(cellPx);
    const row = VARIANTS.map((v) => {
      const cs = at(cellPx, v);
      return cs.length ? med(cs.map((c) => c.perFrameMs)).toFixed(2) : '—';
    });
    lines.push(`| ${cellPx}px | ${n} | ${row.join(' | ')} |`);
  }

  const pairs = (['mag', 'min'] as const).filter((k) =>
    VARIANTS.includes(`wall-${k}-near`) && VARIANTS.includes(`wall-${k}-lin`));
  if (pairs.length) {
    lines.push('', '**nearest / linear**, per frame', '',
      `| cell | ${pairs.map((k) => `wall-${k}`).join(' | ')} |`,
      `|---:|${pairs.map(() => '---:').join('|')}|`);
    for (const cellPx of CELLS) {
      const row = pairs.map((k) => {
        const near = med(at(cellPx, `wall-${k}-near`).map((c) => c.perFrameMs));
        const lin = med(at(cellPx, `wall-${k}-lin`).map((c) => c.perFrameMs));
        return (near / lin).toFixed(2);
      });
      lines.push(`| ${cellPx}px | ${row.join(' | ')} |`);
    }
  }

  lines.push('', '**Draw calls per frame** (drawElements + drawArrays / buffer writes)', '',
    `| cell | cmds | ${VARIANTS.map((v) => v).join(' | ')} |`,
    `|---:|---:|${VARIANTS.map(() => '---:').join('|')}|`);
  for (const cellPx of CELLS) {
    const n = gridCells(cellPx);
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

  run.machine({ glRenderer, browser: `${browserName} ${browser.version()}` });
  for (const cellPx of CELLS) {
    for (const v of VARIANTS) {
      const cs = at(cellPx, v);
      const c = counts.find((x) => x.cellPx === cellPx && x.variant === v);
      if (!cs.length || !c) continue;
      const frame = cs.map((x) => x.perFrameMs);
      const stat = `median of ${RUNS} runs; each the median of 40 single-frame samples less the least frame that draws, one frame a task (lib/frameTiming.ts)`;
      run.item(`${v} ${cellPx}px`, {
        perFrame: metric(med(frame), 'ms', stat, frame),
        perCommand: metric((med(frame) * 1000) / cs[0].commands, 'us', stat),
        commands: metric(cs[0].commands, 'count', 'commands in the frame'),
        drawCalls: metric((c.calls.drawElements ?? 0) + (c.calls.drawArrays ?? 0), 'count', 'one untimed frame'),
        bufferWrites: metric((c.calls.bufferSubData ?? 0) + (c.calls.bufferData ?? 0), 'count', 'one untimed frame'),
      }, { variant: v, cellPx });
    }
  }
  run.write();
});
