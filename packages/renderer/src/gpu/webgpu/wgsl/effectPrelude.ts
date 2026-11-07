import { NDC_WGSL } from './common';

/**
 * What a WGSL effect is written against: `fn effect(in: EffectVaryings) -> vec4f`,
 * reading what has been drawn so far from `source`. `uv` runs top-down across
 * the source, and `in.position.xy + kit.windowOrigin` is the fragment's device
 * pixel in the drawing buffer, top-left origin. The source and the output are
 * premultiplied. An effect's own uniforms and textures go in group 1, as a
 * custom program's do.
 */
export const EFFECT_PRELUDE_WGSL = /* wgsl */ `
struct EffectKit {
  resolution: vec2f,
  texel: vec2f,
  windowOrigin: vec2f,
}
@group(0) @binding(0) var<uniform> kit: EffectKit;
@group(0) @binding(1) var source: texture_2d<f32>;
@group(0) @binding(2) var source_sampler: sampler;

struct EffectVaryings {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}
${NDC_WGSL}`;

/** The effect kit uniforms by their GLSL names, and the `EffectKit` member each lands in. */
export const EFFECT_KIT_WGSL_NAMES: Readonly<Record<string, string>> = {
  u_resolution: 'resolution',
  u_texel: 'texel',
  u_windowOrigin: 'windowOrigin',
  u_source: 'source',
};

/** The module a WGSL effect compiles to, with entry points `weasel_vs` and `weasel_fs`.
 *  The pass's quad is `QUAD_VERTICES`, whose uv runs bottom-up as GL's textures do. */
export function assembleEffectWgsl(frag: string): string {
  return `${EFFECT_PRELUDE_WGSL}
${frag}
@vertex fn weasel_vs(@location(0) position: vec2f, @location(1) uv: vec2f) -> EffectVaryings {
  var o: EffectVaryings;
  o.position = weasel_clip(vec4f(position, 0.0, 1.0));
  o.uv = vec2f(uv.x, 1.0 - uv.y);
  return o;
}

@fragment fn weasel_fs(in: EffectVaryings) -> @location(0) vec4f {
  return effect(in);
}
`;
}
