/**
 * Frame budget: how many commands of each kind fit inside one frame.
 *
 * `draw-loop.spec.ts` answers "how long do N commands take" — the right
 * question while optimizing a hot path, the wrong one while deciding what a
 * scene may contain. This inverts it: fix the budget (16.7 ms at 60 Hz, 8.3 at
 * 120) and binary-search the largest command count that renders inside it. The
 * answer is a capacity in a unit a scene author can act on, so "can this
 * document hit 60?" becomes a lookup.
 *
 * Read `draw-loop.spec.ts`'s header first — the timing method here is the same
 * and the reasoning for it is not repeated. In short: never time one frame, and
 * check the unmasked GL renderer the run printed before believing a number.
 *
 * **A single digit from this spec is not a result.** The two runs behind the
 * 2026-08-15 stroke figure moved an *untouched* variant from 101 to 152 ms, so
 * this hardware's noise is wider than most of the wins anyone would measure
 * against it. Every row is searched `RUNS` times and reported as a band; treat
 * the width of that band as the resolution of the instrument.
 *
 * Capacity is searched, not derived from a per-command cost, because a command
 * has no cost on its own — it has one in the company it keeps. Each row here
 * renders one kind, so its commands batch and hold state; interleave them the
 * way a document does and the total runs well over the sum of these rows.
 * `mixed-doc` is the row that measures that, and it is the one to quote when
 * the question is whether a real scene will hold its frame rate.
 *
 * This reports; it does not gate. See `tests/bench/README.md`.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const BUDGETS = [
  { label: '60 Hz', ms: 16.7 },
  { label: '120 Hz', ms: 8.3 },
];

/** Full independent searches per row. The spread across them is the report. */
const RUNS = 3;

/** Upper bound on the search. A row that reaches it reports `>=` rather than a
 *  number: past this, building the command array costs more than rendering it,
 *  and the figure stops describing anything a document would do. */
const CAP = 500_000;

/**
 * One row each. `unit` names what is being counted — a capacity is meaningless
 * without it, and several of these are not one draw call.
 *
 * Order does not matter: each row gets its own renderer and GL context, so
 * unlike `draw-loop.spec.ts` there is no measurement to protect from its
 * predecessor's garbage.
 */
const ALL_KINDS = [
  { id: 'solid-rect',    unit: 'solid rect' },
  { id: 'stroked-path',  unit: 'stroked rect (2px)' },
  { id: 'scene-tree',    unit: 'leaf in a fanout-4 tree' },
  { id: 'text-label',    unit: 'text label (12 glyphs, 16px)' },
  { id: 'image',         unit: 'image quad (48px, 6 bitmaps)' },
  { id: 'shader-panel',  unit: 'shader panel (64px)' },
  { id: 'clip-depth-1',  unit: 'clipped group (1 rect)' },
  { id: 'clip-depth-4',  unit: '4-deep clip stack (1 rect)' },
  { id: 'gradient-rect', unit: 'linear-gradient rect' },
  { id: 'mixed-doc',     unit: 'document element (weighted mix)' },
];

/** `PERF_KINDS=mixed-doc,solid-rect` narrows the sweep. A full one runs for
 *  many minutes, and re-measuring one row after a renderer change should not
 *  have to pay for the other nine. */
const only = process.env.PERF_KINDS?.split(',').map((s) => s.trim()).filter(Boolean);
const KINDS = only?.length ? ALL_KINDS.filter((k) => only.includes(k.id)) : ALL_KINDS;
if (only?.length) {
  const unknown = only.filter((id) => !ALL_KINDS.some((k) => k.id === id));
  if (unknown.length) throw new Error(`PERF_KINDS: no such kind: ${unknown.join(', ')}`);
}

interface RowResult {
  kind: string;
  run: number;
  caps: Array<{ label: string; n: number; capped: boolean }>;
  elapsedMs: number;
}

const fmt = (n: number) => n.toLocaleString('en-US');
const cell = (c: { n: number; capped: boolean }) => (c.capped ? `>=${fmt(c.n)}` : fmt(c.n));

