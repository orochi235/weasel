/**
 * GLSL ES 3.0 sources for the built-in MSDF text shader.
 *
 * Vertex inputs (interleaved, stride 16 bytes = 4 × float):
 *   a_position  vec2   screen-space x,y of the glyph quad vertex
 *   a_uv        vec2   atlas UV (0..1)
 *
 * Uniforms:
 *   u_proj         mat3        screen → clip projection
 *   u_model        mat3        cumulative group transform
 *   u_atlas        sampler2D   the MSDF atlas texture (bound to TEXTURE0)
 *   u_color        vec4        text color (straight RGBA)
 *   u_alpha        float       group alpha multiplier
 *   u_aaWidth      float       smoothstep half-width for AA (default 0.05)
 *   u_colorMatrix  mat4        color transform applied to u_color before alpha modulation
 *   u_colorBias    vec4        bias added after the matrix (identity = zero bias)
 *
 * Output: PREMULTIPLIED alpha — `vec4(color.rgb * a, a)` per conventions §2.
 * Blend func: ONE / ONE_MINUS_SRC_ALPHA.
 *
 * MSDF channel layout: msdf-bmfont-xml outputs R,G,B channels as independent
 * signed-distance fields covering different edge directions. The true SDF
 * value is the median of R,G,B; this recovers sharp outlines while averaging
 * out single-channel aliasing artifacts.
 */

export const TEXT_VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
in vec2 a_uv;
uniform mat3 u_proj;
uniform mat3 u_model;
out vec2 v_uv;
void main() {
  vec3 screen = u_model * vec3(a_position, 1.0);
  vec3 clip   = u_proj  * vec3(screen.xy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_uv = a_uv;
}
`;

export const TEXT_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_atlas;
uniform vec4 u_color;
uniform float u_alpha;
uniform float u_aaWidth;
uniform mat4 u_colorMatrix;
uniform vec4 u_colorBias;
out vec4 outColor;

float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

void main() {
  vec3 sdf = texture(u_atlas, v_uv).rgb;
  float sdfVal = median(sdf.r, sdf.g, sdf.b);
  float aaW = u_aaWidth > 0.0 ? u_aaWidth : 0.05;
  float msdfAlpha = smoothstep(0.5 - aaW, 0.5 + aaW, sdfVal);
  vec4 src = vec4(u_color.rgb, u_color.a);
  vec4 mapped = clamp(u_colorMatrix * src + u_colorBias, 0.0, 1.0);
  float a = mapped.a * msdfAlpha * u_alpha;
  outColor = vec4(mapped.rgb * a, a);
}
`;

export const TEXT_SDF_UNIFORMS = [
  'u_proj', 'u_model', 'u_atlas', 'u_color', 'u_alpha', 'u_aaWidth',
  'u_colorMatrix', 'u_colorBias',
] as const;

export const TEXT_SDF_ATTRIBUTES = ['a_position', 'a_uv'] as const;
