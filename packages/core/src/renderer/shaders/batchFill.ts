/**
 * GLSL ES 3.0 source for the batch program — the one shader a run of solid
 * geometry, image quads and glyphs shares.
 *
 * **Every vertex names the texture it samples.** `a_texSlot` is an index into
 * `u_samplers`, and slot 0 is always the 1x1 white texel, so a solid's
 * `texture() * a_vertexColor` is the vertex color exactly. The multiply is
 * exact: an 8-bit white texel samples to 1.0, and 1.0 * x is x.
 *
 * The slot is per vertex rather than per flush because the run holds several
 * textures at once. Reserving slot 0 for white is what makes a solid's promise
 * true no matter what else joins its run: before this, a solid carried the
 * white texel's UV but the flush bound the run's *image*, so every ground rect
 * beside an atlas quad came out multiplied by whatever texel sat at the middle
 * of that atlas. A wall of white grounds drew olive.
 *
 * **The chain is unrolled because GLSL ES 3.0 will not index a sampler array
 * with a variable** — the index must be a constant expression, so `if (i == 0)
 * … if (i == 1) …` over constants is the only legal form. `v_texSlot` is
 * constant across a primitive, so the branch is uniform within any one
 * triangle; the coordinate it samples is a varying computed before the branch,
 * which is what keeps the implicit derivatives well defined.
 *
 * **The paint mode rides in `a_texSlot`, and the glyph math runs either way.**
 * A glyph vertex names a font atlas whose texel is a distance field rather than
 * a color, so its coverage comes from `glyphCoverage` and its color comes from
 * the vertex alone. That coverage is computed on every fragment, glyph or not,
 * because `fwidth` in non-uniform control flow is undefined and the derivative
 * has to be taken before anything selects on the mode — see
 * `GLYPH_COVERAGE_GLSL`. Priced head to head at 432M fragments a frame
 * (`tests/perf/fill-rate.spec.ts`), that costs about 1.4% of a fragment that is
 * not a glyph.
 *
 * **Mode and slot share one attribute because the vertex is the thing that
 * costs.** Both are small enumerations, so `slot + 8 * mode` packs them with
 * room to spare. Carrying the mode as a float of its own instead measures 9%
 * slower at the densest rung of `tests/perf/atlas-wall.spec.ts` — 1.78 ms
 * against 1.63 for 7,500 commands, taken ABBA in one sitting — because the
 * whole batch exists to make one buffer write a frame cheap, and every extra
 * float widens that write for every rect and quad in the run, not just for the
 * glyphs that read it.
 *
 * `a_post` is the alpha factor applied *after* the color matrix. An image quad
 * puts its opacity there, where `u_opacity` used to be — the fold is exact for
 * the same reason the old image shader's was, the matrix cannot see it. Solid
 * geometry and glyphs leave it at 1 and fold their own alpha into
 * `a_vertexColor`, which is only sound under an identity matrix; `draw.ts` owns
 * that condition.
 *
 * Inputs:
 *   a_position     vec2   screen-space x,y of the corner
 *   a_vertexColor  vec4   straight-alpha color; (1,1,1,1) on an image vertex
 *   a_uv           vec2   texture coordinate 0..1; the white texel for solids
 *   a_post         float  alpha factor applied after the color matrix
 *   a_texSlot      float  slot + 8 * paint mode; slot 0 is the white texel
 *
 * Output: PREMULTIPLIED alpha. Blend: `gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`.
 */

import { GLYPH_COVERAGE_GLSL } from '@weasel-js/font';

/**
 * Texture units the batch program samples, slot 0 being the white texel.
 *
 * Fixed rather than queried: WebGL2 guarantees at least 16 fragment texture
 * units, so 8 is available everywhere without asking, and asking would mean a
 * `getParameter` the GL recorder answers with a recording function rather than
 * a number. Seven textures in one run is what "a document with a handful of
 * distinct images, and a font or two" needs; past that the run breaks as it
 * always did, and every extra slot is another compare in the fragment chain.
 */
export const BATCH_TEXTURE_SLOTS = 8;

/** Slot every solid vertex carries — the white texel, bound by `flushBatch`. */
export const WHITE_SLOT = 0;

/** Paint mode for everything whose texel is a color rather than a field. */
export const PAINT_MODE_PLAIN = 0;

/** Pack a texture slot and a paint mode into the one `a_texSlot` float. */
export function packSlot(slot: number, mode: number): number {
  return slot + BATCH_TEXTURE_SLOTS * mode;
}

/** The paint mode packed into an `a_texSlot` value — for the tests, which read
 *  a vertex back out of the buffer it was staged into. */
export function paintModeOf(packed: number): number {
  return Math.floor((packed + 0.5) / BATCH_TEXTURE_SLOTS);
}

function sampleChain(slots: number): string {
  const arms: string[] = [];
  for (let i = 1; i < slots; i++) {
    arms.push(`  if (slot == ${i}) return texture(u_samplers[${i}], uv);`);
  }
  return arms.join('\n');
}

export const BATCH_VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
in vec4 a_vertexColor;
in vec2 a_uv;
in float a_post;
in float a_texSlot;
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
  // slot + 8 * mode, unpacked — see the file header for why they share a float.
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
uniform float u_synthBold;
uniform mat4 u_colorMatrix;
uniform vec4 u_colorBias;
out vec4 outColor;

vec4 sampleSlot(int slot, vec2 uv) {
${sampleChain(BATCH_TEXTURE_SLOTS)}
  return texture(u_samplers[0], uv);
}
${GLYPH_COVERAGE_GLSL}
void main() {
  vec4 texel = sampleSlot(v_texSlot, v_uv);
  float isGlyph = step(0.5, v_paintMode);
  // Unconditional, and multiplied out afterwards rather than branched around:
  // see the file header.
  float coverage = glyphCoverage(texel, v_paintMode, u_synthBold);
  // A glyph's texel is a distance field, so it takes no part in the color; a
  // plain vertex multiplies its texel in as it always did.
  vec4 src = mix(texel, vec4(1.0), isGlyph) * u_color * v_vertexColor;
  vec4 mapped = clamp(u_colorMatrix * src + u_colorBias, 0.0, 1.0);
  float a = mapped.a * u_alpha * v_post * mix(1.0, coverage, isGlyph);
  outColor = vec4(mapped.rgb * a, a);
}
`;

export const BATCH_FILL_UNIFORMS = [
  'u_proj', 'u_model', 'u_samplers', 'u_color', 'u_alpha', 'u_synthBold',
  'u_colorMatrix', 'u_colorBias',
] as const;

export const BATCH_FILL_ATTRIBUTES = [
  'a_position', 'a_vertexColor', 'a_uv', 'a_post', 'a_texSlot',
] as const;
