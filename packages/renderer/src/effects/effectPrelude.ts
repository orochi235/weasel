/**
 * Kit-supplied vertex shader for a full-screen effect pass.
 *
 * Distinct from `CUSTOM_VERT_SRC` on purpose. That one's `v_uv` runs top-down
 * in *screen* space; an effect samples a texture the scene was just rendered
 * into, whose v axis runs the other way.
 *
 * PUBLIC CONTRACT — what every effect fragment shader may read:
 *
 *   in  vec2      v_uv           0..1 across the source texture
 *   uniform sampler2D u_source   what has been drawn so far
 *   uniform vec2  u_resolution   source size in device pixels
 *   uniform vec2  u_texel        1.0 / u_resolution — one texel step
 *
 * PREMULTIPLIED ALPHA: `u_source` holds premultiplied RGBA. An effect that
 * weights neighboring samples (a blur) is doing the right thing on
 * premultiplied values; one that manipulates rgb against a must premultiply
 * its own output.
 */
export const EFFECT_VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
in vec2 a_uv;
out vec2 v_uv;

void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/** Attribute names the effect vertex shader binds. Same layout as the custom
 *  prelude's, so `QUAD_VERTICES` serves both. */
export const EFFECT_ATTRIBUTES = ['a_position', 'a_uv'] as const;

/** Uniforms the renderer sets on every effect pass. An effect must not
 *  redeclare them with different meanings; it may leave any of them out. */
export const EFFECT_KIT_UNIFORMS = ['u_source', 'u_resolution', 'u_texel'] as const;

/** The pass that puts a group's finished texture back into its parent.
 *  `u_alpha` and the color matrix are applied here rather than inside the
 *  offscreen render, so an effect samples the group's own pixels rather than
 *  pixels already faded. */
export const COMPOSITE_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform float u_alpha;
uniform mat4 u_colorMatrix;
uniform vec4 u_colorBias;
out vec4 outColor;

void main() {
  vec4 src = texture(u_source, v_uv);
  // Undo premultiplication before the colour matrix, which is defined on
  // straight alpha, then put it back for the blend.
  float a = src.a;
  vec3 rgb = a > 0.0 ? src.rgb / a : vec3(0.0);
  vec4 c = u_colorMatrix * vec4(rgb, a) + u_colorBias;
  c.a *= u_alpha;
  outColor = vec4(clamp(c.rgb, 0.0, 1.0) * c.a, c.a);
}
`;
