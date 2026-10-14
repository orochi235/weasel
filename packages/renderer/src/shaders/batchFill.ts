/**
 * GLSL ES 3.0 source for the batch program — the one shader a run of solid
 * geometry, image quads and glyphs shares.
 *
 * **Every vertex names the texture it samples.** `a_texSlot` is an index into
 * `u_samplers`, and slot 0 is always the 1x1 white texel, so a solid's
 * `texture() * a_vertexColor` is the vertex color exactly.
 *
 * **The fetch is unrolled because GLSL ES 3.0 will not index a sampler array
 * with a variable** — the index must be a constant expression. It is unrolled
 * as a tree, so any slot is four compares away. The coordinate it samples is a
 * varying computed before the branch, which is what keeps the implicit
 * derivatives well defined.
 *
 * **The glyph math runs on every fragment, glyph or not**, because a
 * derivative in non-uniform control flow is undefined and it has to be taken
 * before anything selects on the mode — see `GLYPH_COVERAGE_GLSL`.
 * `tests/perf/fill-rate.spec.ts` prices it.
 *
 * **A gradient is a textured quad off the ramp atlas.** A linear one needs no
 * mode: its ramp position is affine in position, so `a_uv` is (ramp position,
 * atlas row) and the plain path samples it. A radial or conic one carries the
 * gradient-space coordinate instead, with the row in `a_post`, and the
 * fragment takes a `length` or an `atan` of it behind a branch on the flat
 * mode. That branch carries the sample itself, not just the coordinate: a
 * fetch from a varying is one the hardware schedules ahead, and one from a
 * computed coordinate is not.
 *
 * **Mode and slot share one attribute**, as `slot + 16 * mode`, because every
 * extra float widens the buffer write for every rect and quad in the run, not
 * just for the glyphs that read it.
 *
 * **An image's texel is premultiplied, and nothing else's is.** The color
 * matrix wants straight color, so an image vertex says what it is with
 * `PAINT_MODE_IMAGE` and the fragment divides its alpha back out.
 *
 * `a_post` is the alpha factor applied *after* the color matrix. An image quad
 * puts its opacity there. Solid geometry leaves it at 1 and folds its own
 * alpha into `a_vertexColor`, which is only sound under an identity matrix;
 * the caller owns that condition. A glyph folds its alpha the same way and
 * has no use for the factor, so its `a_post` is the synthetic-bold shift on
 * the field's threshold instead: text faked bold shares a run with text that
 * is not, with no wider vertex.
 *
 * Inputs:
 *   a_position     vec2   screen-space x,y of the corner
 *   a_vertexColor  vec4   straight-alpha color; (1,1,1,1) on an image vertex
 *   a_uv           vec2   texture coordinate 0..1; the white texel for solids
 *   a_post         float  alpha factor applied after the color matrix; a glyph's bold shift
 *   a_texSlot      float  slot + 16 * paint mode; slot 0 is the white texel
 *
 * Output: PREMULTIPLIED alpha. Blend: `gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`.
 */

import { GLYPH_COVERAGE_GLSL } from '@weasel-js/font';
import { STRAIGHT_RGB_GLSL } from './straightRgb';

/**
 * Texture units the batch program samples, slot 0 being the white texel.
 *
 * Fixed rather than queried: 16 is the most fragment texture units WebGL2
 * guarantees, so it is available everywhere and no more is. A power of two,
 * which keeps `sampleTree` balanced.
 */
export const BATCH_TEXTURE_SLOTS = 16;

/** Slot every solid vertex carries — the white texel, bound by `flushBatch`. */
export const WHITE_SLOT = 0;

/** Paint mode for everything whose texel is a color rather than a field. */
export const PAINT_MODE_PLAIN = 0;

/**
 * Paint modes for the two gradients whose ramp position is not affine in
 * position. A vertex in these modes carries the *gradient-space coordinate*
 * in `a_uv` and its atlas row in `a_post`. A linear gradient uses
 * `PAINT_MODE_PLAIN`.
 *
 * They sit above the glyph modes (1 and 2), so `isGlyph` is a range rather than
 * a threshold.
 */
export const PAINT_MODE_RADIAL = 3;
export const PAINT_MODE_CONIC = 4;

/** Paint mode for an image quad, whose texel is premultiplied. Above the
 *  gradient modes, so `isGrad` is a range too. */
export const PAINT_MODE_IMAGE = 5;

/** 1 / 2π, which turns a conic gradient's angle into a ramp position. */
const INV_TAU = (1 / (2 * Math.PI)).toFixed(10);

/** Pack a texture slot and a paint mode into the one `a_texSlot` float. */
export function packSlot(slot: number, mode: number): number {
  return slot + BATCH_TEXTURE_SLOTS * mode;
}

/** The paint mode packed into an `a_texSlot` value — for the tests, which read
 *  a vertex back out of the buffer it was staged into. */
export function paintModeOf(packed: number): number {
  return Math.floor((packed + 0.5) / BATCH_TEXTURE_SLOTS);
}

/**
 * Where each batch attribute lives, pinned rather than left to the linker so
 * `glyphPaint`'s program can draw from the same VAO.
 */
export const BATCH_ATTRIBUTE_LOCATIONS = {
  a_position: 0, a_vertexColor: 1, a_uv: 2, a_post: 3, a_texSlot: 4,
} as const;

