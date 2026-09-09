/**
 * GLSL ES 3.0 source for the batch program — the one shader a run of solid
 * geometry and image quads shares.
 *
 * **Solid vertices sample too.** They carry the UV of a 1x1 white texel, so
 * `texture() * a_vertexColor` is the vertex color exactly, and the shader needs
 * no branch. A branch would have to be either non-uniform control flow around a
 * `texture()` call or an unconditional fetch anyway; this is the unconditional
 * fetch with the multiply doing the selecting, and it is what lets one run hold
 * a wall's ground rects and its atlas quads without a flush between every pair.
 *
 * The multiply is exact: an 8-bit white texel samples to 1.0, and 1.0 * x is x.
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
 *
 * Output: PREMULTIPLIED alpha. Blend: `gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`.
 */

export const BATCH_VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
in vec4 a_vertexColor;
in vec2 a_uv;
in float a_post;
uniform mat3 u_proj;
uniform mat3 u_model;
out vec4 v_vertexColor;
out vec2 v_uv;
out float v_post;
void main() {
  vec3 screen = u_model * vec3(a_position, 1.0);
  vec3 clip = u_proj * vec3(screen.xy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_vertexColor = a_vertexColor;
  v_uv = a_uv;
  v_post = a_post;
}
`;

export const BATCH_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec4 v_vertexColor;
in vec2 v_uv;
in float v_post;
uniform sampler2D u_sampler;
uniform vec4 u_color;
uniform float u_alpha;
uniform mat4 u_colorMatrix;
uniform vec4 u_colorBias;
out vec4 outColor;
void main() {
  vec4 src = texture(u_sampler, v_uv) * u_color * v_vertexColor;
  vec4 mapped = clamp(u_colorMatrix * src + u_colorBias, 0.0, 1.0);
  float a = mapped.a * u_alpha * v_post;
  outColor = vec4(mapped.rgb * a, a);
}
`;

export const BATCH_FILL_UNIFORMS = [
  'u_proj', 'u_model', 'u_sampler', 'u_color', 'u_alpha',
  'u_colorMatrix', 'u_colorBias',
] as const;

export const BATCH_FILL_ATTRIBUTES = [
  'a_position', 'a_vertexColor', 'a_uv', 'a_post',
] as const;
