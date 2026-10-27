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
 * computed coordinate is not. The ramp atlas always sits at `RAMP_SLOT`, so
 * that arm is one fetch rather than a second copy of the slot tree, which
 * cost a software rasterizer (SwiftShader) about a third of the program's
 * build.
 *
 * **Mode, slot, matrix and hull share one attribute**, as `slot + 16 * mode +
 * 128 * matrix + 1024 * hull`, because every extra float widens the buffer
 * write for every rect and quad in the run, not just for the vertices that
 * read it. `hull` is 0 for a vertex under no convex clip the shader decides
 * (`batchHull.ts`), and otherwise names the planes it is tested against.
 *
 * **Every vertex names the color matrix it is mapped by**, as an index into
 * `u_colorMatrix`, `u_colorBias`, and `u_alpha`. A solid's color and a glyph's
 * are mapped before they are staged, so they name an identity entry; a texel
 * is not known until it is sampled, so a gradient or an image under a group's
 * matrix names that matrix, and shares the draw with whatever is around it.
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
 *   a_texSlot      float  slot + 16 * mode + 128 * matrix + 1024 * hull; slot 0 is the white texel
 *
 * Output: PREMULTIPLIED alpha. Blend: `gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`.
 */

import { GLYPH_COVERAGE_GLSL } from '@weasel-js/font';
import { STRAIGHT_RGB_GLSL } from './straightRgb';
import { HULL_COVERAGE_GLSL } from './hullCoverage';
import { HULL_PLANES } from '../batchHull';

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

/** Slot the ramp atlas takes in every run that samples it. The others fill
 *  from slot 1 up, so it is the last one any of them reaches. */
export const RAMP_SLOT = BATCH_TEXTURE_SLOTS - 1;

/**
 * Color matrices, each with a group alpha, that one run can draw under. A
 * vertex names its own, so a run breaks on a matrix only when it would be one
 * more than this.
 */
export const BATCH_MATRIX_SLOTS = 8;

/** Room for the paint modes in the packed attribute; they run 0 to 5. */
const PAINT_MODES = 8;
const MATRIX_STRIDE = BATCH_TEXTURE_SLOTS * PAINT_MODES;
const HULL_STRIDE = MATRIX_STRIDE * BATCH_MATRIX_SLOTS;

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

/**
 * Pack a texture slot and a paint mode into the one `a_texSlot` float. The
 * sum is all there is to it, so a `slot` that already carries a matrix index
 * (`withMatrix`) keeps it.
 */
export function packSlot(slot: number, mode: number): number {
  return slot + BATCH_TEXTURE_SLOTS * mode;
}

/** `slot` naming entry `matrix` of the run's color matrices as well. */
export function withMatrix(slot: number, matrix: number): number {
  return slot + MATRIX_STRIDE * matrix;
}

/** `slot` naming the `count` hull planes from `start` in the run's pool as
 *  well. */
export function withHull(slot: number, start: number, count: number): number {
  return slot + HULL_STRIDE * (1 + start * HULL_PLANES + count - 1);
}

/** The hull planes an `a_texSlot` value names, as `[start, count]`; a count
 *  of 0 is no hull. For the tests. */
export function hullOf(packed: number): [number, number] {
  const h = Math.floor((packed + 0.5) / HULL_STRIDE);
  return h === 0 ? [0, 0] : [Math.floor((h - 1) / HULL_PLANES), ((h - 1) % HULL_PLANES) + 1];
}

/** The paint mode packed into an `a_texSlot` value — for the tests, which read
 *  a vertex back out of the buffer it was staged into. */
export function paintModeOf(packed: number): number {
  return Math.floor((packed + 0.5) / BATCH_TEXTURE_SLOTS) % PAINT_MODES;
}

