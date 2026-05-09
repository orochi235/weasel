/**
 * GLSL ES 3.0 sources for gradient-fill paths (linear, radial, conic).
 *
 * Three gradient kinds via u_gradKind (0=linear, 1=radial, 2=conic).
 * The branch value is uniform across all fragments in one draw call — GPU
 * branch predictor handles uniform-value branches without warp divergence.
 *
 * Output convention §2: PREMULTIPLIED alpha.
 *
 * Step-4 limitation: u_worldInv is identity in v1 since draw.ts doesn't yet
 * receive a view matrix. Gradient coords therefore render in screen space.
 * Step 7 (port createPathLayer) wires the actual view-inverse through layers.
 */

export const GRAD_VERT_SRC = /* glsl */ `#version 300 es
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

export const GRAD_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_world;
uniform sampler2D u_ramp;
uniform float u_alpha;
uniform float u_opacity;
uniform int   u_gradKind;
uniform vec2  u_gradP0;
uniform vec2  u_gradDir;
uniform float u_gradLen;
uniform float u_gradRadius;
uniform float u_gradAngle;
out vec4 outColor;

const float PI = 3.14159265358979323846;

void main() {
  float t;
  if (u_gradKind == 0) {
    vec2 d = v_world - u_gradP0;
    t = dot(d, u_gradDir) / max(u_gradLen, 0.0001);
  } else if (u_gradKind == 1) {
    t = length(v_world - u_gradP0) / max(u_gradRadius, 0.0001);
  } else {
    float a = atan(v_world.y - u_gradP0.y, v_world.x - u_gradP0.x) - u_gradAngle;
    t = fract(a / (2.0 * PI));
  }
  t = clamp(t, 0.0, 1.0);
  vec4 rampColor = texture(u_ramp, vec2(t, 0.5));
  float a = rampColor.a * u_opacity * u_alpha;
  outColor = vec4(rampColor.rgb * a, a);
}
`;

export const GRAD_FILL_UNIFORMS = [
  'u_proj', 'u_model', 'u_worldInv', 'u_ramp',
  'u_alpha', 'u_opacity',
  'u_gradKind', 'u_gradP0', 'u_gradDir', 'u_gradLen', 'u_gradRadius', 'u_gradAngle',
] as const;

export const GRAD_FILL_ATTRIBUTES = ['a_position'] as const;
