/**
 * GLSL ES 3.0 sources for the built-in solid-fill path shader.
 *
 * Inputs:
 *   - a_position  vec2     path-local vertex coords
 * Uniforms:
 *   - u_proj      mat3     screen → clip projection
 *   - u_model     mat3     path-local → screen (group-transform stack composed)
 *   - u_color     vec4     RGBA, 0..1 components, straight (non-premultiplied) alpha
 *   - u_alpha     float    group-alpha multiplier, 0..1
 *
 * Output: vec4 outColor with PREMULTIPLIED alpha — `u_color.rgb * a, a` where
 * `a = u_color.a * u_alpha`. Browsers default `getContext('webgl2')` to
 * `premultipliedAlpha: true`, so the browser composites the canvas over the
 * page expecting premultiplied pixels. Outputting straight-alpha here causes
 * the browser composition to over-brighten translucent fills (RGB > alpha is
 * undefined for premultiplied input).
 *
 * Blend: caller (renderer) sets `gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA)` to
 * match the premultiplied output.
 */

export const VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
uniform mat3 u_proj;
uniform mat3 u_model;
void main() {
  vec3 screen = u_model * vec3(a_position, 1.0);
  vec3 clip = u_proj * vec3(screen.xy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
`;

export const FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
uniform vec4 u_color;
uniform float u_alpha;
out vec4 outColor;
void main() {
  float a = u_color.a * u_alpha;
  outColor = vec4(u_color.rgb * a, a);
}
`;

/** Names of uniforms the renderer must look up after compile. */
export const PATH_FILL_UNIFORMS = ['u_proj', 'u_model', 'u_color', 'u_alpha'] as const;

/** Names of attributes the renderer must look up after compile. */
export const PATH_FILL_ATTRIBUTES = ['a_position'] as const;
