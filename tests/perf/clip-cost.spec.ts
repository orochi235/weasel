/**
 * What entering a clip actually pays for: the stencil, or the batch break.
 *
 * Two mechanisms could be charging for clip entry:
 *
 *   - the **stencil**: `pushClip` and `popClip` each rasterize the clip path
 *     into the stencil buffer. Inherent to how clipping works here.
 *   - the **batch break**: `runTakes` compares `clipDepth`, so a
 *     clipped rect cannot share a draw with its unclipped neighbors.
 *
 * Separating them needs contents that would not have batched anyway. An
 * even-odd fill too costly to resolve never joins the batch (`kinds.ts`'s
 * `stencil`; any other even-odd fill has since 2026-10-31), so wrapping one in a clip adds the
 * stencil and nothing else (the `pat-` frames are named for the pattern-filled
 * rect they used until 2026-10-30, when patterns joined the batch); wrapping a *solid* rect adds the stencil and the
 * break. The difference between those two deltas is the break's share. The
 * spec checks that premise by counting draws.
 *
 * The `-clipped` frames clip to a quad with one slanted edge, because an
 * axis-aligned rect clip takes no stencil and breaks nothing: staged geometry
 * is cut to it on the CPU (`batchClip.ts`). `rect-rectclip` prices that cut.
 *
 * `cmbreak` is a second, independent estimate of one flush: a group whose color
 * matrix differs from the one before it breaks the run without touching the
 * stencil, and its `pat-` twin subtracts the color-matrix upload.
 *
 * `-k8` puts eight leaves under each clip instead of one. If entry is the whole
 * price, the per-group figure holds and the per-leaf figure falls by eight.
 *
 * The `ss-` frames draw into a second, single-sampled canvas, the only kind of
 * target where a convex clip is decided in the batch shader (`batchHull.ts`):
 * `ss-rect-hullclip` is `rect-clipped` there, and `ss-rect-stencilclip` the
 * same frame with the shader clip turned off. Before timing, the spec checks on
 * that canvas that a solid under each clip keeps exactly the pixels a fill
 * drawing for itself through the stencil keeps.
 *
 * `ss-slant-rectclip` puts a turned rect across each axis-aligned rect clip
 * there: the CPU cut refuses it, and the rect clip, snapped to the hull grid,
 * goes to the shader as a hull. `ss-slant-rectstencil` is the same frame with
 * the shader clip off, where the rect clip goes on the stencil instead.
 * `ss-slant-nest3` puts each turned rect under three nested rect clips, twelve
 * half-planes before any facing the same way are merged.
 *
 * This reports; it does not gate. See `tests/perf/README.md`.
 */
import { test, expect } from '@playwright/test';
import { metric, rounds, startRun } from './lib/result';
import { isolate } from './lib/isolate';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Leaves per frame, the same in every variant. */
const N = 512;

/** Leaves per group in the `-k8` variants. */
const K = 8;

const RUNS = rounds(3);

/** `groups` is how many clips (or color-matrix breaks) the frame contains. */
const VARIANTS = [
  { id: 'rect-plain',      groups: 0,     note: 'N solid rects, one batch' },
  { id: 'rect-clipped',    groups: N,     note: 'each rect in its own clip' },
  { id: 'rect-cmbreak',    groups: N,     note: 'each rect in its own color-matrix break' },
  { id: 'rect-clipped-k8', groups: N / K, note: `${K} rects per clip` },
  { id: 'rect-rectclip',   groups: N,     note: 'each rect in its own axis-aligned rect clip, cut on the CPU' },
  { id: 'pat-plain',       groups: 0,     note: 'N even-odd rects, never batched' },
  { id: 'pat-clipped',     groups: N,     note: 'each even-odd rect in its own clip' },
  { id: 'pat-cmbreak',     groups: N,     note: 'each even-odd rect in its own color-matrix break' },
  { id: 'pat-clipped-k8',  groups: N / K, note: `${K} even-odd rects per clip` },
  { id: 'ss-rect-plain',       groups: 0,     note: 'rect-plain on a single-sampled canvas' },
  { id: 'ss-rect-hullclip',    groups: N,     note: 'rect-clipped there, each clip decided in the batch shader' },
  { id: 'ss-rect-stencilclip', groups: N,     note: 'the same with the shader clip off: the stencil' },
  { id: 'ss-rect-hullclip-k8', groups: N / K, note: `${K} rects per shader-decided clip` },
  { id: 'ss-slant-plain',       groups: 0, note: 'N turned rects on a single-sampled canvas, one batch' },
  { id: 'ss-slant-rectclip',    groups: N, note: 'a turned rect across each rect clip, the rect tested as a hull' },
  { id: 'ss-slant-rectstencil', groups: N, note: 'the same with the shader clip off: the stencil' },
  { id: 'ss-slant-nest3',        groups: N, note: 'a turned rect across three nested rect clips' },
  { id: 'ss-slant-nest3stencil', groups: N, note: 'the same with the shader clip off: the stencil' },
] as const;