const L = BATCH_ATTRIBUTE_LOCATIONS;

/** The fetch for slots `lo` to `hi`, halving the range at each compare. */
function sampleTree(lo: number, hi: number, indent = '  '): string {
  if (lo === hi) return `${indent}return texture(u_samplers[${lo}], uv);`;
  const mid = (lo + hi + 1) >> 1;
  return [
    `${indent}if (slot < ${mid}) {`,
    sampleTree(lo, mid - 1, `${indent}  `),
    `${indent}} else {`,
    sampleTree(mid, hi, `${indent}  `),
    `${indent}}`,
  ].join('\n');
}

export const BATCH_VERT_SRC = /* glsl */ `#version 300 es
layout(location = ${L.a_position}) in vec2 a_position;
layout(location = ${L.a_vertexColor}) in vec4 a_vertexColor;
layout(location = ${L.a_uv}) in vec2 a_uv;
layout(location = ${L.a_post}) in float a_post;
layout(location = ${L.a_texSlot}) in float a_texSlot;
uniform mat3 u_proj;
uniform mat3 u_model;
out vec4 v_vertexColor;
out vec2 v_uv;
out float v_post;
flat out int v_texSlot;
flat out float v_paintMode;
void main() {
  vec3 screen = u_model * vec3(a_position, 1.0);
  vec3 clip = u_proj * vec3(screen.xy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_vertexColor = a_vertexColor;
  v_uv = a_uv;
  v_post = a_post;
  // slot + 16 * mode, unpacked — see the file header for why they share a float.
  int packed = int(a_texSlot + 0.5);
  v_texSlot = packed % ${BATCH_TEXTURE_SLOTS};
  v_paintMode = float(packed / ${BATCH_TEXTURE_SLOTS});
}
`;

export const BATCH_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec4 v_vertexColor;
in vec2 v_uv;
in float v_post;
flat in int v_texSlot;
flat in float v_paintMode;
uniform sampler2D u_samplers[${BATCH_TEXTURE_SLOTS}];
uniform vec4 u_color;
uniform float u_alpha;
uniform vec2 u_fieldScale[${BATCH_TEXTURE_SLOTS}];
uniform mat4 u_colorMatrix;
uniform vec4 u_colorBias;
out vec4 outColor;

vec4 sampleSlot(int slot, vec2 uv) {
${sampleTree(0, BATCH_TEXTURE_SLOTS - 1)}
  // Never reached: every slot returns above.
  return vec4(0.0);
}
${GLYPH_COVERAGE_GLSL}
${STRAIGHT_RGB_GLSL}
void main() {
  float isGrad = step(2.5, v_paintMode) * step(v_paintMode, ${PAINT_MODE_CONIC + 0.5});
  // A radial or conic vertex carries a gradient-space coordinate rather than a
  // texture coordinate, and its atlas row rather than an alpha. The sample is
  // split across the branch rather than the coordinate selected before it: an
  // arm that reads v_uv straight is a fetch the hardware can schedule against a
  // varying, and one reading a coordinate the shader computed is not. Selecting
  // the coordinate first and sampling once costs 29-54% of a fragment that is
  // not a gradient; splitting it is within the measurement's own spread of free
  // (tests/perf/fill-rate.spec.ts, teitou, 2026-10-05).
  //
  // Branching at all is safe here where it would not be around the glyph math:
  // v_paintMode is flat, so every fragment of a quad takes the same arm, and
  // nothing in either arm is a derivative.
  vec4 texel;
  if (isGrad > 0.5) {
    float t = v_paintMode > ${PAINT_MODE_CONIC - 0.5}
      ? fract(atan(v_uv.y, v_uv.x) * ${INV_TAU})
      : length(v_uv);
    texel = sampleSlot(v_texSlot, vec2(t, v_post));
  } else {
    texel = sampleSlot(v_texSlot, v_uv);
  }
  // At 0 the mix is the texel itself, so a solid still gets its color exactly.
  texel.rgb = mix(texel.rgb, straightRgb(texel), step(${PAINT_MODE_IMAGE - 0.5}, v_paintMode));
  float isGlyph = step(0.5, v_paintMode) * step(v_paintMode, 2.5);
  // Unconditional, and multiplied out afterwards rather than branched around:
  // see the file header. A glyph's a_post is its synthetic-bold shift.
  float coverage = glyphCoverage(texel, v_paintMode, v_post * isGlyph, v_uv, u_fieldScale[v_texSlot]);
  // A glyph's texel is a distance field, so it takes no part in the color; a
  // plain vertex multiplies its texel in as it always did.
  vec4 src = mix(texel, vec4(1.0), isGlyph) * u_color * v_vertexColor;
  vec4 mapped = clamp(u_colorMatrix * src + u_colorBias, 0.0, 1.0);
  float a = mapped.a * u_alpha * mix(v_post, 1.0, max(isGrad, isGlyph)) * mix(1.0, coverage, isGlyph);
  outColor = vec4(mapped.rgb * a, a);
}
`;

export const BATCH_FILL_UNIFORMS = [
  'u_proj', 'u_model', 'u_samplers', 'u_color', 'u_alpha', 'u_fieldScale',
  'u_colorMatrix', 'u_colorBias',
] as const;

export const BATCH_FILL_ATTRIBUTES = [
  'a_position', 'a_vertexColor', 'a_uv', 'a_post', 'a_texSlot',
] as const;
