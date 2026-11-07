import { BATCH_ATTRIBUTE_LOCATIONS, BATCH_TEXTURE_SLOTS } from '../../../shaders/batchFill';
import { textureWgsl, uniformsWgsl } from './common';
import { GLYPH_CELL_WGSL } from './glyphCell';
import { GLYPH_COVERAGE_WGSL } from '@weasel-js/font';
import { GRAD_PAINT_WGSL } from './gradFill';
import { ID_OUT_WGSL } from './idOut';
import type { WgslPaint } from './paintVertex';
import { PATTERN_PAINT_WGSL } from './patternFill';

const L = BATCH_ATTRIBUTE_LOCATIONS;

/** `shaders/glyphPaint.ts` in WGSL: atlas glyphs masking a pattern, a
 *  gradient or a registered kind's scratch render, drawn from the batch's
 *  vertices at the batch's locations. The paint's texture is group-1
 *  bindings 0 and 1, the atlas 2 and 3. */
export const GLYPH_PAINT_LOCATIONS = {
  a_position: L.a_position, a_uv: L.a_uv, a_post: L.a_post, a_texSlot: L.a_texSlot,
} as const;

const GLYPH_STAGES_WGSL = /* wgsl */ `
struct VOut {
  @builtin(position) position: vec4f,
  @location(0) v_world: vec2f,
  @location(1) v_uv: vec2f,
  @location(2) @interpolate(flat) v_glyphMode: f32,
  @location(3) v_cell: vec2f,
}
${GLYPH_CELL_WGSL}
@vertex fn vs(
  @location(${L.a_position}) a_position: vec2f, @location(${L.a_uv}) a_uv: vec2f,
  @location(${L.a_post}) a_post: f32, @location(${L.a_texSlot}) a_texSlot: f32,
) -> VOut {
  var o: VOut;
  let screen = u.u_model * vec3f(a_position, 1.0);
  let clip = u.u_proj * vec3f(screen.xy, 1.0);
  o.position = weasel_clip(vec4f(clip.xy, 0.0, 1.0));
  o.v_world = (u.u_worldInv * vec3f(screen.xy, 1.0)).xy;
  o.v_uv = a_uv;
  o.v_glyphMode = f32(i32(a_texSlot + 0.5) / ${BATCH_TEXTURE_SLOTS});
  o.v_cell = glyphCellOf(a_post).xy;
  return o;
}
${textureWgsl('u_atlas', 2)}
fn glyphTap(uv: vec2f) -> vec4f {
  return textureSampleLevel(u_atlas, u_atlas_sampler, uv, 0.0);
}
${GLYPH_COVERAGE_WGSL}
@fragment fn fs(in: VOut) -> WeaselOut {
  let texel = textureSample(u_atlas, u_atlas_sampler, in.v_uv);
  let coverage = glyphCoverage(texel, in.v_glyphMode, u.u_synthBold, in.v_uv, u.u_fieldScale, in.v_cell);
  return weasel_out(shadePaint(in.v_world) * coverage, u.u_weaselId);
}
`;

/** A registered kind's paint, already rendered premultiplied into the paint
 *  scratch; `u_worldInv` takes a screen point to its texture coordinate. */
const TEXTURE_PAINT_WGSL: WgslPaint = {
  members: [],
  code: /* wgsl */ `${textureWgsl('u_sampler', 0)}
fn shadePaint(uv: vec2f) -> vec4f {
  // The scratch is a texture the renderer drew into, so v turns over.
  return textureSample(u_sampler, u_sampler_sampler, vec2f(uv.x, 1.0 - uv.y));
}
`,
};

function glyphPaintWgsl(paint: WgslPaint): string {
  return `${uniformsWgsl([
    'u_proj: mat3x3f', 'u_model: mat3x3f', 'u_worldInv: mat3x3f', ...paint.members,
    'u_synthBold: f32', 'u_fieldScale: vec2f',
  ])}${ID_OUT_WGSL}${paint.code}${GLYPH_STAGES_WGSL}`;
}

export const GLYPH_PATTERN_WGSL = glyphPaintWgsl(PATTERN_PAINT_WGSL);
export const GLYPH_GRAD_WGSL = glyphPaintWgsl(GRAD_PAINT_WGSL);
export const GLYPH_TEXTURE_WGSL = glyphPaintWgsl(TEXTURE_PAINT_WGSL);
