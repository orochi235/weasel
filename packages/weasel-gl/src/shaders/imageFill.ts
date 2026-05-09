/**
 * GLSL ES 3.0 sources for the image / pattern fill shader.
 *
 * Inputs:
 *   a_position  vec2   screen-space x,y of the quad corner
 *   a_uv        vec2   texture coordinate 0..1
 *
 * Uniforms:
 *   u_proj      mat3        screen → clip projection
 *   u_model     mat3        cumulative group transform
 *   u_sampler   sampler2D   image texture (TEXTURE0)
 *   u_opacity   float       overall opacity, 0..1
 *   u_alpha     float       group alpha, 0..1
 *
 * Output convention §2: PREMULTIPLIED alpha — `vec4(rgb * a, a)`.
 * Pattern fills reuse this shader; wrapping is baked into the texture state.
 */

export const IMAGE_VERT_SRC = /* glsl */ `#version 300 es
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

export const IMAGE_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_sampler;
uniform float u_opacity;
uniform float u_alpha;
out vec4 outColor;
void main() {
  vec4 texel = texture(u_sampler, v_uv);
  float a = texel.a * u_opacity * u_alpha;
  outColor = vec4(texel.rgb * a, a);
}
`;

export const IMAGE_FILL_UNIFORMS = [
  'u_proj', 'u_model', 'u_sampler', 'u_opacity', 'u_alpha',
] as const;

export const IMAGE_FILL_ATTRIBUTES = ['a_position', 'a_uv'] as const;
