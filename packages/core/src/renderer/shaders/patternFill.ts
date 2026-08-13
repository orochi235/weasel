/**
 * GLSL ES 3.0 sources for pattern-fill paths.
 *
 * The vertex stage is `gradFill`'s: a path fill mesh carries `a_position`
 * only, so paint-space coordinates are recovered per fragment from the
 * screen position via `u_worldInv` rather than read from a UV attribute.
 * `u_tileSize` then converts those coordinates to texture space, and
 * `REPEAT` wrapping (set at upload) tiles the result.
 *
 * Output convention §2: PREMULTIPLIED alpha.
 */

export const PATTERN_VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
uniform mat3 u_proj;
uniform mat3 u_model;
uniform mat3 u_worldInv;
out vec2 v_world;
void main() {
  vec3 screen = u_model * vec3(a_position, 1.0);
  vec3 clip   = u_proj  * vec3(screen.xy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  vec3 world = u_worldInv * vec3(screen.xy, 1.0);
  v_world = world.xy;
}
`;

export const PATTERN_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_world;
uniform sampler2D u_sampler;
uniform vec2  u_tileOrigin;
uniform vec2  u_tileSize;
uniform float u_opacity;
uniform float u_alpha;
uniform mat4  u_colorMatrix;
uniform vec4  u_colorBias;
out vec4 outColor;
void main() {
  vec2 uv = (v_world - u_tileOrigin) / max(u_tileSize, vec2(0.0001));
  vec4 texel = texture(u_sampler, uv);
  vec4 mapped = clamp(u_colorMatrix * texel + u_colorBias, 0.0, 1.0);
  float a = mapped.a * u_opacity * u_alpha;
  outColor = vec4(mapped.rgb * a, a);
}
`;

export const PATTERN_FILL_UNIFORMS = [
  'u_proj', 'u_model', 'u_worldInv', 'u_sampler',
  'u_tileOrigin', 'u_tileSize', 'u_opacity', 'u_alpha',
  'u_colorMatrix', 'u_colorBias',
] as const;

export const PATTERN_FILL_ATTRIBUTES = ['a_position'] as const;
