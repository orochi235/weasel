/**
 * What is left in a flush once the stalled write is gone.
 *
 * `clip-cost.spec.ts` prices one `flushSolids` at ~4.4 us now that `SolidBatch`
 * cycles its buffers, against ~1.8 us for a warm mesh draw carrying far more
 * geometry. That gap is not the draw and is no longer the write, so it is the
 * calls around them — and a flush issues about ten GL calls to draw six
 * indices.
 *
 * This strips them one at a time. Every variant renders `N` one-rect flushes
 * per frame through a vertex-color program and a 64-slot ring, exactly the
 * shape `SolidBatch` uses; each removes one call from the variant above it, so
 * the delta between two adjacent rows is that call's cost. `bind+draw` is the
 * floor: what a flush would cost if nothing else were in it.
 *
 * The ladder is raw GL rather than the renderer, for the same reason
 * `image-quad.spec.ts`'s `raw` half is: a variant has to be able to *omit* a
 * call, which a spec driving `flushSolids` cannot do. Read the deltas, not the
 * absolute rows — the renderer's own figure comes from `clip-cost.spec.ts`.
 *
 * Removals are cumulative, so a row is "everything above it, minus one more".
 * That ordering is what makes a delta attributable; reading a row on its own
 * says nothing.
 *
 * This reports; it does not gate. See `tests/bench/README.md`.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Flushes per frame. Each carries one rect — the shape a broken run has, and
 *  the one that makes the per-flush overhead the whole cost. */
const N = 512;

const RUNS = 3;

/**
 * Each row drops one call from the row above. `drops` names what this row no
 * longer does, so the delta from the previous row prices exactly that.
 */
const VARIANTS = [
  { id: 'flush',        drops: '— the full flushSolids sequence' },
  { id: '-unbind',      drops: 'bindVertexArray(null) after every draw' },
  { id: '-cliptest',    drops: 'disable(STENCIL_TEST) (applyClipTest at depth 0)' },
  { id: '-uniforms',    drops: 'uniform4f(u_color) + uniform1f(u_alpha)' },
  { id: '-useprogram',  drops: 'useProgram, hoisted out of the loop' },
  { id: '-idxupload',   drops: 'the index bufferSubData' },
  { id: 'bind+draw',    drops: 'the vertex bufferSubData — bind and draw only' },
] as const;

type VariantId = (typeof VARIANTS)[number]['id'];

interface Cell { run: number; variant: VariantId; perFrameMs: number }

test.setTimeout(1_800_000);

