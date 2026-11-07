import type { ShaderSource } from '../../../shaders/registerProgram';
import { NDC_WGSL } from './common';
import { declaresEntryPoints } from './customPrelude';
import { ID_OUT_WGSL } from './idOut';

/**
 * What a registered paint kind's WGSL is written against, the paint
 * counterpart of the custom prelude: the kind supplies
 *
 *   fn fragment(in: PaintVaryings) -> vec4f      required, premultiplied
 *   fn vertex(v: PaintVertex) -> PaintVaryings   optional (`wgsl.vert`)
 *
 * and the kit the entry points. `world` is the screen point through
 * `u_worldInv`, as the GLSL paint vertex's `v_world` is. The kind's own
 * uniforms are a struct at `@group(1) @binding(0)`, its textures group-1
 * variables, each `texture_2d<f32>` named `x` beside a `sampler` named `x_sampler`.
 */
export const PAINT_PRELUDE_WGSL = /* wgsl */ `
struct PaintKit {
  proj: mat3x3f,
  model: mat3x3f,
  worldInv: mat3x3f,
  weaselId: vec4f,
  origin: vec2f,
}
@group(0) @binding(0) var<uniform> kit: PaintKit;

struct PaintVertex {
  @location(0) position: vec2f,
}

struct PaintVaryings {
  @builtin(position) position: vec4f,
  @location(0) screen: vec2f,
  @location(1) world: vec2f,
}

fn kitVertex(v: PaintVertex) -> PaintVaryings {
  var o: PaintVaryings;
  o.screen = (kit.model * vec3f(v.position - kit.origin, 1.0)).xy;
  o.world = (kit.worldInv * vec3f(o.screen, 1.0)).xy;
  let clip = kit.proj * vec3f(o.screen, 1.0);
  o.position = vec4f(clip.xy, 0.0, 1.0);
  return o;
}
${ID_OUT_WGSL}${NDC_WGSL}`;

/** The kit uniforms a paint draw sets, and the `PaintKit` member each lands in. */
export const PAINT_KIT_WGSL_NAMES: Readonly<Record<string, string>> = {
  u_proj: 'proj',
  u_model: 'model',
  u_worldInv: 'worldInv',
  u_weaselId: 'weaselId',
  u_origin: 'origin',
};

/** The module a paint kind's WGSL compiles to: a whole module as it is, the
 *  kind's functions inside the paint prelude, with entry points `weasel_vs` and `weasel_fs`. */
export function assemblePaintWgsl(src: ShaderSource): string {
  if (declaresEntryPoints(src.frag)) return src.frag;
  const vertex = src.vert === undefined ? 'kitVertex(v)' : 'vertex(v)';
  return `${PAINT_PRELUDE_WGSL}
${src.frag}
${src.vert ?? ''}
@vertex fn weasel_vs(v: PaintVertex) -> PaintVaryings {
  var o = ${vertex};
  o.position = weasel_clip(o.position);
  return o;
}

@fragment fn weasel_fs(in: PaintVaryings) -> WeaselOut {
  return weasel_out(fragment(in), kit.weaselId);
}
`;
}
