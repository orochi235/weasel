/**
 * What a fragment shader's arithmetic costs, isolated from everything else.
 *
 * The other perf specs measure frames of many small commands, where the cost is
 * draw calls and buffer uploads and a fragment runs a handful of times per
 * command. That workload cannot see fill rate at all: adding `fwidth` and a
 * median to `batchFill` moved a 15,000-command wall by less than the same tree
 * moves between two runs an hour apart. This one goes the other way — a few
 * huge overlapping quads, so per-command overhead rounds to nothing and almost
 * all the time is fragments.
 *
 * It answers "can this shader afford another instruction", which is the
 * question every merge into the batch program raises. Variants are compiled in
 * one page and timed one frame a task, interleaved sample by sample, so drift
 * moves all of them.
 *
 * This reports; it does not gate. See `tests/perf/README.md`.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { isolate } from './lib/isolate';
import { metric, rounds, startRun } from './lib/result';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const W = 1200;
const H = 900;

/**
 * Full-viewport quads per frame. Sized so one frame is milliseconds of GPU
 * work rather than a fraction of one: at 40 layers a sample ran ~0.5 ms and
 * scattered +/-30%, which is the clock ramping, and no shader difference
 * survives that.
 *
 * The blend is on, so nothing is discarded early and every layer really runs.
 */
const LAYERS = 400;
/** Single-frame samples per variant per run, interleaved (`lib/frameTiming.ts`). */
const SAMPLES = 20;
/** Runs dropped from the front — the GPU is still ramping through them. */
const WARMUP_RUNS = 3;
const RUNS = rounds(8, { min: WARMUP_RUNS + 1 });

interface Row { run: number; variant: string; msPerFrame: number }

test.setTimeout(600_000);

