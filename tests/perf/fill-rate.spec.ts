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
 * question every merge into the batch program raises. Variants are compiled and
 * timed in one page, alternating, so drift moves both.
 *
 * This reports; it does not gate. See `tests/bench/README.md`.
 */
import { test, expect } from '@playwright/test';

const W = 1200;
const H = 900;

/**
 * Full-viewport quads per frame, and frames per sample. Sized so one sample is
 * hundreds of milliseconds of GPU work rather than a fraction of one: at 40
 * layers the samples ran ~0.5 ms and scattered +/-30%, which is the clock
 * ramping, and no shader difference survives that.
 *
 * The blend is on, so nothing is discarded early and every layer really runs.
 */
const LAYERS = 400;
const FRAMES = 20;
const RUNS = 8;
/** Samples dropped from the front — the GPU is still ramping through them. */
const WARMUP_RUNS = 3;

interface Row { run: number; variant: string; msPerFrame: number }

test.setTimeout(600_000);

test('fill rate: what glyph math costs a fragment that is not a glyph', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto('/weasel/#animation');
  await page.waitForSelector('canvas');

  const { rows, glRenderer } = await page.evaluate(
    async ({ w, h, layers, frames, runs }) => {
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
  vec4 src = mix(texel * u_color, vec4(u_color.rgb, u_color.a * sdfAlpha), u_color.a * 0.0);
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

      /** `gl.finish()` does not block in Chrome — the commands go to the GPU
       *  process and the call returns, which times 43M fragments at 0.003 ms
       *  and reads as free. A one-pixel `readPixels` is a real sync point:
       *  the result cannot exist until the draws behind it have run. */
      const sync = new Uint8Array(4);
      function drain(): void {
        gl!.readPixels(0, 0, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, sync);
      }

      function timeVariant(prog: WebGLProgram): number {
        frame(prog);
        drain();
        const t0 = performance.now();
        for (let f = 0; f < frames; f++) frame(prog);
        drain();
        return (performance.now() - t0) / frames;
      }

      const rows: { run: number; variant: string; msPerFrame: number }[] = [];
      // ABBA within each run, not ABAB. The clock ramps for the first second or
      // so, and under ABAB whichever variant is measured second sits later on
      // that ramp every single time — which reads as that variant being faster
      // early and slower late, and is entirely an artifact of the order.
      for (let run = 1; run <= runs; run++) {
        const order = run % 2 === 1 ? [0, 1, 1, 0] : [1, 0, 0, 1];
        for (const i of order) {
          const v = variants[i];
          rows.push({ run, variant: v.name, msPerFrame: timeVariant(v.prog) });
        }
      }
      return { rows, glRenderer };
    },
    { w: W, h: H, layers: LAYERS, frames: FRAMES, runs: RUNS },
  );

  const typed = rows as unknown as Row[];
  const fragments = (W * H * LAYERS) / 1e6;
  console.log(`\nFill rate — ${W}x${H}, ${LAYERS} full-viewport layers `
    + `(${fragments.toFixed(1)}M fragments/frame) on ${glRenderer}\n`);

  const byVariant = new Map<string, number[]>();
  for (const r of typed) {
    console.log(
      `  run ${r.run}  ${r.variant.padEnd(11)} ${r.msPerFrame.toFixed(3).padStart(7)} ms/frame`
      + `  ${((r.msPerFrame * 1e6) / (fragments * 1e6)).toFixed(4)} ns/fragment`,
    );
    const list = byVariant.get(r.variant) ?? [];
    list.push(r.msPerFrame);
    byVariant.set(r.variant, list);
  }

  // The minimum, not the median: contention, scheduling and a cool clock can
  // only make a sample slower, so the fastest run of each variant is the one
  // least contaminated by everything this spec is not trying to measure.
  const settled = (name: string) => byVariant.get(name)!.slice(WARMUP_RUNS * 2);
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
  console.log(`  glyph math costs    ${(((glyph / plain) - 1) * 100).toFixed(1)}% of a fragment`);
  console.log('');

  expect(errors, errors.join('\n')).toEqual([]);
});
