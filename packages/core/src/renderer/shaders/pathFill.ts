/**
 * GLSL ES 3.0 sources for the built-in solid-fill path shader.
 *
 * Two variants:
 *   - Flat: VERT_SRC + FRAG_SRC, uses uniform color only.
 *   - VColor: VCOLOR_VERT_SRC + VCOLOR_FRAG_SRC, multiplies a per-vertex
 *     `a_vertexColor` attribute with `u_color`.
 *
 * Both variants take `u_colorMatrix` (mat4) + `u_colorBias` (vec4); the
 * color transform is applied to the straight-alpha SRC color BEFORE
 * premultiplication. Identity matrix + zero bias = pass-through.
 *
 * Output (both variants): PREMULTIPLIED alpha.
 * Blend: caller sets `gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`.
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
uniform mat4 u_colorMatrix;
uniform vec4 u_colorBias;
out vec4 outColor;
void main() {
  vec4 mapped = clamp(u_colorMatrix * u_color + u_colorBias, 0.0, 1.0);
  float a = mapped.a * u_alpha;
  outColor = vec4(mapped.rgb * a, a);
}
`;

export const VCOLOR_VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
in vec4 a_vertexColor;
uniform mat3 u_proj;
uniform mat3 u_model;
out vec4 v_vertexColor;
void main() {
  vec3 screen = u_model * vec3(a_position, 1.0);
  vec3 clip = u_proj * vec3(screen.xy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_vertexColor = a_vertexColor;
}
`;

export const VCOLOR_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec4 v_vertexColor;
uniform vec4 u_color;
uniform float u_alpha;
uniform mat4 u_colorMatrix;
uniform vec4 u_colorBias;
out vec4 outColor;
void main() {
  vec4 src = u_color * v_vertexColor;
  vec4 mapped = clamp(u_colorMatrix * src + u_colorBias, 0.0, 1.0);
  float a = mapped.a * u_alpha;
  outColor = vec4(mapped.rgb * a, a);
}
`;

/** Uniforms shared between flat and vertex-color variants. */
export const PATH_FILL_UNIFORMS = [
  'u_proj', 'u_model', 'u_color', 'u_alpha',
  'u_colorMatrix', 'u_colorBias',
] as const;

/** Attributes for the flat variant. */
export const PATH_FILL_ATTRIBUTES = ['a_position'] as const;

/** Attributes for the vertex-color variant. */
export const PATH_FILL_VCOLOR_ATTRIBUTES = ['a_position', 'a_vertexColor'] as const;
