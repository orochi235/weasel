import { textureWgsl, uniformsWgsl } from './common';
import { PAINT_FILL_LOCATIONS, PAINT_VERTEX_MEMBERS, PAINT_VERTEX_WGSL } from './paintVertex';

/** `meshPaint/meshShader.ts` (`kit:mesh-gradient`) in WGSL: the straight-RGBA
 *  bake over `u_meshSize`, transparent outside it. */
export const MESH_WGSL = /* wgsl */ `${uniformsWgsl([
  ...PAINT_VERTEX_MEMBERS, 'u_meshSize: vec2f', 'u_opacity: f32', 'u_alpha: f32',
])}
${PAINT_VERTEX_WGSL}${textureWgsl('u_sampler', 0)}
@fragment fn fs(in: VOut) -> WeaselOut {
  let t = in.v_world / max(u.u_meshSize, vec2f(0.0001));
  let texels = vec2f(textureDimensions(u_sampler));
  let uv = (t * (texels - 1.0) + 0.5) / texels;
  // Sampled before the box test: WGSL takes no implicit derivative past a branch on a varying.
  let texel = textureSample(u_sampler, u_sampler_sampler, uv);
  let outside = any(t < vec2f(0.0)) || any(t > vec2f(1.0));
  let a = texel.a * u.u_opacity * u.u_alpha;
  return weasel_out(select(vec4f(texel.rgb * a, a), vec4f(0.0), outside), u.u_weaselId);
}
`;

export const MESH_LOCATIONS = PAINT_FILL_LOCATIONS;
