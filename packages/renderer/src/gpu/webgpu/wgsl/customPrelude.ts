import type { ShaderSource } from '../../../shaders/registerProgram';
import { NDC_WGSL } from './common';
import { ID_OUT_WGSL } from './idOut';

/**
 * What a custom WGSL program is written against. A program supplies plain
 * functions and the kit supplies the entry points that call them:
 *
 *   fn fragment(in: Varyings) -> vec4f          required, premultiplied
 *   fn vertex(v: KitVertex) -> Varyings         optional (`wgsl.vert`)
 *
 * Both stages are one WGSL module, so a struct or binding both use is declared
 * once. A program's own uniforms are a struct at `@group(1) @binding(0)`, its
 * textures group-1 variables, each `texture_2d<f32>` named `x` beside a
 * `sampler` named `x_sampler`. Every coordinate is top-left origin.
 */
export const CUSTOM_PRELUDE_WGSL = /* wgsl */ `
struct Kit {
  proj: mat3x3f,
  view: mat3x3f,
  screenToLocal: mat3x3f,
  bounds: vec4f,
  weaselId: vec4f,
  worldOrigin: vec2f,
  fragOrigin: vec2f,
}
@group(0) @binding(0) var<uniform> kit: Kit;

struct KitVertex {
  @location(0) position: vec2f,
  @location(1) uv: vec2f,
}

struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) screen: vec2f,
  @location(2) world: vec2f,
  @location(3) worldLocal: vec2f,
}

fn kitVertex(v: KitVertex) -> Varyings {
  var o: Varyings;
  let s = kit.bounds.xy + v.uv * kit.bounds.zw;
  o.screen = s;
  o.uv = v.uv;
  o.worldLocal = (kit.screenToLocal * vec3f(s, 1.0)).xy;
  o.world = kit.worldOrigin + o.worldLocal;
  let clip = kit.proj * vec3f(s, 1.0);
  o.position = vec4f(clip.xy, 0.0, 1.0);
  return o;
}
${ID_OUT_WGSL}${NDC_WGSL}`;

/** The kit uniforms a custom program's draw sets, by the names the draw sets
 *  them under, and the `Kit` member each lands in under WGSL. `fragOrigin` is
 *  top-left, so it takes `u_fragOriginTop` rather than GLSL's bottom-left
 *  `u_fragOrigin`. */
export const CUSTOM_KIT_WGSL_NAMES: Readonly<Record<string, string>> = {
  u_proj: 'proj',
  u_view: 'view',
  u_screenToLocal: 'screenToLocal',
  u_bounds: 'bounds',
  u_worldOrigin: 'worldOrigin',
  u_fragOriginTop: 'fragOrigin',
  u_weaselId: 'weaselId',
};

/** Whether `code` is a whole module, declaring its own entry points, rather
 *  than the functions a prelude calls. */
export function declaresEntryPoints(code: string): boolean {
  return /@vertex\s+fn\b/.test(code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''));
}

/** The module a registered program's WGSL compiles to: a whole module as it
 *  is, a custom program's functions inside the prelude. */
export function wgslModuleOf(src: ShaderSource): string {
  return declaresEntryPoints(src.frag) ? src.frag : assembleCustomWgsl(src);
}

/** The module a custom WGSL program compiles to, with entry points `weasel_vs` and `weasel_fs`. */
export function assembleCustomWgsl(src: ShaderSource): string {
  const vertex = src.vert === undefined ? 'kitVertex(v)' : 'vertex(v)';
  return `${CUSTOM_PRELUDE_WGSL}
${src.frag}
${src.vert ?? ''}
@vertex fn weasel_vs(v: KitVertex) -> Varyings {
  var o = ${vertex};
  o.position = weasel_clip(o.position);
  return o;
}

@fragment fn weasel_fs(in: Varyings) -> WeaselOut {
  return weasel_out(fragment(in), kit.weaselId);
}
`;
}
