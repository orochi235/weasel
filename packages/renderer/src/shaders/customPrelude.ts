/**
 * Kit-supplied vertex shader for kind:'shader' DrawCommands.
 *
 * Consumers write only fragment shaders. The vertex shader is fixed:
 * it generates a quad covering the DrawCommand's `bounds` rect and
 * exposes three varyings the fragment shader can consume.
 *
 * PUBLIC CONTRACT (varyings and kit uniforms):
 *
 *   in vec2  a_position   -1..1 NDC quad (set by the kit)
 *   in vec2  a_uv         0..1 across the bounds rect
 *
 *   uniform vec4 u_bounds  x, y, w, h in screen-space CSS pixels (set by kit)
 *   uniform mat3 u_view    weasel View matrix, world→screen (set by kit)
 *   uniform mat3 u_proj    screen→clip projection (internal, not documented)
 *
 *   out vec2 v_uv          0..1 across the bounds rect (top-left origin)
 *   out vec2 v_screen      screen-space pixel coordinate of this fragment
 *   out vec2 v_world       world-space coordinate: u_worldOrigin + v_worldLocal
 *   out vec2 v_worldLocal  world-space coordinate measured from u_worldOrigin
 *
 *   uniform vec2 u_worldOrigin  a world point near the bounds, set by kit; zero
 *                               near the origin. Far from it v_world is as coarse
 *                               as any float32 that size, and v_worldLocal is not:
 *                               a periodic pattern reads
 *                               mod(u_worldOrigin, P) + v_worldLocal.
 *
 *   uniform vec2 u_fragOrigin  declared by a fragment shader reading
 *                              gl_FragCoord, set by kit (see registerProgram)
 */

/**
 * Kit-supplied vertex shader source for custom programs.
 *
 * @remarks
 * **PREMULTIPLIED ALPHA:** Your fragment shader MUST output `vec4(rgb * a, a)`,
 * not `vec4(rgb, a)`. The canvas is composited with premultipliedAlpha:true;
 * straight-alpha output causes over-bright rendering for any fragment with a < 1.
 */
export const CUSTOM_VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
in vec2 a_uv;
uniform vec4 u_bounds;
uniform mat3 u_view;
uniform mat3 u_proj;
uniform mat3 u_screenToLocal;
uniform vec2 u_worldOrigin;
out vec2 v_uv;
out vec2 v_screen;
out vec2 v_world;
out vec2 v_worldLocal;

void main() {
  float sx = u_bounds.x + a_uv.x * u_bounds.z;
  float sy = u_bounds.y + a_uv.y * u_bounds.w;
  v_screen = vec2(sx, sy);
  v_uv = a_uv;

  v_worldLocal = (u_screenToLocal * vec3(sx, sy, 1.0)).xy;
  v_world = u_worldOrigin + v_worldLocal;

  vec3 clip = u_proj * vec3(sx, sy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
`;

/**
 * Attribute names used by the custom vertex shader.
 * The renderer looks these up after compile.
 */
export const CUSTOM_ATTRIBUTES = ['a_position', 'a_uv'] as const;

/**
 * Kit-managed uniform names for custom shader programs.
 * These are set per-draw by drawShader(); consumers must NOT redeclare them.
 */
export const CUSTOM_KIT_UNIFORMS = ['u_bounds', 'u_view', 'u_proj', 'u_screenToLocal', 'u_worldOrigin'] as const;

/**
 * Auto-quad geometry: 4 vertices covering NDC (-1..1) and UV (0..1), each
 * [a_position.x, a_position.y, a_uv.x, a_uv.y], in the order top-left,
 * top-right, bottom-right, bottom-left (UV space, screen y-down).
 */
export const QUAD_VERTICES = new Float32Array([
  -1, -1,  0, 0,
   1, -1,  1, 0,
   1,  1,  1, 1,
  -1,  1,  0, 1,
]);

export const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);