test('fill rate: what the batch shader costs a fragment it is not for', async ({ page, browser, browserName }) => {
  const run = startRun('fill-rate', { viewport: `${W}x${H}`, layers: LAYERS, samples: SAMPLES, runs: RUNS, warmupRuns: WARMUP_RUNS });
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  const fragments = (W * H * LAYERS) / 1e6;
  await page.exposeFunction('__fillReport', (r: Row) => {
    console.log(
      `  run ${String(r.run).padStart(2)}/${RUNS}  ${r.variant.padEnd(12)} ${r.msPerFrame.toFixed(3).padStart(7)} ms/frame`
      + `  ${((r.msPerFrame * 1e6) / (fragments * 1e6)).toFixed(4)} ns/fragment`,
    );
  });

  await isolate(page);
  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { rows, glRenderer, finishMs, drainMs } = await page.evaluate(
    async ({ root, w, h, layers, samples, runs }) => {
      const report = (globalThis as unknown as { __fillReport: (r: unknown) => Promise<void> }).__fillReport;
      const { timeInterleaved } = await import(/* @vite-ignore */ `/weasel/@fs${root}/tests/perf/lib/frameTiming.ts`);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const gl = canvas.getContext('webgl2', { antialias: false });
      if (!gl) throw new Error('no WebGL2 context');
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const glRenderer = String(dbg
        ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER));

      const VERT = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
out vec2 v_uv;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_uv;
}`;

      /** The batch shader's fragment body as it ships. */
      const PLAIN = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec4 u_color;
out vec4 outColor;
void main() {
  vec4 src = texture(u_tex, v_uv) * u_color;
  float a = src.a * 0.5;
  outColor = vec4(src.rgb * a, a);
}`;

      /** The same, plus the glyph math a merged text tier has to run
       *  unconditionally: a median across three channels, a screen-space
       *  derivative, and a smoothstep. Unconditional because `fwidth` inside a
       *  branch is undefined, which is the whole constraint. */
      const WITH_GLYPH_MATH = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec4 u_color;
out vec4 outColor;
float median3(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}
void main() {
  vec4 texel = texture(u_tex, v_uv);
  float sdfVal = median3(texel.r, texel.g, texel.b);
  float aaW = max(0.5 * fwidth(sdfVal), 0.0005);
  float sdfAlpha = smoothstep(0.5 - aaW, 0.5 + aaW, sdfVal);
  // Selected between, the way a paint-mode vertex attribute would select.
  // u_color.a - 0.5, not u_color.a * 0.0: both are zero at runtime, but a
  // compiler folds the second and then deletes every line above that feeds
  // sdfAlpha — which made this variant measure the same shader as plain.
  vec4 src = mix(texel * u_color, vec4(u_color.rgb, u_color.a * sdfAlpha), u_color.a - 0.5);
  float a = src.a * 0.5;
  outColor = vec4(src.rgb * a, a);
}`;

      /**
       * The same again, plus the one thing the coordinate-carrying gradients
       * add to a fragment that is not one: the sample's coordinate stops being
       * a varying and becomes a value the shader computed.
       *
       * The branch is never taken here — that is the point. What is being
       * priced is not the `atan` inside it, which a non-gradient never runs,
       * but whether a texture read the hardware can no longer schedule against
       * a plain varying costs anything on its own.
       */
      const WITH_GRADIENT_UV = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec4 u_color;
out vec4 outColor;
float median3(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}
void main() {
  // u_color.a is 0.5, so the mode is negative and the branch never runs.
  float mode = u_color.a - 1.0;
  float isGrad = step(2.5, mode);
  vec2 uv = v_uv;
  if (isGrad > 0.5) {
    float t = mode > 3.5 ? fract(atan(v_uv.y, v_uv.x) * 0.1591549431) : length(v_uv);
    uv = vec2(t, 0.5);
  }
  vec4 texel = texture(u_tex, uv);
  float sdfVal = median3(texel.r, texel.g, texel.b);
  float aaW = max(0.5 * fwidth(sdfVal), 0.0005);
  float sdfAlpha = smoothstep(0.5 - aaW, 0.5 + aaW, sdfVal);
  vec4 src = mix(texel * u_color, vec4(u_color.rgb, u_color.a * sdfAlpha), u_color.a - 0.5);
  float a = src.a * 0.5;
  outColor = vec4(src.rgb * a, a);
}`;

      /**
       * The same again with the sample split across the branch instead: the
       * gradient arm reads its computed coordinate, and every other fragment
       * reads the varying it always did.
       *
       * The shipping shader is written this way. What it buys over
       * `gradient-uv` is the whole difference between the two here — a texture
       * read the hardware can schedule against a varying, and one it cannot.
       */
      const WITH_SPLIT_SAMPLE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec4 u_color;
out vec4 outColor;
float median3(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}
void main() {
  float mode = u_color.a - 1.0;
  float isGrad = step(2.5, mode);
  vec4 texel;
  if (isGrad > 0.5) {
    float t = mode > 3.5 ? fract(atan(v_uv.y, v_uv.x) * 0.1591549431) : length(v_uv);
    texel = texture(u_tex, vec2(t, 0.5));
  } else {
    texel = texture(u_tex, v_uv);
  }
  float sdfVal = median3(texel.r, texel.g, texel.b);
  float aaW = max(0.5 * fwidth(sdfVal), 0.0005);
  float sdfAlpha = smoothstep(0.5 - aaW, 0.5 + aaW, sdfVal);
  vec4 src = mix(texel * u_color, vec4(u_color.rgb, u_color.a * sdfAlpha), u_color.a - 0.5);
  float a = src.a * 0.5;
  outColor = vec4(src.rgb * a, a);
}`;

      function build(fragSrc: string): WebGLProgram {
        const vs = gl!.createShader(gl!.VERTEX_SHADER)!;
        gl!.shaderSource(vs, VERT); gl!.compileShader(vs);
        const fs = gl!.createShader(gl!.FRAGMENT_SHADER)!;
        gl!.shaderSource(fs, fragSrc); gl!.compileShader(fs);
        if (!gl!.getShaderParameter(fs, gl!.COMPILE_STATUS)) {
          throw new Error(`fragment: ${gl!.getShaderInfoLog(fs)}`);
        }
        const p = gl!.createProgram()!;
        gl!.attachShader(p, vs); gl!.attachShader(p, fs); gl!.linkProgram(p);
        if (!gl!.getProgramParameter(p, gl!.LINK_STATUS)) {
          throw new Error(`link: ${gl!.getProgramInfoLog(p)}`);
        }
        return p;
      }

      // One full-viewport quad, drawn `layers` times per frame.
      const verts = new Float32Array([
        -1, -1, 0, 0, 1, -1, 1, 0, 1, 1, 1, 1,
        -1, -1, 0, 0, 1, 1, 1, 1, -1, 1, 0, 1,
      ]);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const side = 64;
      const px = new Uint8Array(side * side * 4);
      for (let i = 0; i < px.length; i++) px[i] = (i * 37) % 256;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, side, side, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.viewport(0, 0, w, h);

      const variants: { name: string; prog: WebGLProgram }[] = [
        { name: 'plain', prog: build(PLAIN) },
        { name: 'glyph-math', prog: build(WITH_GLYPH_MATH) },
        { name: 'gradient-uv', prog: build(WITH_GRADIENT_UV) },
        { name: 'split-sample', prog: build(WITH_SPLIT_SAMPLE) },
      ];

      for (const v of variants) {
        gl.useProgram(v.prog);
        const aPos = gl.getAttribLocation(v.prog, 'a_position');
        const aUv = gl.getAttribLocation(v.prog, 'a_uv');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(aUv);
        gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
      }

      function frame(prog: WebGLProgram): void {
        gl!.useProgram(prog);
        const aPos = gl!.getAttribLocation(prog, 'a_position');
        const aUv = gl!.getAttribLocation(prog, 'a_uv');
        gl!.enableVertexAttribArray(aPos);
        gl!.vertexAttribPointer(aPos, 2, gl!.FLOAT, false, 16, 0);
        gl!.enableVertexAttribArray(aUv);
        gl!.vertexAttribPointer(aUv, 2, gl!.FLOAT, false, 16, 8);
        gl!.uniform1i(gl!.getUniformLocation(prog, 'u_tex'), 0);
        gl!.uniform4f(gl!.getUniformLocation(prog, 'u_color'), 1, 1, 1, 0.5);
        for (let i = 0; i < layers; i++) gl!.drawArrays(gl!.TRIANGLES, 0, 6);
      }

      const rows: { run: number; variant: string; msPerFrame: number }[] = [];
      for (let run = 1; run <= runs; run++) {
        const timed = await timeInterleaved(gl, variants.map((v) => ({ id: v.name, frame: () => frame(v.prog) })), { samples });
        for (const v of variants) {
          rows.push({ run, variant: v.name, msPerFrame: timed[v.name].net });
          await report({ run, variant: v.name, msPerFrame: timed[v.name].net });
        }
      }

      // Whether `finish` waits for the GPU, which is why `lib/frameTiming.ts` does not end a sample in it.
      const plain = [{ id: 'plain', frame: () => frame(variants[0].prog) }];
      const finishMs = (await timeInterleaved(gl, plain, { samples, sync: () => gl.finish() })).plain.stat;
      const drainMs = (await timeInterleaved(gl, plain, { samples })).plain.stat;
      return { rows, glRenderer, finishMs, drainMs };
    },
    { root: repoRoot, w: W, h: H, layers: LAYERS, samples: SAMPLES, runs: RUNS },
  );

  console.log(`\nFill rate — ${W}x${H}, ${LAYERS} full-viewport layers `
    + `(${fragments.toFixed(1)}M fragments/frame) on ${glRenderer}\n`);

  const byVariant = new Map<string, number[]>();
  for (const r of rows as unknown as Row[]) {
    const list = byVariant.get(r.variant) ?? [];
    list.push(r.msPerFrame);
    byVariant.set(r.variant, list);
  }

  // The minimum run, not the median: contention, scheduling and a cool clock can
  // only make a run slower, so the fastest run of each variant is the one
  // least contaminated by everything this spec is not trying to measure.
  const settled = (name: string) => byVariant.get(name)!.slice(WARMUP_RUNS);
  console.log(`  plain through finish ${finishMs.toFixed(3).padStart(7)} ms/frame, through a readPixels ${drainMs.toFixed(3)}`
    + '  (far apart means finish does not wait for the GPU)');
  const plain = Math.min(...settled('plain'));
  const glyph = Math.min(...settled('glyph-math'));
  console.log('');
  const spread = (name: string) => {
    const xs = settled(name);
    return ((Math.max(...xs) - Math.min(...xs)) / Math.min(...xs)) * 100;
  };
  console.log(`  fastest  plain       ${plain.toFixed(3).padStart(7)} ms/frame`
    + `   spread ${spread('plain').toFixed(1)}%`);
  console.log(`  fastest  glyph-math  ${glyph.toFixed(3).padStart(7)} ms/frame`
    + `   spread ${spread('glyph-math').toFixed(1)}%`);
  const grad = Math.min(...settled('gradient-uv'));
  console.log(`  fastest  gradient-uv ${grad.toFixed(3).padStart(7)} ms/frame`
    + `   spread ${spread('gradient-uv').toFixed(1)}%`);
  console.log(`  glyph math costs    ${(((glyph / plain) - 1) * 100).toFixed(1)}% of a fragment`);
  const split = Math.min(...settled('split-sample'));
  console.log(`  fastest  split-sample ${split.toFixed(3).padStart(7)} ms/frame`
    + `  spread ${spread('split-sample').toFixed(1)}%`);
  console.log(`  a computed uv costs ${(((grad / glyph) - 1) * 100).toFixed(1)}% more`
    + `  (against glyph-math, its only difference)`);
  console.log(`  splitting the sample ${(((split / glyph) - 1) * 100).toFixed(1)}% more`
    + `  (the form that ships)`);
  console.log('');

  expect(errors, errors.join('\n')).toEqual([]);

  run.machine({ glRenderer, browser: `${browserName} ${browser.version()}` });
  const stat = `min of ${RUNS - WARMUP_RUNS} runs after ${WARMUP_RUNS} warmup runs; each the median of ${SAMPLES} single-frame samples less the least frame that draws, one frame a task (lib/frameTiming.ts)`;
  for (const name of byVariant.keys()) {
    const xs = settled(name);
    const fastest = Math.min(...xs);
    run.item(name, {
      perFrame: metric(fastest, 'ms', stat, xs),
      perFragment: metric((fastest * 1e6) / (fragments * 1e6), 'ns', stat),
      spread: metric(spread(name), '%', '(max - min) / min over the same samples'),
    });
  }
  run.write();
});
