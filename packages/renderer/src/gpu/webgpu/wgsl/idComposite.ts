import { textureWgsl, uniformsWgsl } from './common';
import { SOURCE_QUAD_LOCATIONS, SOURCE_QUAD_WGSL } from './composite';

/**
 * `draw/idComposite.ts`'s program in WGSL, built with ids off as its GLSL is:
 * it writes location 1 alone, so its pipeline's location-0 target takes a
 * write mask of 0. `u_ids` is read with `textureLoad` and has no sampler.
 */
export const ID_COMPOSITE_WGSL = /* wgsl */ `${uniformsWgsl([
  'u_groupId: vec4f', 'u_resolution: vec2f', 'u_alpha: f32',
], false)}
${textureWgsl('u_source', 0)}@group(1) @binding(2) var u_ids: texture_2d<f32>;
${SOURCE_QUAD_WGSL}
struct IdOut {
  @location(1) id: vec4f,
}

@fragment fn fs(in: VOut) -> IdOut {
  let a = textureSample(u_source, u_source_sampler, in.uv).a * u.u_alpha;
  // in.uv is already top-down, so this is GL's texel row turned over within
  // u_ids, which is stored the other way up from GL.
  let rows = i32(textureDimensions(u_ids).y);
  let texel = vec2i(vec2f(in.uv.x, 1.0 - in.uv.y) * u.u_resolution);
  let inner = textureLoad(u_ids, vec2i(texel.x, rows - 1 - texel.y), 0);
  var o: IdOut;
  o.id = vec4f(0.0);
  if (a > 0.0 && a >= u.u_groupId.a) {
    if (inner.a > 0.5) {
      o.id = inner;
    } else if (u.u_groupId.r >= 0.0) {
      o.id = vec4f(u.u_groupId.rgb, 1.0);
    }
  }
  return o;
}
`;

export const ID_COMPOSITE_LOCATIONS = SOURCE_QUAD_LOCATIONS;
