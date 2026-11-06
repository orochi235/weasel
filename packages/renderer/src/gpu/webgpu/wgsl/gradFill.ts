import { COLOR_MATRIX_MEMBERS, SHADE_MAPPED_WGSL, textureWgsl, uniformsWgsl } from './common';
import { PAINT_FILL_LOCATIONS, PAINT_VERTEX_MEMBERS, PAINT_VERTEX_WGSL, type WgslPaint } from './paintVertex';

/** `shaders/gradFill.ts`'s paint: linear, radial or conic off the ramp atlas
 *  row `u_rampV`, the fill's opacity folded in before the color matrix. */
export const GRAD_PAINT_WGSL: WgslPaint = {
  members: [
    ...COLOR_MATRIX_MEMBERS, 'u_rampV: f32', 'u_opacity: f32', 'u_gradKind: i32', 'u_gradDir: vec2f',
    'u_gradLen: f32', 'u_gradRadius: f32', 'u_gradAngle: f32',
  ],
  code: /* wgsl */ `${textureWgsl('u_ramp', 0)}${SHADE_MAPPED_WGSL}
const PI = 3.14159265358979323846;

fn shadePaint(world: vec2f) -> vec4f {
  var t: f32;
  if (u.u_gradKind == 0) {
    t = dot(world, u.u_gradDir) / max(u.u_gradLen, 0.0001);
  } else if (u.u_gradKind == 1) {
    t = length(world) / max(u.u_gradRadius, 0.0001);
  } else {
    let a = atan2(world.y, world.x) - u.u_gradAngle;
    t = fract(a / (2.0 * PI));
  }
  t = saturate(t);
  let ramp = textureSample(u_ramp, u_ramp_sampler, vec2f(t, u.u_rampV));
  return shadeMapped(vec4f(ramp.rgb, ramp.a * u.u_opacity));
}
`,
};

export const GRAD_FILL_WGSL = /* wgsl */ `${uniformsWgsl([...PAINT_VERTEX_MEMBERS, ...GRAD_PAINT_WGSL.members])}
${PAINT_VERTEX_WGSL}${GRAD_PAINT_WGSL.code}
@fragment fn fs(in: VOut) -> WeaselOut {
  return weasel_out(shadePaint(in.v_world), u.u_weaselId);
}
`;

export const GRAD_FILL_LOCATIONS = PAINT_FILL_LOCATIONS;