type VariantId = (typeof VARIANTS)[number]['id'];

interface Cell { run: number; variant: VariantId; perFrameMs: number }

test.setTimeout(1_800_000);

test('clip cost: stencil versus batch break', async ({ page, browser, browserName }) => {
  const run = startRun('clip-cost', { viewport: '800x600', dpr: 1, leaves: N, leavesPerClipK8: K, runs: RUNS });
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  const cells: Cell[] = [];
  const total = VARIANTS.length * RUNS;

  await page.exposeFunction('__clipReport', (msg: unknown) => {
    const m = msg as { type: string } & Record<string, unknown>;
    if (m.type === 'header') {
      run.params({ gcAvailable: Boolean(m.gcAvailable) });
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
      + `${c.variant.padEnd(21)} ${c.perFrameMs.toFixed(3)} ms/frame`,
    );
  });

  await isolate(page);
  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { paints, glRenderer, draws, agreement } = await page.evaluate(
    async ({ root, n, k, runs, variants }) => {
      const report = (globalThis as unknown as {
        __clipReport: (m: unknown) => Promise<void>;
      }).__clipReport;

      const { WeaselRenderer, registerTexture } = await import(
        /* @vite-ignore */ `/weasel/@fs${root}/packages/renderer/src/index.ts`
      );
      const { pathFromD } = await import(
        /* @vite-ignore */ `/weasel/@fs${root}/packages/geom/src/index.ts`
      );
      const { makeKindBuilders, checkerBitmap } = await import(
        /* @vite-ignore */ `/weasel/@fs${root}/tests/perf/lib/kinds.ts`
      );
      const { timeInterleaved } = await import(
        /* @vite-ignore */ `/weasel/@fs${root}/tests/perf/lib/frameTiming.ts`
      );
      // A solid's color matrix is mapped on the CPU and no longer breaks its
      // run; the `-cmbreak` frames time the break, so this turns that off.
      const { colorFolding } = await import(
        /* @vite-ignore */ `/weasel/@fs${root}/packages/renderer/src/draw.ts`
      );
      colorFolding.enabled = false;

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

      const ssCanvas = document.createElement('canvas');
      ssCanvas.width = W;
      ssCanvas.height = H;
      const ssGl = ssCanvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true, antialias: false });
      if (!ssGl) throw new Error('no single-sampled WebGL2 context');
      const ssRenderer = new WeaselRenderer({ gl: ssGl, canvas: ssCanvas, width: W, height: H, dpr: 1 });
      const variantsOf = ssRenderer._batchVariants();
      const hullsOffered = variantsOf.hulls;
      Object.defineProperty(variantsOf, 'hulls', { value: true, writable: true });
      const ssRender = (tree: unknown[], hulls: boolean) => {
        (variantsOf as { hulls: boolean }).hulls = hulls;
        ssRenderer.render(tree, identity);
      };

      const px = (i: number) => 20 + ((i * 37) % (W - 160));
      const py = (i: number) => 20 + ((i * 53) % (H - 160));
      /** `L a L b L a …`, 1026 edges of it: see `slantPath`. */
      const stencilPad = (a: string, b: string) => {
        let d = '';
        for (let k = 0; k < 1026; k++) d += ` L ${k % 2 ? b : a}`;
        return d;
      };

      const solidLeaf = (i: number) => ({
        kind: 'path',
        path: { kind: 'rect', x: px(i), y: py(i), width: 36, height: 36 },
        fill: { paint: { kind: 'solid', color: i % 2 ? '#3366cc' : '#cc6633' } },
      });

      const patLeaf = makeKindBuilders({
        W, H, bitmaps: [], pattern: registerTexture(await checkerBitmap()), shader: null,
      }).stencil;

      /** Its top edge slants by 2px, so only the stencil can express it. */
      const clipPath = (i: number) => {
        const x = px(i) - 6;
        const y = py(i) - 6;
        return pathFromD(`M ${x} ${y} L ${x + 100} ${y + 2} L ${x + 100} ${y + 100} L ${x} ${y + 100} Z`);
      };
      const rectClip = (i: number) => ({
        kind: 'rect', x: px(i) - 6, y: py(i) - 6, width: 100, height: 100,
      });
      /** `kids` under three nested rect clips, each tighter than the last on
       *  some side, off the hull grid by `off`. */
      const nest3 = (i: number, kids: unknown[], off = 0) => ({
        kind: 'group', clip: rectClip(i), children: [{
          kind: 'group',
          clip: { kind: 'rect', x: px(i) - 4 + off, y: py(i) - 8, width: 96, height: 100 - off },
          children: [{
            kind: 'group',
            clip: { kind: 'rect', x: px(i) - 7, y: py(i) - 3 - off, width: 94 + off, height: 96 },
            children: kids,
          }],
        }],
      });
      /** A 130 x 24 bar turned 20 degrees about the clip's center, so it
       *  crosses the clip's left and right edges. */
      /** With `touch`, a second contour of no area runs back and forth along
       *  the first edge, 1026 edges of it: an even-odd fill past what the
       *  tessellator resolves (`MAX_EVENODD_RESOLVE_WORK`) keeps the stencil,
       *  where any other would join the run. */
      const slantPath = (i: number, touch = false) => {
        const cx = px(i) + 44, cy = py(i) + 44, c = Math.cos(0.35), s = Math.sin(0.35);
        const pt = (x: number, y: number) => `${cx + x * c - y * s} ${cy + x * s + y * c}`;
        const extra = touch ? ` M ${pt(-65, -12)}${stencilPad(pt(65, -12), pt(-65, -12))} Z` : '';
        return pathFromD(`M ${pt(-65, -12)} L ${pt(65, -12)} L ${pt(65, 12)} L ${pt(-65, 12)} Z${extra}`);
      };
      const slantLeaf = (i: number) => ({
        kind: 'path',
        path: slantPath(i),
        fill: { paint: { kind: 'solid', color: i % 2 ? '#3366cc' : '#cc6633' } },
      });
      /** The same bar in green, drawn by the run or for itself. */
      const greenSlant = (i: number, own: boolean) => ({
        kind: 'path',
        path: own ? { ...slantPath(i, true), fillRule: 'evenodd' } : slantPath(i),
        fill: { paint: { kind: 'solid', color: '#00ff00' } },
      });

      /**
       * Two color matrices that differ, alternated per group. Identity is
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
       *  leaves per measurement would price tessellation and uploads. */
      const solids: unknown[] = [];
      const pats: unknown[] = [];
      const slants: unknown[] = [];
      for (let i = 0; i < n; i++) { solids.push(solidLeaf(i)); pats.push(patLeaf(i)); slants.push(slantLeaf(i)); }

      function chunk(leaves: unknown[], size: number, wrap: (i: number, kids: unknown[]) => unknown) {
        const out: unknown[] = [];
        for (let i = 0; i < leaves.length; i += size) {
          out.push(wrap(i, leaves.slice(i, i + size)));
        }
        return out;
      }

      function buildVariant(id: string): unknown[] {
        if (id === 'ss-slant-plain') return slants;
        if (id.startsWith('ss-slant-nest3')) return chunk(slants, 1, (i, kids) => nest3(i, kids));
        if (id.startsWith('ss-slant-rect')) {
          return chunk(slants, 1, (i, kids) => ({ kind: 'group', clip: rectClip(i), children: kids }));
        }
        if (id.startsWith('ss-')) {
          return buildVariant(id.slice(3).replace('hullclip', 'clipped').replace('stencilclip', 'clipped'));
        }
        const leaves = id.startsWith('pat') ? pats : solids;
        if (id.endsWith('-plain')) return leaves;
        if (id.endsWith('-k8')) {
          return chunk(leaves, k, (i, kids) => ({ kind: 'group', clip: clipPath(i), children: kids }));
        }
        if (id.endsWith('-rectclip')) {
          return chunk(leaves, 1, (i, kids) => ({ kind: 'group', clip: rectClip(i), children: kids }));
        }
        if (id.endsWith('-cmbreak')) {
          return chunk(leaves, 1, (i, kids) => ({ kind: 'group', colorMatrix: cm(i), children: kids }));
        }
        return chunk(leaves, 1, (i, kids) => ({ kind: 'group', clip: clipPath(i), children: kids }));
      }

      const built: Record<string, unknown[]> = {};
      for (const v of variants) built[v.id] = buildVariant(v.id);
      const frameOf = (id: string, tree: unknown[] = built[id]) => {
        if (!id.startsWith('ss-')) return () => renderer.render(tree, identity);
        const hulls = !id.includes('stencil');
        return () => ssRender(tree, hulls);
      };
      const glOf = (id: string) => (id.startsWith('ss-') ? ssGl : gl);

      /**
       * Each clip around a solid, which the shader clips, and around an
       * even-odd fill too costly to resolve, which draws for itself through the stencil:
       * the two must keep the same pixels, exactly. Also counts the pixels
       * where the shader-decided frame differs from the stencil clipping the
       * unsnapped path, which a rasterizer finer than a sixteenth of a pixel
       * can show.
       */
      function readSs(tree: unknown[], hulls: boolean): Uint8Array {
        ssRender(tree, hulls);
        const buf = new Uint8Array(W * H * 4);
        ssGl!.readPixels(0, 0, W, H, ssGl!.RGBA, ssGl!.UNSIGNED_BYTE, buf);
        return buf;
      }
      const diff = (a: Uint8Array, b: Uint8Array) => {
        let count = 0;
        for (let p = 0; p < a.length; p += 4) {
          if (a[p] !== b[p] || a[p + 1] !== b[p + 1] || a[p + 2] !== b[p + 2] || a[p + 3] !== b[p + 3]) count++;
        }
        return count;
      };
      const red = (i: number, own: boolean) => ({
        kind: 'path',
        path: own
          ? { ...pathFromD(`M ${px(i) - 10} ${py(i) - 10} h 120 v 120 h -120 Z M ${px(i) - 10} ${py(i) - 10}${stencilPad(`${px(i) + 110} ${py(i) - 10}`, `${px(i) - 10} ${py(i) - 10}`)} Z`), fillRule: 'evenodd' }
          : { kind: 'rect', x: px(i) - 10, y: py(i) - 10, width: 120, height: 120 },
        fill: { paint: { kind: 'solid', color: '#ff0000' } },
      });
      const agreeTree = (own: boolean) => Array.from({ length: 64 }, (_, i) => ({
        kind: 'group', clip: clipPath(i * 7), children: [red(i * 7, own)],
      }));
      /** A rect clip, nudged off the hull grid, around a turned solid and an
       *  axis-aligned one, both across it. */
      const rectAgreeTree = (own: boolean) => Array.from({ length: 64 }, (_, i) => ({
        kind: 'group',
        clip: { kind: 'rect', x: px(i * 7) - 6.03, y: py(i * 7) - 5.97, width: 100.07, height: 99.91 },
        children: [red(i * 7, own), greenSlant(i * 7, own)],
      }));
      const nestAgreeTree = (own: boolean) => Array.from({ length: 64 }, (_, i) =>
        nest3(i * 7, [red(i * 7, own), greenSlant(i * 7, own)], 0.03));
      const agreement = {
        hullsOffered,
        shaderVsOwnDraw: diff(readSs(agreeTree(false), true), readSs(agreeTree(true), true)),
        shaderVsUnsnapped: diff(readSs(agreeTree(false), true), readSs(agreeTree(false), false)),
        rectShaderVsOwnDraw: diff(readSs(rectAgreeTree(false), true), readSs(rectAgreeTree(true), true)),
        nestShaderVsOwnDraw: diff(readSs(nestAgreeTree(false), true), readSs(nestAgreeTree(true), true)),
      };

      const collect = (globalThis as { gc?: (opts?: unknown) => void }).gc;
      const gcAvailable = typeof collect === 'function';

      /** A variant that silently draws nothing measures free. */
      function paintsAnything(id: string): boolean {
        frameOf(id, [built[id][0]])();
        const g = glOf(id)!;
        g.finish();
        const buf = new Uint8Array(W * H * 4);
        g.readPixels(0, 0, W, H, g.RGBA, g.UNSIGNED_BYTE, buf);
        for (let p = 3; p < buf.length; p += 4) if (buf[p] !== 0) return true;
        return false;
      }

      const paints: Record<string, boolean> = {};
      for (const v of variants) paints[v.id] = paintsAnything(v.id);
      const notPainting = variants.filter((v) => !paints[v.id]).map((v) => v.id);

      /** Each split rests on what draws alone and what joins a run; counted, not assumed. */
      const draws: Record<string, number> = {};
      for (const v of variants) {
        frameOf(v.id)();
        draws[v.id] = (v.id.startsWith('ss-') ? ssRenderer : renderer).lastFrameStats().drawCalls;
      }

      // Pay each context's one-time costs before the first timed block.
      for (const v of variants) {
        for (let i = 0; i < 3; i++) frameOf(v.id)();
      }
      gl.finish();
      ssGl.finish();

      await report({
        type: 'header', glRenderer, gcAvailable,
        allPaint: notPainting.length === 0,
        notPainting: notPainting.join(', '),
      });

      let index = 0;
      for (let run = 1; run <= runs; run++) {
        if (collect) collect({ type: 'major', execution: 'sync' });
        const main = variants.filter((v) => !v.id.startsWith('ss-'));
        const ss = variants.filter((v) => v.id.startsWith('ss-'));
        const timed = {
          ...await timeInterleaved(gl, main.map((v) => ({ id: v.id, frame: frameOf(v.id) }))),
          ...await timeInterleaved(ssGl, ss.map((v) => ({ id: v.id, frame: frameOf(v.id) }))),
        };
        for (const v of variants) {
          const perFrameMs = +timed[v.id].net.toFixed(4);
          index += 1;
          await report({ type: 'cell', index, run, variant: v.id, perFrameMs });
        }
      }

      renderer.dispose();
      ssRenderer.dispose();
      return { paints, glRenderer, draws, agreement };
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

  const stencilOnly = deltaUs('pat-clipped', 'pat-plain', N);
  const clipTotal = deltaUs('rect-clipped', 'rect-plain', N);
  const breakShare = clipTotal - stencilOnly;
  const cmBreakRaw = deltaUs('rect-cmbreak', 'rect-plain', N);
  const cmUploadOnly = deltaUs('pat-cmbreak', 'pat-plain', N);
  const cmBreak = cmBreakRaw - cmUploadOnly;
  const clipEntryK8 = deltaUs('rect-clipped-k8', 'rect-plain', N / K);
  const cpuCut = deltaUs('rect-rectclip', 'rect-plain', N);
  const stencilEntryK8 = deltaUs('pat-clipped-k8', 'pat-plain', N / K);
  const hullClip = deltaUs('ss-rect-hullclip', 'ss-rect-plain', N);
  const ssStencilClip = deltaUs('ss-rect-stencilclip', 'ss-rect-plain', N);
  const hullClipK8 = deltaUs('ss-rect-hullclip-k8', 'ss-rect-plain', N / K);
  const slantRectHull = deltaUs('ss-slant-rectclip', 'ss-slant-plain', N);
  const slantRectStencil = deltaUs('ss-slant-rectstencil', 'ss-slant-plain', N);
  const slantNest = deltaUs('ss-slant-nest3', 'ss-slant-plain', N);
  const slantNestStencil = deltaUs('ss-slant-nest3stencil', 'ss-slant-plain', N);

  const num = (x: number) => x.toFixed(2);
  const lines = [
    '',
    `Clip cost — 800x600, dpr 1, on ${glRenderer}`,
    `${N} leaves per frame, ${RUNS} runs; median across runs, range in parens.`,
    '',
    '| variant | ms/frame | draws | what it holds |',
    '|---|---:|---:|---|',
  ];
  for (const v of VARIANTS) {
    lines.push(`| ${v.id} | ${ms(v.id).toFixed(2)} (${lo(v.id).toFixed(2)}–${hi(v.id).toFixed(2)}) | ${String(draws[v.id]).padStart(4)} | ${v.note} |`);
  }
  lines.push(
    '',
    '| what | us | how |',
    '|---|---:|---|',
    `| stencil push + pop | ${num(stencilOnly)} | pat-clipped − pat-plain, per clip |`,
    `| clip entry, all in | ${num(clipTotal)} | rect-clipped − rect-plain, per clip |`,
    `| ...of which the batch break | ${num(breakShare)} | the difference between those two |`,
    `| one solid-batch flush | ${num(cmBreak)} | rect-cmbreak − pat-cmbreak, both net of plain |`,
    `| clip entry at ${K} leaves | ${num(clipEntryK8)} | rect-clipped-k8 − rect-plain, per clip |`,
    `| stencil at ${K} leaves | ${num(stencilEntryK8)} | pat-clipped-k8 − pat-plain, per clip |`,
    `| a rect clip cut on the CPU | ${num(cpuCut)} | rect-rectclip − rect-plain, per clip |`,
    `| a slanted clip, decided in the shader | ${num(hullClip)} | ss-rect-hullclip − ss-rect-plain, per clip |`,
    `| ...at ${K} leaves | ${num(hullClipK8)} | ss-rect-hullclip-k8 − ss-rect-plain, per clip |`,
    `| the same clip on the stencil, single-sampled | ${num(ssStencilClip)} | ss-rect-stencilclip − ss-rect-plain, per clip |`,
    `| a rect clip a slanted item crosses, as a hull | ${num(slantRectHull)} | ss-slant-rectclip − ss-slant-plain, per clip |`,
    `| the same on the stencil | ${num(slantRectStencil)} | ss-slant-rectstencil − ss-slant-plain, per clip |`,
    `| three nested rect clips a slanted item crosses | ${num(slantNest)} | ss-slant-nest3 − ss-slant-plain, per nest |`,
    `| the same on the stencil | ${num(slantNestStencil)} | ss-slant-nest3stencil − ss-slant-plain, per nest |`,
    '',
    `single-sampled canvas offers the shader clip: ${String(agreement.hullsOffered)}; `
    + `pixels where a shader-clipped solid and a stencil-clipped fill differ: ${agreement.shaderVsOwnDraw}; `
    + `pixels where the shader clip differs from the stencil of the unsnapped path: ${agreement.shaderVsUnsnapped}; `
    + `pixels where rect clips, cut and shader-tested, differ from the stencil: ${agreement.rectShaderVsOwnDraw}; `
    + `the same under three nested rect clips: ${agreement.nestShaderVsOwnDraw}`,
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
  expect(draws['pat-plain'], 'even-odd rects must not batch, or pat-* stops isolating the stencil').toBeGreaterThanOrEqual(N);
  expect(draws['rect-clipped'], 'a stencil clip must close the run, or rect-clipped prices no break').toBeGreaterThanOrEqual(N);
  expect(draws['rect-cmbreak'], 'each color matrix must close the run, or rect-cmbreak prices no flush').toBeGreaterThanOrEqual(N);
  expect(draws['rect-rectclip'], 'a rect clip should be cut on the CPU, inside one run').toBe(draws['rect-plain']);
  expect(agreement.hullsOffered, 'a single-sampled canvas should offer the shader clip').toBe(true);
  expect(agreement.shaderVsOwnDraw, 'the shader clip and the stencil must keep the same pixels').toBe(0);
  expect(draws['ss-rect-hullclip'], 'a shader-decided clip should not end the run').toBeLessThan(N / 4);
  expect(draws['ss-rect-stencilclip'], 'with the shader clip off, each clip should close its run').toBeGreaterThanOrEqual(N);
  expect(agreement.rectShaderVsOwnDraw, 'a rect clip cut and shader-tested must keep the stencil\'s pixels').toBe(0);
  expect(agreement.nestShaderVsOwnDraw, 'nested rect clips, cut and shader-tested, must keep the stencil\'s pixels').toBe(0);
  expect(draws['ss-slant-nest3'], 'nested rect clips should merge into one four-plane hull and stay in the run').toBeLessThan(N / 4);
  expect(draws['ss-slant-nest3stencil'], 'with the shader clip off, nested clips should take the stencil').toBeGreaterThanOrEqual(N);
  expect(draws['ss-slant-rectclip'], 'a slanted item across a rect clip should stay in the run').toBeLessThan(N / 4);
  expect(draws['ss-slant-rectstencil'], 'with the shader clip off, it should take the stencil').toBeGreaterThanOrEqual(N);
  // A clipped frame that did not cost more than its unclipped twin means the
  // variant is not doing what its name says.
  expect(clipTotal, 'clipping a rect should cost more than not clipping it').toBeGreaterThan(0);
  expect(stencilOnly, 'clipping an even-odd rect should cost more than not clipping it').toBeGreaterThan(0);

  run.machine({ glRenderer, browser: `${browserName} ${browser.version()}` });
  for (const v of VARIANTS) {
    const samples = runs.map((r) => at(r, v.id));
    run.item(v.id, {
      perFrame: metric(ms(v.id), 'ms', `median of ${RUNS} runs; each the median of 40 single-frame samples less the least frame that draws, one frame a task (lib/frameTiming.ts)`, samples),
      drawCalls: metric(draws[v.id], 'count', 'one untimed frame'),
    }, { groups: v.groups });
  }
  const derived = `median across ${RUNS} runs of the per-run delta`;
  run.item('stencil push+pop', { perClip: metric(stencilOnly, 'us', `${derived}, pat-clipped - pat-plain`) });
  run.item('clip entry', { perClip: metric(clipTotal, 'us', `${derived}, rect-clipped - rect-plain`) });
  run.item('clip entry: batch break', { perClip: metric(breakShare, 'us', 'clip entry - stencil push+pop') });
  run.item('solid-batch flush', { perFlush: metric(cmBreak, 'us', `${derived}, rect-cmbreak - pat-cmbreak, net of plain`) });
  run.item(`clip entry at ${K} leaves`, { perClip: metric(clipEntryK8, 'us', `${derived}, rect-clipped-k8 - rect-plain`) });
  run.item(`stencil at ${K} leaves`, { perClip: metric(stencilEntryK8, 'us', `${derived}, pat-clipped-k8 - pat-plain`) });
  run.item('rect clip cut on the CPU', { perClip: metric(cpuCut, 'us', `${derived}, rect-rectclip - rect-plain`) });
  run.item('slanted clip decided in the shader', { perClip: metric(hullClip, 'us', `${derived}, ss-rect-hullclip - ss-rect-plain`) });
  run.item(`slanted clip decided in the shader at ${K} leaves`, { perClip: metric(hullClipK8, 'us', `${derived}, ss-rect-hullclip-k8 - ss-rect-plain`) });
  run.item('slanted clip on the stencil, single-sampled', { perClip: metric(ssStencilClip, 'us', `${derived}, ss-rect-stencilclip - ss-rect-plain`) });
  run.item('shader clip agreement', {
    shaderVsOwnDraw: metric(agreement.shaderVsOwnDraw, 'count', 'pixels differing over 64 clips: a solid under the shader clip, an even-odd fill under the stencil'),
    shaderVsUnsnapped: metric(agreement.shaderVsUnsnapped, 'count', 'pixels differing over the same clips: the shader clip, the stencil of the unsnapped path'),
    nestShaderVsOwnDraw: metric(agreement.nestShaderVsOwnDraw, 'count', 'the same over 64 nests of three rect clips off the hull grid'),
    rectShaderVsOwnDraw: metric(agreement.rectShaderVsOwnDraw, 'count', 'pixels differing over 64 rect clips off the hull grid: an axis-aligned solid cut on the CPU and a turned one tested in the shader, against both drawn for themselves through the stencil'),
  });
  run.item('rect clip a slanted item crosses, as a hull', { perClip: metric(slantRectHull, 'us', `${derived}, ss-slant-rectclip - ss-slant-plain`) });
  run.item('rect clip a slanted item crosses, on the stencil', { perClip: metric(slantRectStencil, 'us', `${derived}, ss-slant-rectstencil - ss-slant-plain`) });
  run.item('three nested rect clips a slanted item crosses', { perNest: metric(slantNest, 'us', `${derived}, ss-slant-nest3 - ss-slant-plain`) });
  run.item('three nested rect clips a slanted item crosses, on the stencil', { perNest: metric(slantNestStencil, 'us', `${derived}, ss-slant-nest3stencil - ss-slant-plain`) });
  run.write();
});
