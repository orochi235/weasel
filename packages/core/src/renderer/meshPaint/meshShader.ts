/**
 * GLSL ES 3.0 sources for the mesh-gradient paint.
 *
 * The vertex stage is the pattern/gradient one: a path fill mesh carries
 * `a_position` only, so paint-space coordinates come back per fragment from
 * the screen position through `u_worldInv`. The fragment stage is a clamped
 * texture read of the baked mesh, with everything outside the bake's box
 * transparent — a mesh covers the area its patches cover, not the whole shape
 * it is filling, and a clamped read would otherwise smear its border colors
 * across the rest.
 *
 * `u_meshOrigin` / `u_meshSize` are the bake's box in paint space, and the
 * bake maps that box onto texel *centers*, which is the half-texel the uv
 * rescale accounts for.
 *
 * Output convention §2: PREMULTIPLIED alpha.
 */

/** The id this program is registered under. */
export const MESH_PROGRAM_ID = 'kit:mesh-gradient';

export const MESH_VERT_SRC = /* glsl */ `#version 300 es
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

export const MESH_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_world;
uniform sampler2D u_sampler;
uniform vec2  u_meshOrigin;
uniform vec2  u_meshSize;
uniform float u_opacity;
uniform float u_alpha;
out vec4 outColor;
void main() {
  vec2 t =(v_world - u_meshOrigin) / max(u_meshSize, vec2(0.0001));
  if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) {
    outColor = vec4(0.0);
    return;
  }
  vec2 texels = vec2(textureSize(u_sampler, 0));
  vec2 uv = (t * (texels - 1.0) + 0.5) / texels;
  vec4 texel = texture(u_sampler, uv);
  float a = texel.a * u_opacity * u_alpha;
  outColor = vec4(texel.rgb * a, a);
}
`;

export const MESH_UNIFORMS = [
  'u_proj', 'u_model', 'u_worldInv', 'u_sampler',
  'u_meshOrigin', 'u_meshSize', 'u_opacity', 'u_alpha',
] as const;

export const MESH_ATTRIBUTES = ['a_position'] as const;
