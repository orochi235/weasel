/**
 * `effects/builtins.ts`'s blur and vignette as WGSL effects: each a
 * `fn effect` for `assembleEffectWgsl`, its own uniforms a struct at group 1.
 * The kernels are symmetric, so the prelude's top-down uv changes nothing.
 */

export const BLUR_EFFECT_WGSL = /* wgsl */ `
struct Params {
  u_direction: vec2f,
  u_radius: f32,
}
@group(1) @binding(0) var<uniform> params: Params;

fn effect(in: EffectVaryings) -> vec4f {
  var w = array<f32, 5>(0.2270270, 0.1945946, 0.1216216, 0.0540541, 0.0162162);
  let stride = params.u_direction * kit.texel * (params.u_radius / 4.0);
  var sum = textureSample(source, source_sampler, in.uv) * w[0];
  for (var i = 1; i < 5; i++) {
    let off = stride * f32(i);
    sum += textureSample(source, source_sampler, in.uv + off) * w[i];
    sum += textureSample(source, source_sampler, in.uv - off) * w[i];
  }
  return sum;
}
`;

export const VIGNETTE_EFFECT_WGSL = /* wgsl */ `
struct Params {
  u_amount: f32,
  u_feather: f32,
}
@group(1) @binding(0) var<uniform> params: Params;

fn effect(in: EffectVaryings) -> vec4f {
  let src = textureSample(source, source_sampler, in.uv);
  let d = distance(in.uv, vec2f(0.5)) * 1.41421356;
  return src * (1.0 - params.u_amount * smoothstep(1.0 - params.u_feather, 1.0, d));
}
`;
