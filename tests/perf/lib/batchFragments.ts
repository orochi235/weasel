/**
 * The shipping batch program as `fill-rate.spec.ts` variants, run in the page.
 *
 * Every variant draws a full-viewport quad `layers` times with the real
 * `BATCH_VERT_SRC`; the attributes nothing varies are disabled and read as
 * constants, so `a_texSlot` picks the slot, mode, and matrix for the whole
 * frame. `batch-chain8-*` is the batch program with the eight-slot chain of
 * compares it had before the tree, rebuilt here so the two can be timed in one
 * page. `batch-glyph-*` draw glyphs off an MSDF atlas (paint mode 1) at a
 * field scale for large text and for text small enough to take the glyph taps.
 */
import type * as BatchFill from '../../../packages/renderer/src/shaders/batchFill';

export interface FillVariant { name: string; frame: () => void }

type Mod = typeof BatchFill;

/** The batch fragment stage with its fetch replaced by the pre-tree chain over `slots`. */
function chainSource(mod: Mod, slots: number): string {
  const arms: string[] = [];
  for (let i = 1; i < slots; i++) arms.push(`  if (slot == ${i}) return texture(u_samplers[${i}], uv);`);
  const fetch = `vec4 sampleSlot(int slot, vec2 uv) {\n${arms.join('\n')}\n  return texture(u_samplers[0], uv);\n}`;
  const tapArms = arms.map((a) => a.replace('texture(', 'textureLod(').replace(', uv)', ', uv, 0.0)'));
  const tap = `vec4 glyphTap(vec2 uv) {\n  int slot = v_texSlot;\n${tapArms.join('\n')}\n  return vec4(0.0);\n}`;
  const n = mod.BATCH_TEXTURE_SLOTS;
  const src = mod.BATCH_FRAG_SRC
    .replace(/vec4 sampleSlot\(int slot, vec2 uv\) \{[\s\S]*?\n\}\n/, `${fetch}\n`)
    .replace(/vec4 glyphTap\(vec2 uv\) \{[\s\S]*?\n\}\n/, `${tap}\n`)
    .replace(`uniform sampler2D u_samplers[${n}];`, `uniform sampler2D u_samplers[${slots}];`)
    .replace(`uniform vec2 u_fieldScale[${n}];`, `uniform vec2 u_fieldScale[${slots}];`)
    .replace(`u_samplers[${mod.RAMP_SLOT}]`, `u_samplers[${slots - 1}]`);
  if (src === mod.BATCH_FRAG_SRC || /if \(slot < /.test(src)) throw new Error('chainSource: the batch fragment stage changed shape');
  return src;
}

export function batchFragmentVariants(
  gl: WebGL2RenderingContext,
  mod: Mod,
  { layers, tex, quad }: { layers: number; tex: WebGLTexture; quad: WebGLBuffer },
): FillVariant[] {
  const L = mod.BATCH_ATTRIBUTE_LOCATIONS;
  const build = (frag: string, slots: number, matrices: number, fieldScale = 1) => {
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, mod.BATCH_VERT_SRC); gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, frag); gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) throw new Error(`batch fragment: ${gl.getShaderInfoLog(fs)}`);
    const p = gl.createProgram()!;
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`batch link: ${gl.getProgramInfoLog(p)}`);
    gl.useProgram(p);
    const u = (name: string) => gl.getUniformLocation(p, name);
    const ident3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    gl.uniformMatrix3fv(u('u_proj'), false, ident3);
    gl.uniformMatrix3fv(u('u_model'), false, ident3);
    gl.uniform1iv(u('u_samplers'), Array.from({ length: slots }, (_, i) => i));
    gl.uniform2fv(u('u_fieldScale'), new Float32Array(slots * 2).fill(fieldScale));
    gl.uniform4f(u('u_color'), 1, 1, 1, 1);
    gl.uniform1fv(u('u_alpha'), new Float32Array(matrices).fill(0.5));
    const m = new Float32Array(matrices * 16);
    for (let i = 0; i < matrices; i++) for (let d = 0; d < 4; d++) m[i * 16 + d * 5] = 1;
    gl.uniformMatrix4fv(u('u_colorMatrix'), false, m);
    gl.uniform4fv(u('u_colorBias'), new Float32Array(matrices * 4));
    return p;
  };
  const variant = (name: string, prog: WebGLProgram, texSlot: number): FillVariant => ({
    name,
    frame: () => {
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      // The quad is (x, y, u, v) a vertex, the layout the spec's own variants read.
      gl.enableVertexAttribArray(L.a_position);
      gl.vertexAttribPointer(L.a_position, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(L.a_uv);
      gl.vertexAttribPointer(L.a_uv, 2, gl.FLOAT, false, 16, 8);
      gl.disableVertexAttribArray(L.a_vertexColor);
      gl.vertexAttrib4f(L.a_vertexColor, 1, 1, 1, 1);
      gl.disableVertexAttribArray(L.a_post);
      gl.vertexAttrib1f(L.a_post, 1);
      gl.disableVertexAttribArray(L.a_texSlot);
      gl.vertexAttrib1f(L.a_texSlot, texSlot);
      for (let i = 0; i < layers; i++) gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
  });

  const slots = mod.BATCH_TEXTURE_SLOTS;
  for (let i = 0; i < slots; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex); }
  gl.activeTexture(gl.TEXTURE0);

  const tree = build(mod.BATCH_FRAG_SRC, slots, 1);
  // The quad's uv runs 0 to 1 across the viewport, so a field scale of f puts
  // f/2 * (1/w + 1/h) field units across a pixel: 0.1 for large text, 0.5 for
  // text small enough to take the glyph taps.
  const [w, h] = [gl.drawingBufferWidth, gl.drawingBufferHeight];
  const scaleFor = (fieldPerPx: number) => fieldPerPx / (0.5 * (1 / w + 1 / h));
  const glyphLarge = build(mod.BATCH_FRAG_SRC, slots, 1, scaleFor(0.1));
  // A run holding glyphs that small draws with the build that has the taps.
  const glyphSmall = build(mod.batchAreaFragSrc?.(false, false) ?? mod.BATCH_FRAG_SRC, slots, 1, scaleFor(0.5));
  const chain = build(chainSource(mod, 8), 8, 1);
  const matrices = build(mod.BATCH_MATRICES_FRAG_SRC, slots, mod.BATCH_MATRIX_SLOTS);
  return [
    variant('batch', tree, mod.packSlot(1, mod.PAINT_MODE_PLAIN)),
    variant('batch-chain8-1', chain, mod.packSlot(1, mod.PAINT_MODE_PLAIN)),
    variant('batch-chain8-7', chain, mod.packSlot(7, mod.PAINT_MODE_PLAIN)),
    variant('batch-glyph-large', glyphLarge, mod.packSlot(1, 1)),
    variant('batch-glyph-small', glyphSmall, mod.packSlot(1, 1)),
    variant('batch-8-matrices', matrices, mod.withMatrix(mod.packSlot(1, mod.PAINT_MODE_PLAIN), 3)),
  ];
}