test('flush anatomy: what a flush spends outside the draw', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  const cells: Cell[] = [];
  const total = VARIANTS.length * RUNS;

  await page.exposeFunction('__flushReport', (msg: unknown) => {
    const m = msg as { type: string } & Record<string, unknown>;
    if (m.type === 'header') {
      console.log('');
      console.log(`Flush anatomy — 800x600, dpr 1, on ${String(m.glRenderer)}`);
      console.log(`collected between measurements: ${String(m.gcAvailable)}`);
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

  const { paints, glRenderer } = await page.evaluate(
    async ({ n, runs, variants }) => {
      const report = (globalThis as unknown as {
        __flushReport: (m: unknown) => Promise<void>;
      }).__flushReport;

      const W = 800;
      const H = 600;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
      if (!gl) throw new Error('no WebGL2 context');
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const glRenderer = String(dbg
        ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER));

      const collect = (globalThis as { gc?: (opts?: unknown) => void }).gc;
      const gcAvailable = typeof collect === 'function';

      // ─── a stand-in for pathFillVColor ──────────────────────────────────

      // Same attribute layout the batch stages into: vec2 position + vec4
      // color, 6 floats a vertex, positions already in screen space. The
      // uniforms are the ones `flushSolids` writes.
      const VERT = `#version 300 es
in vec2 a_position;
in vec4 a_vertexColor;
uniform vec2 u_toClip;
out vec4 v_color;
void main() {
  v_color = a_vertexColor;
  gl_Position = vec4(a_position * u_toClip - 1.0, 0.0, 1.0);
}`;
      const FRAG = `#version 300 es
precision mediump float;
in vec4 v_color;
uniform vec4 u_color;
uniform float u_alpha;
out vec4 outColor;
void main() { outColor = v_color * u_color * u_alpha; }`;

      function compile(vs: string, fs: string): WebGLProgram {
        const mk = (type: number, src: string) => {
          const s = gl.createShader(type)!;
          gl.shaderSource(s, src);
          gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            throw new Error(`shader: ${gl.getShaderInfoLog(s)}`);
          }
          return s;
        };
        const p = gl.createProgram()!;
        gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
        gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
          throw new Error(`link: ${gl.getProgramInfoLog(p)}`);
        }
        return p;
      }

      const prog = compile(VERT, FRAG);
      const aPos = gl.getAttribLocation(prog, 'a_position');
      const aColor = gl.getAttribLocation(prog, 'a_vertexColor');
      const uToClip = gl.getUniformLocation(prog, 'u_toClip');
      const uColor = gl.getUniformLocation(prog, 'u_color');
      const uAlpha = gl.getUniformLocation(prog, 'u_alpha');

      // ─── the ring SolidBatch cycles ─────────────────────────────────────

      const RING = 64;
      const FLOATS_PER_VERTEX = 6;
      const STRIDE = FLOATS_PER_VERTEX * 4;
      /** Slot capacity, as in `SOLID_RING_SLOT_VERTICES`. Sizing a slot to the
       *  one rect it holds would price a smaller buffer than the batch uses. */
      const SLOT_VERTICES = 1024;
      const SLOT_INDICES = 3072;

      const ringVaos: WebGLVertexArrayObject[] = [];
      const ringVbos: WebGLBuffer[] = [];
      const ringIbos: WebGLBuffer[] = [];
      for (let r = 0; r < RING; r++) {
        const vao = gl.createVertexArray()!;
        const vbo = gl.createBuffer()!;
        const ibo = gl.createBuffer()!;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, SLOT_VERTICES * STRIDE, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, STRIDE, 0);
        gl.enableVertexAttribArray(aColor);
        gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, STRIDE, 8);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, SLOT_INDICES * 4, gl.DYNAMIC_DRAW);
        gl.bindVertexArray(null);
        ringVaos.push(vao);
        ringVbos.push(vbo);
        ringIbos.push(ibo);
      }

      const px = (i: number) => 20 + ((i * 37) % (W - 160));
      const py = (i: number) => 20 + ((i * 53) % (H - 160));
      const SIZE = 36;

      /** One rect's four corners with color, as `pushRect` stages them. */
      const verts = new Float32Array(4 * FLOATS_PER_VERTEX);
      const idx = new Uint32Array([0, 1, 2, 0, 2, 3]);
      function stage(i: number): void {
        const x0 = px(i);
        const y0 = py(i);
        const x1 = x0 + SIZE;
        const y1 = y0 + SIZE;
        const r = i % 2 ? 0.2 : 0.8;
        const g = 0.4;
        const b = i % 2 ? 0.8 : 0.2;
        const xs = [x0, x1, x1, x0];
        const ys = [y0, y0, y1, y1];
        for (let k = 0; k < 4; k++) {
          const o = k * FLOATS_PER_VERTEX;
          verts[o] = xs[k]; verts[o + 1] = ys[k];
          verts[o + 2] = r; verts[o + 3] = g; verts[o + 4] = b; verts[o + 5] = 1;
        }
      }

      /** `bind+draw` never uploads, so its slots have to hold something. Fill
       *  every one before any variant runs, or that row measures an empty
       *  frame and reports as the fastest. */
      for (let r = 0; r < RING; r++) {
        stage(r);
        gl.bindVertexArray(ringVaos[r]);
        gl.bindBuffer(gl.ARRAY_BUFFER, ringVbos[r]);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
        gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, idx);
      }
      gl.bindVertexArray(null);

      /**
       * One frame of `n` flushes. `level` is how far down the ladder we are:
       * every call guarded by a level runs only while the variant is at or
       * above it, so the variants are strictly cumulative removals.
       */
      const LEVEL: Record<string, number> = {
        'flush': 0, '-unbind': 1, '-cliptest': 2, '-uniforms': 3,
        '-useprogram': 4, '-idxupload': 5, 'bind+draw': 6,
      };

      function frame(variant: string): void {
        const lvl = LEVEL[variant];
        gl.useProgram(prog);
        gl.uniform2f(uToClip, 2 / W, 2 / H);
        // Hoisted for the rows that no longer set them per flush; harmless for
        // the rows that do, which overwrite with the same values.
        gl.uniform4f(uColor, 1, 1, 1, 1);
        gl.uniform1f(uAlpha, 1);

        for (let i = 0; i < n; i++) {
          const slot = i % RING;
          // Outside every guard: `pushRect` stages into the CPU array as
          // commands arrive, so this is not part of what a flush costs. Skipping
          // it on the lower rows would charge the vertex upload for it.
          stage(i);
          if (lvl < 4) gl.useProgram(prog);
          gl.bindVertexArray(ringVaos[slot]);
          gl.bindBuffer(gl.ARRAY_BUFFER, ringVbos[slot]);
          if (lvl < 6) gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
          if (lvl < 5) gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, idx);
          if (lvl < 3) {
            gl.uniform4f(uColor, 1, 1, 1, 1);
            gl.uniform1f(uAlpha, 1);
          }
          if (lvl < 2) gl.disable(gl.STENCIL_TEST);
          gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
          if (lvl < 1) gl.bindVertexArray(null);
        }
        gl.bindVertexArray(null);
      }

      // ─── paint probe ────────────────────────────────────────────────────

      /** A variant that draws nothing is the failure mode a timing table hides:
       *  it reports as the fastest row and reads as a win. */
      function paintsAnything(variant: string): boolean {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        frame(variant);
        gl.finish();
        const buf = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        for (let p = 3; p < buf.length; p += 4) if (buf[p] !== 0) return true;
        return false;
      }

      const paints: Record<string, boolean> = {};
      for (const v of variants) paints[v.id] = paintsAnything(v.id);
      const notPainting = variants.filter((v) => !paints[v.id]).map((v) => v.id);

      await report({
        type: 'header',
        glRenderer,
        gcAvailable,
        allPaint: notPainting.length === 0,
        notPainting: notPainting.length ? notPainting.join(', ') : '',
      });

      // ─── timing ─────────────────────────────────────────────────────────

      function timeBlock(run: () => void, frames: number): number {
        if (collect) {
          collect({ type: 'major', execution: 'sync' });
          collect({ type: 'major', execution: 'sync' });
        }
        run();
        gl.finish();
        const t0 = performance.now();
        for (let f = 0; f < frames; f++) run();
        gl.finish();
        return (performance.now() - t0) / frames;
      }

      const TARGET_BLOCK_MS = 150;
      function measure(variant: string): number {
        const run = () => {
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
          frame(variant);
        };
        for (let i = 0; i < 3; i++) run();
        gl.finish();
        const rough = timeBlock(run, 4);
        const frames = Math.min(80, Math.max(4, Math.round(TARGET_BLOCK_MS / Math.max(rough, 0.05))));
        return timeBlock(run, frames);
      }

      // Run-major: three measurements of one row back to back sit inside one
      // thermal state and agree with each other more than with the truth.
      let index = 0;
      for (let run = 1; run <= runs; run++) {
        for (const v of variants) {
          const perFrameMs = measure(v.id);
          index += 1;
          await report({ type: 'cell', index, run, variant: v.id, perFrameMs });
        }
      }

      return { paints, glRenderer };
    },
    { n: N, runs: RUNS, variants: VARIANTS.map((v) => ({ id: v.id })) },
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
    '| variant | us/flush | saves | no longer does |',
    '|---|---:|---:|---|',
  ];
  let prev: number | undefined;
  for (const { id, drops } of VARIANTS) {
    const us = perFlushUs(id);
    const saves = prev === undefined ? '—' : (prev - us).toFixed(2);
    lines.push(`| ${id} | ${us.toFixed(2)} | ${saves} | ${drops} |`);
    prev = us;
  }
  console.log(lines.join('\n'));

  expect(errors).toEqual([]);
  for (const { id } of VARIANTS) {
    expect(paints[id], `${id}: rendered nothing, so its cost is meaningless`).toBe(true);
  }
});
