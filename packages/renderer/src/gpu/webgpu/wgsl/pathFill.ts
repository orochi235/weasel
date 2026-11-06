import { ID_OUT_WGSL } from './idOut';

/** The solid-fill path program in WGSL, flat and per-vertex-color, with the
 *  GLSL's uniform names. Output is premultiplied. */
const COMMON = /* wgsl */ `
struct Uniforms {
  u_proj: mat3x3f,
  u_model: mat3x3f,
  u_colorMatrix: mat4x4f,
  u_color: vec4f,
  u_colorBias: vec4f,
  u_weaselId: vec4f,
  u_origin: vec2f,
  u_alpha: f32,
}
@group(0) @binding(0) var<uniform> u: Uniforms;
${ID_OUT_WGSL}
fn clipOf(a_position: vec2f) -> vec4f {
  let screen = u.u_model * vec3f(a_position - u.u_origin, 1.0);
  let clip = u.u_proj * vec3f(screen.xy, 1.0);
  return vec4f(clip.xy, 0.0, 1.0);
}

fn shade(src: vec4f) -> WeaselOut {
  let mapped = clamp(u.u_colorMatrix * src + u.u_colorBias, vec4f(0.0), vec4f(1.0));
  let a = mapped.a * u.u_alpha;
  return weasel_out(vec4f(mapped.rgb * a, a), u.u_weaselId);
}
`;

export const PATH_FILL_WGSL = /* wgsl */ `${COMMON}
@vertex fn vs(@location(0) a_position: vec2f) -> @builtin(position) vec4f {
  return clipOf(a_position);
}

@fragment fn fs() -> WeaselOut {
  return shade(u.u_color);
}
`;

export const PATH_FILL_VCOLOR_WGSL = /* wgsl */ `${COMMON}
struct VOut {
  @builtin(position) position: vec4f,
  @location(0) vertexColor: vec4f,
}

@vertex fn vs(@location(0) a_position: vec2f, @location(1) a_vertexColor: vec4f) -> VOut {
  var o: VOut;
  o.position = clipOf(a_position);
  o.vertexColor = a_vertexColor;
  return o;
}

@fragment fn fs(in: VOut) -> WeaselOut {
  return shade(u.u_color * in.vertexColor);
}
`;
