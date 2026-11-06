import { textureWgsl, uniformsWgsl } from './common';
import { ID_OUT_WGSL } from './idOut';

/** The full quad `QUAD_VERTICES` draws, uv turned top-down to read a source
 *  the renderer drew into, which WebGPU stores the other way up from GL. */
export const SOURCE_QUAD_WGSL = /* wgsl */ `
struct VOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex fn vs(@location(0) a_position: vec2f, @location(1) a_uv: vec2f) -> VOut {
  var o: VOut;
  o.position = vec4f(a_position, 0.0, 1.0);
  o.uv = vec2f(a_uv.x, 1.0 - a_uv.y);
  return o;
}
`;

export const SOURCE_QUAD_LOCATIONS = { a_position: 0, a_uv: 1 } as const;

/** `effects/effectPrelude.ts`'s `COMPOSITE_FRAG_SRC`: a group's finished
 *  texture put back into its parent under `u_alpha` and the color matrix. */
export const COMPOSITE_WGSL = /* wgsl */ `${uniformsWgsl(['u_colorMatrix: mat4x4f', 'u_colorBias: vec4f', 'u_alpha: f32'])}
${ID_OUT_WGSL}${textureWgsl('u_source', 0)}${SOURCE_QUAD_WGSL}
@fragment fn fs(in: VOut) -> WeaselOut {
  let src = textureSample(u_source, u_source_sampler, in.uv);
  let a = src.a;
  let rgb = select(vec3f(0.0), src.rgb / a, a > 0.0);
  var c = u.u_colorMatrix * vec4f(rgb, a) + u.u_colorBias;
  c.a *= u.u_alpha;
  return weasel_out(vec4f(saturate(c.rgb) * c.a, c.a), u.u_weaselId);
}
`;

export const COMPOSITE_LOCATIONS = SOURCE_QUAD_LOCATIONS;
