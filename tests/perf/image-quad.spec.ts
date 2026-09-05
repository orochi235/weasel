/**
 * What an image quad costs, and how much of it is the geometry it mints.
 *
 * Two halves, and they answer different questions.
 *
 * **`renderer`** is the headline: image commands per frame through the real
 * renderer, next to a pattern-filled rect of the same size. Pattern is the
 * control — same one-draw-per-command shape, same texture bind, but its
 * geometry is a cached mesh with a persistent VAO. Whatever separates them is
 * what the image path pays for its geometry.
 *
 * **`raw`** attributes that gap without the renderer in the way: N small quads
 * per frame through one trivial program, differing only in how the vertices
 * reach the GPU.
 *
 *   - `churn` — a VAO and two buffers created, filled, drawn and deleted per
 *     quad. What `drawImage` does.
 *   - `subdata` — one persistent VAO and buffer, rewritten at offset 0 per
 *     quad. Removes the object lifecycle, keeps the write.
 *   - `arena` — one persistent buffer holding every quad, written at a rising
 *     offset and drawn from there. No draw ever reads bytes a later write
 *     touches.
 *   - `uniform` — a unit quad uploaded once; position comes from a `vec4`
 *     uniform. No buffer write at all.
 *   - `orphan` — one persistent buffer, respecified per quad rather than
 *     updated, which tells the driver the old contents are dead.
 *   - `ring` — separate persistent buffers cycled per quad, so a write lands
 *     `RING` draws behind the one that read that buffer last.
 *
 * Ordered that way they separate the object lifecycle from the write, and the
 * write from where it lands — which is the same question the solid batch's flush
 * raises, since that flush rewrites one buffer from offset 0 every time it
 * happens. `ring` and `orphan` are the two escapes from a stalling write.
 *
 * **The stalling rows are bimodal.** `subdata`, `orphan` and `uniform` have each
 * measured 0.05 us in one run and 55 in the next, from identical code: whether a
 * write waits depends on how far ahead of the CPU the GPU happens to be. Read
 * those rows as "sometimes stalls", never as a cost — the range matters more
 * than the median, and a single fast run does not clear one.
 *
 * This reports; it does not gate. See `tests/bench/README.md`.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Commands (or quads) per frame. `WEASEL_PERF_N` walks it up a ladder. */
const N = Number(process.env.WEASEL_PERF_N ?? 512);

/** Edge of each quad, in px. Scale it down as N goes up to hold painted area
 *  constant, or the ladder measures fill rate instead of per-quad overhead. */
const SIZE = Number(process.env.WEASEL_PERF_SIZE ?? 48);

const RUNS = 3;

const RAW_VARIANTS = ['churn', 'churn-uniform', 'preloaded', 'arena', 'subdata', 'uniform', 'orphan', 'ring'] as const;
const RENDERER_VARIANTS = ['image', 'atlas', 'sprites', 'pattern'] as const;

interface Cell { run: number; group: 'raw' | 'renderer'; variant: string; perFrameMs: number }

test.setTimeout(1_800_000);

