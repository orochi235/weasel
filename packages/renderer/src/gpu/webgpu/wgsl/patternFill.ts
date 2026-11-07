import { COLOR_MATRIX_MEMBERS, SHADE_MAPPED_WGSL, STRAIGHT_RGB_WGSL, textureWgsl, uniformsWgsl } from './common';
import { PAINT_FILL_LOCATIONS, PAINT_VERTEX_MEMBERS, PAINT_VERTEX_WGSL, type WgslPaint } from './paintVertex';

/** `shaders/patternFill.ts`'s paint: the tile at `world / u_tileSize`, tiled
 *  by its sampler's repeat addressing. */
export const PATTERN_PAINT_WGSL: WgslPaint = {
  members: [...COLOR_MATRIX_MEMBERS, 'u_tileSize: vec2f', 'u_opacity: f32'],
  code: /* wgsl */ `${textureWgsl('u_sampler', 0)}${SHADE_MAPPED_WGSL}${STRAIGHT_RGB_WGSL}
fn shadePaint(world: vec2f) -> vec4f {
  let uv = world / max(u.u_tileSize, vec2f(0.0001));
  let texel = textureSample(u_sampler, u_sampler_sampler, uv);
  return shadeMapped(vec4f(straightRgb(texel), texel.a)) * u.u_opacity;
}
`,
};

export const PATTERN_FILL_WGSL = /* wgsl */ `${uniformsWgsl([...PAINT_VERTEX_MEMBERS, ...PATTERN_PAINT_WGSL.members])}
${PAINT_VERTEX_WGSL}${PATTERN_PAINT_WGSL.code}
@fragment fn fs(in: VOut) -> WeaselOut {
  return weasel_out(shadePaint(in.v_world), u.u_weaselId);
}
`;

export const PATTERN_FILL_LOCATIONS = PAINT_FILL_LOCATIONS;
