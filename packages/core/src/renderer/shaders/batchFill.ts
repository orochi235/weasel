/**
 * GLSL ES 3.0 source for the batch program — the one shader a run of solid
 * geometry and image quads shares.
 *
 * **Every vertex names the texture it samples.** `a_texSlot` is an index into
 * `u_samplers`, and slot 0 is always the 1x1 white texel, so a solid's
 * `texture() * a_vertexColor` is the vertex color exactly. The multiply is
 * exact: an 8-bit white texel samples to 1.0, and 1.0 * x is x.
 *
 * The slot is per vertex rather than per flush because the run holds several
 * bitmaps at once. Reserving slot 0 for white is what makes a solid's promise
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
 * `a_post` is the alpha factor applied *after* the color matrix. An image quad
 * puts its opacity there, where `u_opacity` used to be — the fold is exact for
 * the same reason the old image shader's was, the matrix cannot see it. Solid
 * geometry leaves it at 1 and folds its own alpha into `a_vertexColor`, which
 * is only sound under an identity matrix; `draw.ts` owns that condition.
 *
 * Inputs:
 *   a_position     vec2   screen-space x,y of the corner
 *   a_vertexColor  vec4   straight-alpha color; (1,1,1,1) on a textured vertex
 *   a_uv           vec2   texture coordinate 0..1; the white texel for solids
 *   a_post         float  alpha factor applied after the color matrix
 *   a_texSlot      float  index into u_samplers; 0 is the white texel
 *
 * Output: PREMULTIPLIED alpha. Blend: `gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`.
 */

/**
 * Texture units the batch program samples, slot 0 being the white texel.
 *
 * Fixed rather than queried: WebGL2 guarantees at least 16 fragment texture
 * units, so 8 is available everywhere without asking, and asking would mean a
 * `getParameter` the GL recorder answers with a recording function rather than
 * a number. Seven bitmaps in one run is what "a document with a handful of
 * distinct images" needs; past that the run breaks as it always did, and every
 * extra slot is another compare in the fragment chain.
 */
export const BATCH_TEXTURE_SLOTS = 8;

/** Slot every solid vertex carries — the white texel, bound by `flushBatch`. */
export const WHITE_SLOT = 0;

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
void main() {
  vec3 screen = u_model * vec3(a_position, 1.0);
  vec3 clip = u_proj * vec3(screen.xy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_vertexColor = a_vertexColor;
  v_uv = a_uv;
  v_post = a_post;
  v_texSlot = int(a_texSlot + 0.5);
}
`;

export const BATCH_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec4 v_vertexColor;
in vec2 v_uv;
in float v_post;
flat in int v_texSlot;
uniform sampler2D u_samplers[${BATCH_TEXTURE_SLOTS}];
uniform vec4 u_color;
uniform float u_alpha;
uniform mat4 u_colorMatrix;
uniform vec4 u_colorBias;
out vec4 outColor;

vec4 sampleSlot(int slot, vec2 uv) {
${sampleChain(BATCH_TEXTURE_SLOTS)}
  return texture(u_samplers[0], uv);
}

void main() {
  vec4 src = sampleSlot(v_texSlot, v_uv) * u_color * v_vertexColor;
  vec4 mapped = clamp(u_colorMatrix * src + u_colorBias, 0.0, 1.0);
  float a = mapped.a * u_alpha * v_post;
  outColor = vec4(mapped.rgb * a, a);
}
`;

export const BATCH_FILL_UNIFORMS = [
  'u_proj', 'u_model', 'u_samplers', 'u_color', 'u_alpha',
  'u_colorMatrix', 'u_colorBias',
] as const;

export const BATCH_FILL_ATTRIBUTES = [
  'a_position', 'a_vertexColor', 'a_uv', 'a_post', 'a_texSlot',
] as const;
