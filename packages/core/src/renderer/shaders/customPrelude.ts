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
 *   out vec2 v_world       approximate world-space coordinate (via view inverse)
 *
 * PREMULTIPLIED ALPHA REQUIREMENT (conventions §2):
 * The canvas uses premultipliedAlpha:true (the WebGL2 default). Consumer
 * fragment shaders MUST output premultiplied alpha:
 *
 *   outColor = vec4(rgb * a, a);   // CORRECT
 *   outColor = vec4(rgb, a);       // WRONG — over-brightens translucent pixels
 *
 * The renderer uses gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA) to match.
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
out vec2 v_uv;
out vec2 v_screen;
out vec2 v_world;

void main() {
  float sx = u_bounds.x + a_uv.x * u_bounds.z;
  float sy = u_bounds.y + a_uv.y * u_bounds.w;
  v_screen = vec2(sx, sy);
  v_uv = a_uv;

  float det = u_view[0][0] * u_view[1][1] - u_view[0][1] * u_view[1][0];
  float invDet = det != 0.0 ? 1.0 / det : 1.0;
  v_world = vec2(
    ((sx - u_view[2][0]) *  u_view[1][1] + (sy - u_view[2][1]) * -u_view[0][1]) * invDet,
    ((sx - u_view[2][0]) * -u_view[1][0] + (sy - u_view[2][1]) *  u_view[0][0]) * invDet
  );

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
export const CUSTOM_KIT_UNIFORMS = ['u_bounds', 'u_view', 'u_proj'] as const;

/**
 * Auto-quad geometry: 4 vertices covering NDC (-1..1) and UV (0..1).
 *
 * Layout per vertex: [a_position.x, a_position.y, a_uv.x, a_uv.y]
 *
 * Vertex order (UV space, screen y-down):
 *   0: top-left     (-1, -1, 0, 0)
 *   1: top-right    ( 1, -1, 1, 0)
 *   2: bottom-right ( 1,  1, 1, 1)
 *   3: bottom-left  (-1,  1, 0, 1)
 */
export const QUAD_VERTICES = new Float32Array([
  -1, -1,  0, 0,
   1, -1,  1, 0,
   1,  1,  1, 1,
  -1,  1,  0, 1,
]);

export const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);