test('image quad: geometry cost per draw', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));

  const cells: Cell[] = [];
  const total = (RAW_VARIANTS.length + RENDERER_VARIANTS.length) * RUNS;

  await page.exposeFunction('__imageReport', (msg: unknown) => {
    const m = msg as { type: string } & Record<string, unknown>;
    if (m.type === 'header') {
      console.log('');
      console.log(`Image quad — 800x600, dpr 1, on ${String(m.glRenderer)}`);
      console.log(`collected between measurements: ${String(m.gcAvailable)}`);
      console.log(`every variant paints something: ${String(m.allPaint)}`);
      if (m.notPainting) console.log(`  NOT PAINTING: ${String(m.notPainting)}`);
      console.log(`${N} quads per frame at ${SIZE}px; ${total} cells`);
      console.log('');
      return;
    }
    const c = m as unknown as Cell & { index: number };
    cells.push({ run: c.run, group: c.group, variant: c.variant, perFrameMs: c.perFrameMs });
    console.log(
      `  ${String(c.index).padStart(2)}/${total}  run ${c.run}  `
      + `${c.group}/${c.variant}`.padEnd(20)
      + ` ${c.perFrameMs.toFixed(3)} ms/frame`
      + `  ${((c.perFrameMs * 1000) / N).toFixed(2)} us/quad`,
    );
  });

  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { paints, glRenderer } = await page.evaluate(
    async ({ root, n, size: SIZE, runs, rawVariants, rendererVariants }) => {
      const report = (globalThis as unknown as {
        __imageReport: (m: unknown) => Promise<void>;
      }).__imageReport;

      const base = `/weasel/@fs${root}`;
      const { WeaselRenderer, registerTexture, SPRITE_STRIDE } = await import(
        /* @vite-ignore */ `${base}/packages/core/src/renderer/index.ts`
      );
      const { checkerBitmap, imageBitmaps } = await import(
        /* @vite-ignore */ `${base}/tests/perf/lib/kinds.ts`
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

      const collect = (globalThis as { gc?: (opts?: unknown) => void }).gc;
      const gcAvailable = typeof collect === 'function';

      const px = (i: number) => 20 + ((i * 37) % (W - 160));
      const py = (i: number) => 20 + ((i * 53) % (H - 160));

      // ─── raw GL: four ways to get a quad's vertices to the GPU ──────────

      const RAW_VERT = `#version 300 es
in vec2 a_position;
uniform vec4 u_quad;
uniform vec2 u_toClip;
void main() {
  vec2 p = u_quad.xy + a_position * u_quad.zw;
  gl_Position = vec4(p * u_toClip - 1.0, 0.0, 1.0);
}`;
      const RAW_FRAG = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 outColor;
void main() { outColor = u_color; }`;

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

      const rawProg = compile(RAW_VERT, RAW_FRAG);
      const aPos = gl.getAttribLocation(rawProg, 'a_position');
      const uQuad = gl.getUniformLocation(rawProg, 'u_quad');
      const uToClip = gl.getUniformLocation(rawProg, 'u_toClip');
      const uColor = gl.getUniformLocation(rawProg, 'u_color');

      const QUAD_INDICES = new Uint32Array([0, 1, 2, 1, 3, 2]);

      /** Screen-space corners of quad `i`, the layout `drawImage` builds. */
      const scratch = new Float32Array(8);
      function cornersInto(out: Float32Array, at: number, i: number): void {
        const x0 = px(i);
        const y0 = py(i);
        const x1 = x0 + SIZE;
        const y1 = y0 + SIZE;
        out[at] = x0; out[at + 1] = y0;
        out[at + 2] = x1; out[at + 3] = y0;
        out[at + 4] = x0; out[at + 5] = y1;
        out[at + 6] = x1; out[at + 7] = y1;
      }

      /** Persistent geometry for `subdata` and `uniform`. */
      const oneVao = gl.createVertexArray()!;
      const oneVbo = gl.createBuffer()!;
      const oneIbo = gl.createBuffer()!;
      gl.bindVertexArray(oneVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, oneVbo);
      gl.bufferData(gl.ARRAY_BUFFER, 8 * 4, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 8, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, oneIbo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, QUAD_INDICES, gl.STATIC_DRAW);
      gl.bindVertexArray(null);

      /** The unit quad the uniform-driven variants draw forever. */
      const UNIT_QUAD = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);

      /** Arena: every quad's vertices in one buffer, plus the indices to reach
       *  each of them. Filled once here; `preloaded` never writes it again. */
      const arenaVao = gl.createVertexArray()!;
      const arenaVbo = gl.createBuffer()!;
      const arenaIbo = gl.createBuffer()!;
      const arenaIdx = new Uint32Array(n * 6);
      const arenaVerts = new Float32Array(n * 8);
      for (let i = 0; i < n; i++) {
        const b = i * 4;
        arenaIdx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6);
        cornersInto(arenaVerts, i * 8, i);
      }
      gl.bindVertexArray(arenaVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, arenaVbo);
      gl.bufferData(gl.ARRAY_BUFFER, arenaVerts, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 8, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, arenaIbo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arenaIdx, gl.STATIC_DRAW);
      gl.bindVertexArray(null);

      /** Ring size for the `ring` variant — how many draws pass before a
       *  buffer is written again. */
      const RING = 64;

      /** Separate VAO and vertex buffer per ring slot, over one static index
       *  buffer that nothing ever writes. */
      const ringVaos: WebGLVertexArrayObject[] = [];
      const ringVbos: WebGLBuffer[] = [];
      const ringIbo = gl.createBuffer()!;
      for (let r = 0; r < RING; r++) {
        const vao = gl.createVertexArray()!;
        const vbo = gl.createBuffer()!;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, 8 * 4, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 8, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ringIbo);
        if (r === 0) gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, QUAD_INDICES, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        ringVaos.push(vao);
        ringVbos.push(vbo);
      }

      /** Fresh VAO and buffers around one draw, then freed — what `drawImage`
       *  does. `verts` decides whether the position comes from the buffer or
       *  from `u_quad`. */
      function churnDraw(verts: Float32Array): void {
        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);
        const vbo = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 8, 0);
        const ibo = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, QUAD_INDICES, gl.DYNAMIC_DRAW);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);
        gl.deleteVertexArray(vao);
        gl.deleteBuffer(vbo);
        gl.deleteBuffer(ibo);
      }

      /**
       * ARRAY_BUFFER is not VAO state, so binding a VAO restores the index
       * buffer and nothing else. Leaving the array binding to whatever the
       * previous variant left wrote vertices into someone else's buffer and
       * drew nothing — which the paint probe caught and a timing table would
       * not have.
       */
      function rawFrame(variant: string): void {
        gl.useProgram(rawProg);
        gl.uniform2f(uToClip, 2 / W, 2 / H);
        gl.uniform4f(uColor, 0.2, 0.5, 0.9, 1);
        // The buffer-fed variants carry screen coordinates on the attribute, so
        // the uniform must leave them alone.
        const fromUniform = variant === 'uniform' || variant === 'churn-uniform';
        if (!fromUniform) gl.uniform4f(uQuad, 0, 0, 1, 1);

        switch (variant) {
          case 'churn':
            for (let i = 0; i < n; i++) {
              cornersInto(scratch, 0, i);
              churnDraw(scratch);
            }
            return;

          case 'churn-uniform':
            for (let i = 0; i < n; i++) {
              gl.uniform4f(uQuad, px(i), py(i), SIZE, SIZE);
              churnDraw(UNIT_QUAD);
            }
            return;

          case 'preloaded':
            gl.bindVertexArray(arenaVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, arenaVbo);
            for (let i = 0; i < n; i++) {
              gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, i * 24);
            }
            gl.bindVertexArray(null);
            return;

          case 'arena':
            gl.bindVertexArray(arenaVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, arenaVbo);
            // Orphan once a frame, so the frame's first write is not waiting on
            // the previous frame's reads either.
            gl.bufferData(gl.ARRAY_BUFFER, arenaVerts.byteLength, gl.DYNAMIC_DRAW);
            for (let i = 0; i < n; i++) {
              cornersInto(scratch, 0, i);
              gl.bufferSubData(gl.ARRAY_BUFFER, i * 32, scratch);
              gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, i * 24);
            }
            gl.bindVertexArray(null);
            return;

          case 'orphan':
            // Respecify rather than update: `bufferData` says the old contents
            // are dead, which lets the driver hand back fresh storage instead
            // of waiting for the draw that is still reading the old.
            gl.bindVertexArray(oneVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, oneVbo);
            for (let i = 0; i < n; i++) {
              cornersInto(scratch, 0, i);
              gl.bufferData(gl.ARRAY_BUFFER, scratch, gl.DYNAMIC_DRAW);
              gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
            }
            gl.bindVertexArray(null);
            return;

          case 'ring':
            for (let i = 0; i < n; i++) {
              const slot = i % RING;
              cornersInto(scratch, 0, i);
              gl.bindVertexArray(ringVaos[slot]);
              gl.bindBuffer(gl.ARRAY_BUFFER, ringVbos[slot]);
              gl.bufferSubData(gl.ARRAY_BUFFER, 0, scratch);
              gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
            }
            gl.bindVertexArray(null);
            return;

          case 'subdata':
            gl.bindVertexArray(oneVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, oneVbo);
            for (let i = 0; i < n; i++) {
              cornersInto(scratch, 0, i);
              gl.bufferSubData(gl.ARRAY_BUFFER, 0, scratch);
              gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
            }
            gl.bindVertexArray(null);
            return;

          default:
            gl.bindVertexArray(oneVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, oneVbo);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, UNIT_QUAD);
            for (let i = 0; i < n; i++) {
              gl.uniform4f(uQuad, px(i), py(i), SIZE, SIZE);
              gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
            }
            gl.bindVertexArray(null);
        }
      }

      // ─── the real renderer ──────────────────────────────────────────────

      const renderer = new WeaselRenderer({ gl, canvas, width: W, height: H, dpr: 1 });
      const bitmaps = await imageBitmaps(6);
      const patternHandle = registerTexture(await checkerBitmap());

      const imageCmds: unknown[] = [];
      const atlasCmds: unknown[] = [];
      const patternCmds: unknown[] = [];
      // 4x4 cells of the first bitmap, so every quad samples one texture and
      // the run has nothing to break it — the shape the mega view draws.
      const CELL = 16;
      for (let i = 0; i < n; i++) {
        imageCmds.push({
          kind: 'image', image: bitmaps[i % bitmaps.length],
          x: px(i), y: py(i), w: SIZE, h: SIZE,
        });
        atlasCmds.push({
          kind: 'image', image: bitmaps[0],
          x: px(i), y: py(i), w: SIZE, h: SIZE,
          source: {
            x: (i % 4) * CELL, y: (Math.floor(i / 4) % 4) * CELL, w: CELL, h: CELL,
          },
        });
        patternCmds.push({
          kind: 'path',
          path: { kind: 'rect', x: px(i), y: py(i), width: SIZE, height: SIZE },
          fill: { fill: 'pattern', pattern: patternHandle, origin: { x: i % 8, y: i % 8 } },
        });
      }
      // The same quads as `atlas`, packed — so the gap between the two is the
      // command walk and nothing else.
      const packed = new Float32Array(n * SPRITE_STRIDE);
      for (let i = 0; i < n; i++) {
        packed.set([
          px(i), py(i), SIZE, SIZE,
          (i % 4) * CELL, (Math.floor(i / 4) % 4) * CELL, CELL, CELL,
          1,
        ], i * SPRITE_STRIDE);
      }
      const spriteCmds = [{ kind: 'sprites', image: bitmaps[0], sprites: packed }];

      const rendererCmds: Record<string, unknown[]> = {
        image: imageCmds, atlas: atlasCmds, sprites: spriteCmds, pattern: patternCmds,
      };

      // ─── timing ─────────────────────────────────────────────────────────

      function timeBlock(frame: () => void, frames: number): number {
        if (collect) {
          collect({ type: 'major', execution: 'sync' });
          collect({ type: 'major', execution: 'sync' });
        }
        frame();
        gl.finish();
        const t0 = performance.now();
        for (let f = 0; f < frames; f++) frame();
        gl.finish();
        return (performance.now() - t0) / frames;
      }

      const TARGET_BLOCK_MS = 150;
      function measure(frame: () => void): number {
        for (let i = 0; i < 3; i++) frame();
        gl.finish();
        const rough = timeBlock(frame, 4);
        const frames = Math.min(80, Math.max(4, Math.round(TARGET_BLOCK_MS / Math.max(rough, 0.05))));
        return timeBlock(frame, frames);
      }

      const frameFor = (group: string, variant: string): (() => void) =>
        group === 'raw'
          ? () => {
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            rawFrame(variant);
          }
          : () => renderer.render(rendererCmds[variant], identity);

      /** A variant that silently draws nothing measures free. */
      function paintsAnything(group: string, variant: string): boolean {
        frameFor(group, variant)();
        gl.finish();
        const buf = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        for (let p = 3; p < buf.length; p += 4) if (buf[p] !== 0) return true;
        return false;
      }

      const all: Array<{ group: string; variant: string }> = [
        ...rawVariants.map((v) => ({ group: 'raw', variant: v })),
        ...rendererVariants.map((v) => ({ group: 'renderer', variant: v })),
      ];

      const paints: Record<string, boolean> = {};
      for (const { group, variant } of all) {
        paints[`${group}/${variant}`] = paintsAnything(group, variant);
      }
      const notPainting = Object.entries(paints).filter(([, ok]) => !ok).map(([k]) => k);

      // Pay this context's one-time costs before the first timed block.
      for (const { group, variant } of all) {
        const frame = frameFor(group, variant);
        for (let i = 0; i < 3; i++) frame();
      }
      gl.finish();

      await report({
        type: 'header', glRenderer, gcAvailable,
        allPaint: notPainting.length === 0,
        notPainting: notPainting.join(', '),
      });

      let index = 0;
      for (let run = 1; run <= runs; run++) {
        for (const { group, variant } of all) {
          const perFrameMs = +measure(frameFor(group, variant)).toFixed(4);
          index += 1;
          await report({ type: 'cell', index, run, group, variant, perFrameMs });
        }
      }

      renderer.dispose();
      return { paints, glRenderer };
    },
    {
      root: repoRoot, n: N, size: SIZE, runs: RUNS,
      rawVariants: [...RAW_VARIANTS], rendererVariants: [...RENDERER_VARIANTS],
    },
  );

  // ─── analysis ──────────────────────────────────────────────────────────

  const runs = Array.from({ length: RUNS }, (_, i) => i + 1);
  const med = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)];
  const at = (run: number, group: string, variant: string) =>
    cells.find((c) => c.run === run && c.group === group && c.variant === variant)!.perFrameMs;
  const us = (group: string, variant: string) =>
    med(runs.map((r) => (at(r, group, variant) * 1000) / N));
  const usLo = (group: string, variant: string) =>
    Math.min(...runs.map((r) => (at(r, group, variant) * 1000) / N));
  const usHi = (group: string, variant: string) =>
    Math.max(...runs.map((r) => (at(r, group, variant) * 1000) / N));

  const row = (group: string, variant: string, note: string) =>
    `| ${group}/${variant} | ${us(group, variant).toFixed(2)} `
    + `(${usLo(group, variant).toFixed(2)}–${usHi(group, variant).toFixed(2)}) | ${note} |`;

  const lines = [
    '',
    `Image quad — 800x600, dpr 1, on ${glRenderer}`,
    `${N} quads per frame at ${SIZE}px (${((N * SIZE * SIZE) / (800 * 600)).toFixed(1)}x overdraw), `
    + `${RUNS} runs; median us/quad, range in parens.`,
    '',
    '| variant | us/quad | what it does |',
    '|---|---:|---|',
    row('renderer', 'image', 'kind: image, 6 bitmaps — nothing merges'),
    row('renderer', 'atlas', 'kind: image, one bitmap and source rects — one run'),
    row('renderer', 'sprites', 'kind: sprites — the same run, packed'),
    row('renderer', 'pattern', 'same rect, pattern fill — cached mesh, persistent VAO'),
    row('raw', 'preloaded', 'one buffer written once; only the index offset moves'),
    row('raw', 'churn', 'VAO + 2 buffers minted and freed per quad'),
    row('raw', 'churn-uniform', 'the same, plus a uniform per quad'),
    row('raw', 'arena', 'persistent buffer, each quad written at its own offset'),
    row('raw', 'subdata', 'persistent buffer, rewritten at offset 0 per quad'),
    row('raw', 'uniform', 'persistent unit quad, position in a uniform'),
    row('raw', 'orphan', 'one persistent buffer, respecified per quad'),
    row('raw', 'ring', 'a ring of persistent buffers, one written per quad'),
    '',
    `renderer image − atlas (what coalescing is worth): ${(us('renderer', 'image') - us('renderer', 'atlas')).toFixed(2)} us`,
    `renderer atlas − sprites (what the command walk costs): ${(us('renderer', 'atlas') - us('renderer', 'sprites')).toFixed(2)} us`,
    `renderer image − pattern: ${(us('renderer', 'image') - us('renderer', 'pattern')).toFixed(2)} us`,
    `raw churn − preloaded (the object lifecycle): ${(us('raw', 'churn') - us('raw', 'preloaded')).toFixed(2)} us`,
    `raw subdata − preloaded (rewriting one buffer): ${(us('raw', 'subdata') - us('raw', 'preloaded')).toFixed(2)} us`,
    `raw arena − preloaded (writing disjoint ranges): ${(us('raw', 'arena') - us('raw', 'preloaded')).toFixed(2)} us`,
    `raw uniform − preloaded (a uniform per draw): ${(us('raw', 'uniform') - us('raw', 'preloaded')).toFixed(2)} us`,
    `raw churn-uniform − churn (a uniform per draw, again): ${(us('raw', 'churn-uniform') - us('raw', 'churn')).toFixed(2)} us`,
    `raw churn − orphan: ${(us('raw', 'churn') - us('raw', 'orphan')).toFixed(2)} us`,
    `raw churn − ring: ${(us('raw', 'churn') - us('raw', 'ring')).toFixed(2)} us`,
  ];
  console.log(lines.join('\n'));

  expect(errors).toEqual([]);
  for (const [k, ok] of Object.entries(paints)) {
    expect(ok, `${k}: rendered nothing`).toBe(true);
  }
  expect(cells.length).toBe(total);
});