/** The matrix index packed into an `a_texSlot` value, for the same tests. */
export function matrixOf(packed: number): number {
  return Math.floor((packed + 0.5) / MATRIX_STRIDE) % BATCH_MATRIX_SLOTS;
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
flat out int v_matrix;
flat out int v_hullStart;
flat out int v_hullCount;
void main() {
  vec3 screen = u_model * vec3(a_position, 1.0);
  vec3 clip = u_proj * vec3(screen.xy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_vertexColor = a_vertexColor;
  v_uv = a_uv;
  v_post = a_post;
  // slot + 16 * mode + 128 * matrix + 1024 * hull, unpacked — see the file
  // header for why they share a float.
  int packed = int(a_texSlot + 0.5);
  v_texSlot = packed % ${BATCH_TEXTURE_SLOTS};
  v_paintMode = float((packed / ${BATCH_TEXTURE_SLOTS}) % ${PAINT_MODES});
  v_matrix = (packed / ${MATRIX_STRIDE}) % ${BATCH_MATRIX_SLOTS};
  int hull = packed / ${HULL_STRIDE};
  v_hullStart = hull == 0 ? 0 : (hull - 1) / ${HULL_PLANES};
  v_hullCount = hull == 0 ? 0 : (hull - 1) % ${HULL_PLANES} + 1;
}
`;

/**
 * The fragment stage for runs under `matrices` color matrices. Under one, every
 * vertex names entry 0, so the default program indexes it as a constant: a
 * software rasterizer (SwiftShader) took about a quarter of the program's
 * build to index the arrays by a varying. `hulls` builds in the hull clip, for
 * runs that hold one.
 */
function batchFragSrc(matrices: number, hulls = false): string {
  const m = matrices === 1 ? '0' : 'v_matrix';
  return /* glsl */ `#version 300 es
precision highp float;
${hulls ? 'precision highp int;' : ''}
in vec4 v_vertexColor;
in vec2 v_uv;
in float v_post;
flat in int v_texSlot;
flat in float v_paintMode;
flat in int v_matrix;
uniform sampler2D u_samplers[${BATCH_TEXTURE_SLOTS}];
uniform vec4 u_color;
uniform float u_alpha[${matrices}];
uniform vec2 u_fieldScale[${BATCH_TEXTURE_SLOTS}];
uniform mat4 u_colorMatrix[${matrices}];
uniform vec4 u_colorBias[${matrices}];
out vec4 outColor;

vec4 sampleSlot(int slot, vec2 uv) {
${sampleTree(0, BATCH_TEXTURE_SLOTS - 1)}
  // Never reached: every slot returns above.
  return vec4(0.0);
}
${GLYPH_COVERAGE_GLSL}
${STRAIGHT_RGB_GLSL}
${hulls ? HULL_COVERAGE_GLSL : ''}
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
    texel = texture(u_samplers[${RAMP_SLOT}], vec2(t, v_post));
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
  vec4 mapped = clamp(u_colorMatrix[${m}] * src + u_colorBias[${m}], 0.0, 1.0);
  float a = mapped.a * u_alpha[${m}] * mix(v_post, 1.0, max(isGrad, isGlyph)) * mix(1.0, coverage, isGlyph)${hulls ? ' * hullCoverage()' : ''};
  outColor = vec4(mapped.rgb * a, a);
}
`;
}

/** The batch program's fragment stage for a run under one color matrix — nearly
 *  every run. */
export const BATCH_FRAG_SRC = batchFragSrc(1);

/** The same for a run under up to `BATCH_MATRIX_SLOTS`, built the first time
 *  one is drawn. */
export const BATCH_MATRICES_FRAG_SRC = batchFragSrc(BATCH_MATRIX_SLOTS);

/** The two again with the hull clip built in, each built the first time a run
 *  holding a hull needs it. */
export const BATCH_HULL_FRAG_SRC = batchFragSrc(1, true);
export const BATCH_MATRICES_HULL_FRAG_SRC = batchFragSrc(BATCH_MATRIX_SLOTS, true);

export const BATCH_FILL_UNIFORMS = [
  'u_proj', 'u_model', 'u_samplers', 'u_color', 'u_alpha', 'u_fieldScale',
  'u_colorMatrix', 'u_colorBias',
] as const;

export const BATCH_HULL_UNIFORMS = [...BATCH_FILL_UNIFORMS, 'u_hullPlanes'] as const;

export const BATCH_FILL_ATTRIBUTES = [
  'a_position', 'a_vertexColor', 'a_uv', 'a_post', 'a_texSlot',
] as const;