function band(values: Array<{ n: number; capped: boolean }>): string {
  const ns = values.map((v) => v.n).sort((a, b) => a - b);
  const capped = values.some((v) => v.capped);
  const med = ns[Math.floor(ns.length / 2)];
  const lo = ns[0];
  const hi = ns[ns.length - 1];
  const range = lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`;
  return `${capped ? '>=' : ''}${range} (med ${fmt(med)})`;
}

test.setTimeout(1_800_000);

test('frame budget: commands per kind that fit one frame', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  const rows: RowResult[] = [];

  // Streamed out of the page as each row lands. A full sweep runs for minutes;
  // a table printed at exit is indistinguishable from a hang while it works.
  await page.exposeFunction('__budgetReport', (msg: unknown) => {
    const m = msg as { type: string } & Record<string, unknown>;
    if (m.type === 'probe') {
      console.log(`  probe ${String(m.kind).padEnd(14)} paints=${String(m.ok).padEnd(5)}`
        + ` ${(Number(m.ms) / 1000).toFixed(1)}s`);
      return;
    }
    if (m.type === 'header') {
      console.log('');
      console.log(`Frame budget — 800x600, dpr 1, on ${String(m.glRenderer)}`);
      console.log(`collected between measurements: ${String(m.gcAvailable)}`);
      console.log(`every kind paints something: ${String(m.allPaint)}`);
      if (m.notPainting) console.log(`  NOT PAINTING: ${String(m.notPainting)}`);
      console.log(`searching ${KINDS.length} kinds x ${BUDGETS.length} budgets x ${RUNS} runs`);
      console.log('');
      return;
    }
    const row = m as unknown as RowResult;
    rows.push(row);
    const caps = row.caps.map((c) => `${c.label} ${cell(c).padStart(8)}`).join('   ');
    console.log(
      `  run ${row.run}/${RUNS}  ${row.kind.padEnd(14)}  ${caps}`
      + `   ${(row.elapsedMs / 1000).toFixed(1)}s`,
    );
  });

  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { paints, glRenderer } = await page.evaluate(
    async ({ root, budgets, runs, cap, kinds }) => {
      const report = (globalThis as unknown as {
        __budgetReport: (m: unknown) => Promise<void>;
      }).__budgetReport;

      // One import, so the font and program registries the renderer reads are
      // the module instances this code writes to. Importing them from separate
      // specifiers can land on a second copy of the registry, and the symptom
      // is a kind that silently paints nothing and therefore measures free.
      const rendererMod = await import(
        /* @vite-ignore */ `/weasel/@fs${root}/packages/core/src/renderer/index.ts`
      );
      const { WeaselRenderer, registerFont, registerProgram } = rendererMod;

      const W = 800;
      const H = 600;
      const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

      let gl!: WebGL2RenderingContext;
      let renderer!: { render: (c: unknown[], v: Float32Array) => void;
        registerProgram: (h: unknown) => void; dispose: () => void };
      let glRenderer = '';

      /**
       * A fresh context and renderer per row.
       *
       * Rows are not independent on a shared renderer: measured tenth, after
       * nine rows had put a few hundred thousand paths through the caches, the
       * mixed profile came back a quarter of what it measures on a clean one.
       * A capacity table whose last row depends on what the first nine did is
       * not a table anyone can read, and finding which retained thing costs the
       * difference is a renderer investigation, not this spec's job. Starting
       * clean makes each row answer only for itself.
       */
      function freshRenderer(): void {
        renderer?.dispose();
        // Not attached to the document: a composited canvas puts the
        // compositor's schedule into every measurement.
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
        if (!ctx) throw new Error('no WebGL2 context');
        gl = ctx;
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        glRenderer = String(dbg
          ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER));
        renderer = new WeaselRenderer({ gl, canvas, width: W, height: H, dpr: 1 });
        renderer.registerProgram(panelProgram);
      }

      await registerFont(
        'sans-serif', { weight: 400, style: 'normal' },
        '/weasel/inter/inter.json', '/weasel/inter/inter.png',
      );

      const PANEL_FRAG = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform float u_phase;
out vec4 outColor;
void main() {
  float v = 0.5 + 0.5 * sin((v_uv.x + v_uv.y) * 12.0 + u_phase);
  float a = 0.85;
  outColor = vec4(vec3(v, 0.4, 1.0 - v) * a, a);
}`;
      const panelProgram = registerProgram('perf-frame-budget-panel', '', PANEL_FRAG);
      freshRenderer();

      /** Six distinct bitmaps, not one: a single texture would never rebind,
       *  and a document with images has more than one. */
      const bitmaps: ImageBitmap[] = [];
      for (let b = 0; b < 6; b++) {
        const px = new ImageData(64, 64);
        for (let p = 0; p < 64 * 64; p++) {
          px.data[p * 4] = (p * 7 + b * 40) % 256;
          px.data[p * 4 + 1] = (p * 3 + b * 17) % 256;
          px.data[p * 4 + 2] = (p * 11 + b * 90) % 256;
          px.data[p * 4 + 3] = 255;
        }
        bitmaps.push(await createImageBitmap(px));
      }

      // ─── command builders ──────────────────────────────────────────────

      /** Element 0 always lands at (20, 20) so the paint probe knows where to
       *  look, whatever the kind. */
      const px = (i: number) => 20 + ((i * 37) % (W - 160));
      const py = (i: number) => 20 + ((i * 53) % (H - 160));

      const solidFill = (i: number) => ({
        fill: 'solid' as const, color: i % 2 ? '#3366cc' : '#cc6633',
      });

      const rect = (i: number, size = 36) => ({
        kind: 'path',
        path: { kind: 'rect', x: px(i), y: py(i), width: size, height: size },
        fill: solidFill(i),
      });

      const gradientRect = (i: number) => {
        const x = px(i);
        const y = py(i);
        return {
          kind: 'path',
          path: { kind: 'rect', x, y, width: 36, height: 36 },
          // Anchored to the rect rather than fixed in screen space: a gradient
          // whose ramp falls outside the shape it fills is a solid fill wearing
          // a gradient's cost profile.
          fill: {
            fill: 'linear-gradient' as const,
            from: { x, y }, to: { x: x + 36, y: y + 36 },
            stops: [{ offset: 0, color: '#204080' }, { offset: 1, color: '#f0b040' }],
          },
        };
      };

      const strokedPath = (i: number) => ({
        kind: 'path',
        path: { kind: 'rect', x: px(i), y: py(i), width: 36, height: 36 },
        fill: solidFill(i),
        stroke: { width: 2, paint: { color: '#222222' } },
      });

      const LABELS = [
        'Layer options', 'Fill and stroke', 'Untitled group',
        'Export preset', 'Constraints', 'Bounding box',
        'Auto layout on', 'Blend passthru',
      ];
      const textLabel = (i: number) => ({
        kind: 'text',
        x: px(i), y: py(i),
        runs: [{
          text: LABELS[i % LABELS.length],
          fontFamily: 'sans-serif', fontSize: 16, fontWeight: 400, fontStyle: 'normal',
          fill: { fill: 'solid', color: i % 2 ? '#222222' : '#0b5' },
          letterSpacing: 0, underline: false, strikethrough: false, baselineShift: 0,
        }],
        align: 'left',
        style: { fontFamily: 'sans-serif', fontSize: 16, fill: { color: '#222222' } },
      });

      const imageQuad = (i: number) => ({
        kind: 'image',
        image: bitmaps[i % bitmaps.length],
        x: px(i), y: py(i), w: 48, h: 48,
      });

      const shaderPanel = (i: number) => ({
        kind: 'shader',
        program: panelProgram,
        // Varies per command on purpose: a constant uniform is cached and
        // skipped, which no animated shader panel gets to do.
        uniforms: { u_phase: (i % 32) * 0.2 },
        bounds: { x: px(i), y: py(i), w: 64, h: 64 },
      });

      const clipStack = (i: number, depth: number) => {
        const x = px(i);
        const y = py(i);
        let node: Record<string, unknown> = rect(i, 24);
        for (let d = depth - 1; d >= 0; d--) {
          const inset = d * 6;
          node = {
            kind: 'group',
            clip: {
              kind: 'rect',
              x: x - inset, y: y - inset,
              width: 100 + inset * 2, height: 100 + inset * 2,
            },
            children: [node],
          };
        }
        return node;
      };

      /** What `buildSceneTree` emits: a wrapper group per node, nested. A
       *  translate of a quarter pixel per level keeps the matrix work real
       *  without walking the leaves off the canvas at depth 8. */
      const NUDGE = new Float32Array([1, 0, 0, 0, 1, 0, 0.25, 0.25, 1]);
      function assembleTree(leaves: unknown[], fanout: number): unknown[] {
        let level: unknown[] = leaves.map((c) => ({ kind: 'group', children: [c] }));
        while (level.length > fanout) {
          const next: unknown[] = [];
          for (let i = 0; i < level.length; i += fanout) {
            next.push({ kind: 'group', transform: NUDGE, children: level.slice(i, i + fanout) });
          }
          level = next;
        }
        return level;
      }

      /**
       * Weighted like a drawing rather than a stress test: mostly vector
       * shapes, a fifth of it text, a handful of images and one or two shader
       * panels. Assembled into a real tree with clips on some branches, so the
       * figure includes the traversal and state a flat array leaves out.
       * Elements spread across the full canvas, so overdraw rises with the
       * count the way it does in a dense document.
       */
      const MIX = [
        ...Array(55).fill('rect'),
        ...Array(18).fill('stroke'),
        ...Array(15).fill('text'),
        ...Array(6).fill('grad'),
        ...Array(4).fill('image'),
        ...Array(2).fill('shader'),
      ];
      const mixedLeaf = (i: number): unknown => {
        switch (MIX[i % MIX.length]) {
          case 'stroke': return strokedPath(i);
          case 'text':   return textLabel(i);
          case 'grad':   return gradientRect(i);
          case 'image':  return imageQuad(i);
          case 'shader': return shaderPanel(i);
          default:       return rect(i);
        }
      };

      /**
       * Sixteen chunks, four of them clipped: a fixed number of clipped frames
       * over a quarter of the document, whatever the size.
       *
       * Hanging the clips off tree branches instead made this row step wherever
       * `n` crossed a power of the fanout — the branch count drops from 6 to 2,
       * so the clipped share jumps from a sixth to a half. A clip forces every
       * draw beneath it out of the solid batch, so that share sets the row's
       * cost, and the row reported the shape of its own scaffolding.
       */
      function assembleMixed(leaves: unknown[]): unknown[] {
        const chunkSize = Math.max(1, Math.ceil(leaves.length / 16));
        const out: unknown[] = [];
        for (let i = 0, c = 0; i < leaves.length; i += chunkSize, c++) {
          const branch = assembleTree(leaves.slice(i, i + chunkSize), 6);
          if (c === 1 || c === 5 || c === 9 || c === 13) {
            out.push({
              kind: 'group',
              clip: { kind: 'rect', x: 4 + c, y: 4 + c, width: W - 16 - c, height: H - 16 - c },
              children: branch,
            });
          } else out.push(...branch);
        }
        return out;
      }

      /** `leaf` mints one unit; `assemble` optionally arranges the units into a
       *  tree. Splitting them is what lets every kind share the leaf pool. */
      const BUILDERS: Record<string, {
        leaf: (i: number) => unknown;
        assemble?: (leaves: unknown[]) => unknown[];
      }> = {
        'solid-rect':    { leaf: (i) => rect(i) },
        'stroked-path':  { leaf: strokedPath },
        'gradient-rect': { leaf: gradientRect },
        'text-label':    { leaf: textLabel },
        'image':         { leaf: imageQuad },
        'shader-panel':  { leaf: shaderPanel },
        'clip-depth-1':  { leaf: (i) => clipStack(i, 1) },
        'clip-depth-4':  { leaf: (i) => clipStack(i, 4) },
        'scene-tree':    { leaf: (i) => rect(i), assemble: (ls) => assembleTree(ls, 4) },
        'mixed-doc':     { leaf: mixedLeaf, assemble: assembleMixed },
      };

      /**
       * Leaves are built once at the largest count the search reaches and
       * sliced; only the group wrappers are rebuilt per probe.
       *
       * The pool is what makes the row measure a steady-state frame. Minting
       * fresh leaves per probe hands the renderer paths it has never seen, so
       * every probe re-tessellates, re-uploads and re-lays-out text — document
       * load, not frame cost. The mixed profile measured 3x its true cost that
       * way and degraded run over run, because a search step is a fresh
       * document each time and a real one is the same nodes redrawn. Kit caches
       * (`getMesh`, `layoutCache`) key on object identity precisely because
       * consumers hold their nodes stable across frames.
       */
      let poolKind = '';
      let pool: unknown[] = [];
      function build(kind: string, n: number): unknown[] {
        const spec = BUILDERS[kind];
        if (poolKind !== kind) { poolKind = kind; pool = []; }
        if (pool.length < n) {
          const grown: unknown[] = [];
          for (let i = 0; i < Math.max(n, 64); i++) grown.push(spec.leaf(i));
          pool = grown;
        }
        const leaves = pool.length === n ? pool : pool.slice(0, n);
        return spec.assemble ? spec.assemble(leaves) : leaves;
      }

      /** Dropped when the sweep moves to the next kind — ten pools of 100k
       *  commands alive at once is a memory profile no measurement wants. */
      function dropPool(): void { poolKind = ''; pool = []; }

      // ─── timing ────────────────────────────────────────────────────────

      const collect = (globalThis as { gc?: (opts?: unknown) => void }).gc;
      const gcAvailable = typeof collect === 'function';

      /** Total across `frames`, divided. Never time one frame. */
      function timeBlock(cmds: unknown[], frames: number): number {
        if (collect) {
          collect({ type: 'major', execution: 'sync' });
          collect({ type: 'major', execution: 'sync' });
        }
        // One untimed frame between the collect and the clock. Collecting
        // finalizes every Mesh the previous row dropped, and each one queues a
        // VAO and two buffers into `GLMeshCache.pendingDeletes`, which
        // `render` drains at the top of the next frame. Without this the block
        // is charged for deleting its predecessor's GL resources: the mixed
        // profile came back 3x slow, and because the backlog is a deterministic
        // size it reproduced exactly across processes and read as a real cliff.
        renderer.render(cmds, identity);
        gl.finish();
        const t0 = performance.now();
        for (let f = 0; f < frames; f++) renderer.render(cmds, identity);
        gl.finish();
        return (performance.now() - t0) / frames;
      }

      /**
       * Three blocks: one discarded, one to size the third. The discard is not
       * optional — the first block at a new count measured 30x the second of
       * identical work in `draw-loop.spec.ts`, and near a budget boundary that
       * is the difference between fits and doesn't.
       *
       * The frame count is derived rather than fixed because this search spans
       * three orders of magnitude in per-frame cost: 25 frames is too few to
       * clear the ~100us clock at the cheap end and half a minute at the dear
       * one.
       */
      const TARGET_BLOCK_MS = 120;
      function measure(cmds: unknown[]): number {
        for (let i = 0; i < 3; i++) renderer.render(cmds, identity);
        gl.finish();
        timeBlock(cmds, 4);
        const rough = timeBlock(cmds, 6);
        const frames = Math.min(80, Math.max(6, Math.round(TARGET_BLOCK_MS / Math.max(rough, 0.05))));
        return timeBlock(cmds, frames);
      }

      /**
       * A bisection step cannot revisit a verdict: one wrong `fits` high in the
       * range truncates everything below it, and the run reports a number it
       * never actually measured. Away from the boundary a single block decides
       * it safely, but inside ±10% of the budget the verdict is a coin flip on
       * a noisy row — the mixed profile returned both 2,464 and 1,232 for the
       * same budget before this. Those probes, and only those, go best-of-three.
       */
      function fits(kind: string, n: number, budgetMs: number): boolean {
        const cmds = build(kind, n);
        const first = measure(cmds);
        if (Math.abs(first - budgetMs) > budgetMs * 0.1) return first <= budgetMs;
        const three = [first, measure(cmds), measure(cmds)].sort((a, b) => a - b);
        return three[1] <= budgetMs;
      }

      /**
       * Largest count that renders inside `budgetMs`. Bracket by ramping until
       * something misses, then bisect to 5% — finer than that is below the
       * noise floor and only costs probes.
       *
       * Every call ramps from scratch. Seeding the search from the previous
       * run's answer was most of the sweep's speed, but it made the runs a
       * converging sequence rather than independent samples: the mixed profile
       * walked 2,272 -> 3,782 -> 3,934, each run inheriting the last one's
       * floor. Reporting the spread of *that* as a band states a confidence the
       * numbers do not have.
       */
      function capacity(kind: string, budgetMs: number):
      { n: number; capped: boolean } {
        let lo = 0;
        let hi = 0;
        const growth = 4;
        let n = 16;
        while (hi === 0) {
          if (n >= cap) {
            if (fits(kind, cap, budgetMs)) return { n: cap, capped: true };
            hi = cap;
            break;
          }
          if (fits(kind, n, budgetMs)) { lo = n; n = Math.round(n * growth); }
          else hi = n;
        }
        while (hi - lo > Math.max(1, Math.round(lo * 0.05))) {
          const mid = Math.round((lo + hi) / 2);
          if (mid <= lo || mid >= hi) break;
          if (fits(kind, mid, budgetMs)) lo = mid; else hi = mid;
        }
        return { n: lo, capped: false };
      }

      // ─── does each kind actually paint? ────────────────────────────────

      /**
       * A kind that silently draws nothing measures free and would report an
       * absurd capacity — a shader that failed to compile, an atlas that never
       * loaded, an image that never uploaded. One command of each kind, then
       * scan the framebuffer for any covered pixel.
       */
      function paintsAnything(kind: string): boolean {
        renderer.render(build(kind, 1), identity);
        gl.finish();
        const buf = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        for (let p = 3; p < buf.length; p += 4) if (buf[p] !== 0) return true;
        return false;
      }

      const paints: Record<string, boolean> = {};
      for (const { id } of kinds) {
        const t0 = performance.now();
        freshRenderer();
        paints[id] = paintsAnything(id);
        dropPool();
        await report({ type: 'probe', kind: id, ok: paints[id], ms: performance.now() - t0 });
      }
      const notPainting = kinds.filter(({ id }) => !paints[id]).map(({ id }) => id);

      await report({
        type: 'header',
        glRenderer,
        gcAvailable,
        allPaint: notPainting.length === 0,
        notPainting: notPainting.length ? notPainting.join(', ') : '',
      });

      // ─── sweep ─────────────────────────────────────────────────────────

      // Run-major, not kind-major: three searches of one row back to back sit
      // inside one thermal state and agree with each other more than they
      // agree with the truth. Spreading them across the sweep samples the
      // machine's drift instead of hiding it.
      for (let run = 1; run <= runs; run++) {
        for (const { id } of kinds) {
          dropPool();
          freshRenderer();
          // Pay this context's one-time costs before the first probe. They are
          // per-feature — program link, atlas upload, image texture, the solid
          // batch's buffer growth — so on a cold context the ramp meets them at
          // whichever count first uses that feature, and charges the count for
          // them. 256 covers a full cycle of the mixed weighting, so every
          // command kind has been through at least once.
          const warm = build(id, 256);
          for (let i = 0; i < 4; i++) renderer.render(warm, identity);
          gl.finish();

          const t0 = performance.now();
          const caps = budgets.map(({ label, ms }) => ({ label, ...capacity(id, ms) }));
          await report({
            type: 'row', kind: id, run, caps,
            elapsedMs: performance.now() - t0,
          });
        }
      }
      dropPool();

      return { paints, glRenderer };
    },
    { root: repoRoot, budgets: BUDGETS, runs: RUNS, cap: CAP, kinds: KINDS },
  );

  const lines = [
    '',
    `Frame budget — 800x600, dpr 1, on ${glRenderer}`,
    `${RUNS} independent searches per row; range across them, median in parens.`,
    '',
    `| unit | ${BUDGETS.map((b) => `fit in ${b.label} (${b.ms} ms)`).join(' | ')} |`,
    `|---|${BUDGETS.map(() => '---:').join('|')}|`,
  ];
  for (const { id, unit } of KINDS) {
    const cells = BUDGETS.map((b) => band(
      rows.filter((r) => r.kind === id).map((r) => r.caps.find((c) => c.label === b.label)!),
    ));
    lines.push(`| ${unit} | ${cells.join(' | ')} |`);
  }
  console.log(lines.join('\n'));

  expect(errors).toEqual([]);
  for (const { id } of KINDS) {
    // Free-measuring nothing is the failure mode that makes a capacity table
    // dangerous rather than merely wrong.
    expect(paints[id], `${id}: rendered nothing, so its capacity is meaningless`).toBe(true);
    const got = rows.filter((r) => r.kind === id);
    expect(got.length, `${id}: missing runs`).toBe(RUNS);
    for (const r of got) {
      for (const c of r.caps) {
        expect(c.n, `${id}: nothing fits in ${c.label}`).toBeGreaterThan(0);
      }
    }
    const median = (label: string) => {
      const ns = got.map((r) => r.caps.find((c) => c.label === label)!.n).sort((a, b) => a - b);
      return ns[Math.floor(ns.length / 2)];
    };
    // Compared on medians with slack, because two independent searches of the
    // same row disagree by more than the gap between the budgets on a quiet
    // machine — but a half-budget row fitting *more* is a broken search.
    expect(median('120 Hz'), `${id}: half the budget fit more commands`)
      .toBeLessThanOrEqual(Math.round(median('60 Hz') * 1.15));
  }
});
