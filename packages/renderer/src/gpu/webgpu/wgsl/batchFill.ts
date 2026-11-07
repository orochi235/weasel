import {
  BATCH_ATTRIBUTE_LOCATIONS, BATCH_MATRIX_SLOTS, BATCH_TEXTURE_SLOTS, PAINT_MODE_CONIC, PAINT_MODE_IMAGE, RAMP_SLOT,
  packSlot, withHull, withMatrix,
} from '../../../shaders/batchFill';
import { HULL_PLANES } from '../../../batchHull';
import { STRAIGHT_RGB_WGSL, uniformsWgsl } from './common';
import { GLYPH_CELL_WGSL } from './glyphCell';
import { GLYPH_COVERAGE_WGSL, GLYPH_POINT_COVERAGE_WGSL } from '@weasel-js/font';
import { HULL_COVERAGE_WGSL, HULL_MEMBERS } from './hullCoverage';
import { ID_OUT_WGSL } from './idOut';

/**
 * The batch program (`shaders/batchFill.ts`) in WGSL, every build from one
 * generator. Its `u_samplers[16]` is 16 textures, `u_samplers_0` to
 * `u_samplers_15`, at group-1 bindings 0 to 15, and 15 samplers
 * `u_samplers_N_sampler` at bindings 16 + N: slot 0 is always the 1x1 white
 * texel, which reads the same under any sampler, so it borrows slot 1's.
 * Every other slot keeps its own, because an image's filter and wrap are its
 * own. A slot's fetch is `textureSampleGrad` with the derivatives of `v_uv`
 * taken before the branch on its flat slot index, which is what GLSL's
 * `texture()` takes inside it.
 */

const PAINT_MODES = withMatrix(0, 1) / packSlot(0, 1);
const MATRIX_STRIDE = withMatrix(0, 1);
const HULL_STRIDE = withHull(0, 0, 1);
const INV_TAU = (1 / (2 * Math.PI)).toFixed(10);
const L = BATCH_ATTRIBUTE_LOCATIONS;

/** Which build: under one color matrix or `BATCH_MATRIX_SLOTS`, with the hull
 *  clip, with the glyph taps for area coverage. */
export interface BatchBuild {
  readonly matrices: boolean;
  readonly hulls: boolean;
  readonly area: boolean;
}

export const BATCH_FILL_LOCATIONS = BATCH_ATTRIBUTE_LOCATIONS;

const samplerOf = (slot: number): string => `u_samplers_${slot === 0 ? 1 : slot}_sampler`;

function texturesWgsl(): string {
  const lines: string[] = [];
  for (let s = 0; s < BATCH_TEXTURE_SLOTS; s++) {
    lines.push(`@group(1) @binding(${s}) var u_samplers_${s}: texture_2d<f32>;`);
    if (s > 0) lines.push(`@group(1) @binding(${BATCH_TEXTURE_SLOTS + s}) var ${samplerOf(s)}: sampler;`);
  }
  return `${lines.join('\n')}\n`;
}

/** The fetch for slots `lo` to `hi`; `fetch(slot)` is a leaf's sample. */
function sampleTree(lo: number, hi: number, fetch: (slot: number) => string, indent = '  '): string {
  if (lo === hi) return `${indent}return ${fetch(lo)};`;
  const mid = (lo + hi + 1) >> 1;
  return [
    `${indent}if (slot < ${mid}) {`,
    sampleTree(lo, mid - 1, fetch, `${indent}  `),
    `${indent}} else {`,
    sampleTree(mid, hi, fetch, `${indent}  `),
    `${indent}}`,
  ].join('\n');
}

const SAMPLE_SLOT_WGSL = /* wgsl */ `
fn sampleSlot(slot: i32, uv: vec2f, ddx: vec2f, ddy: vec2f) -> vec4f {
${sampleTree(0, BATCH_TEXTURE_SLOTS - 1, (s) => `textureSampleGrad(u_samplers_${s}, ${samplerOf(s)}, uv, ddx, ddy)`)}
}
`;

/** A glyph's taps, which take no derivative; slot 0 is never an atlas. */
function glyphTapWgsl(): string {
  return /* wgsl */ `
var<private> tapSlot: i32;
fn glyphTap(uv: vec2f) -> vec4f {
  let slot = tapSlot;
${sampleTree(1, BATCH_TEXTURE_SLOTS - 1, (s) => `textureSampleLevel(u_samplers_${s}, ${samplerOf(s)}, uv, 0.0)`)}
}
`;
}

function varyingsWgsl({ hulls, area }: BatchBuild): string {
  return /* wgsl */ `
struct VIn {
  @location(${L.a_position}) a_position: vec2f,
  @location(${L.a_vertexColor}) a_vertexColor: vec4f,
  @location(${L.a_uv}) a_uv: vec2f,
  @location(${L.a_post}) a_post: f32,
  @location(${L.a_texSlot}) a_texSlot: f32,
}

struct VOut {
  @builtin(position) position: vec4f,
  @location(0) v_vertexColor: vec4f,
  @location(1) v_uv: vec2f,
  @location(2) v_post: f32,
  @location(3) @interpolate(flat) v_texSlot: i32,
  @location(4) @interpolate(flat) v_paintMode: f32,
  @location(5) @interpolate(flat) v_matrix: i32,${hulls ? `
  @location(6) @interpolate(flat) v_hullStart: i32,
  @location(7) @interpolate(flat) v_hullCount: i32,` : ''}${area ? `
  @location(8) v_cell: vec2f,` : ''}
}
`;
}

function vertexWgsl({ hulls, area }: BatchBuild): string {
  return /* wgsl */ `${area ? GLYPH_CELL_WGSL : ''}
@vertex fn vs(v: VIn) -> VOut {
  var o: VOut;
  let screen = u.u_model * vec3f(v.a_position, 1.0);
  let clip = u.u_proj * vec3f(screen.xy, 1.0);
  o.position = weasel_clip(vec4f(clip.xy, 0.0, 1.0));
  o.v_vertexColor = v.a_vertexColor;
  o.v_uv = v.a_uv;
  o.v_post = v.a_post;
  let packed = i32(v.a_texSlot + 0.5);
  o.v_texSlot = packed % ${BATCH_TEXTURE_SLOTS};
  o.v_paintMode = f32((packed / ${BATCH_TEXTURE_SLOTS}) % ${PAINT_MODES});
  o.v_matrix = (packed / ${MATRIX_STRIDE}) % ${BATCH_MATRIX_SLOTS};${hulls ? `
  let hull = packed / ${HULL_STRIDE};
  o.v_hullStart = select((hull - 1) / ${HULL_PLANES}, 0, hull == 0);
  o.v_hullCount = select((hull - 1) % ${HULL_PLANES} + 1, 0, hull == 0);` : ''}${area ? `
  let glyph = o.v_paintMode > 0.5 && o.v_paintMode < 2.5;
  let cell = select(vec3f(0.0, 0.0, v.a_post), glyphCellOf(v.a_post), glyph);
  o.v_cell = cell.xy;
  o.v_post = cell.z;` : ''}
  return o;
}
`;
}

function fragmentWgsl({ matrices, hulls, area }: BatchBuild): string {
  const m = matrices ? 'in.v_matrix' : '0';
  return /* wgsl */ `
@fragment fn fs(in: VOut) -> WeaselOut {
  let ddx = dpdx(in.v_uv);
  let ddy = dpdy(in.v_uv);
  let isGrad = step(2.5, in.v_paintMode) * step(in.v_paintMode, ${PAINT_MODE_CONIC + 0.5});
  var texel: vec4f;
  if (isGrad > 0.5) {
    let t = select(length(in.v_uv), fract(atan2(in.v_uv.y, in.v_uv.x) * ${INV_TAU}), in.v_paintMode > ${PAINT_MODE_CONIC - 0.5});
    // The ramp atlas has no mipmaps, so level 0 is what an implicit derivative picks.
    texel = textureSampleLevel(u_samplers_${RAMP_SLOT}, ${samplerOf(RAMP_SLOT)}, vec2f(t, in.v_post), 0.0);
  } else {
    texel = sampleSlot(in.v_texSlot, in.v_uv, ddx, ddy);
  }
  texel = vec4f(mix(texel.rgb, straightRgb(texel), step(${PAINT_MODE_IMAGE - 0.5}, in.v_paintMode)), texel.a);
  let isGlyph = step(0.5, in.v_paintMode) * step(in.v_paintMode, 2.5);${area ? `
  tapSlot = in.v_texSlot;` : ''}
  let coverage = glyphCoverage(texel, in.v_paintMode, in.v_post * isGlyph, in.v_uv, u.u_fieldScale[in.v_texSlot].v${area ? ' * isGlyph, in.v_cell' : ''});
  let src = mix(texel, vec4f(1.0), isGlyph) * u.u_color * in.v_vertexColor;
  let mapped = saturate(u.u_colorMatrix[${m}] * src + u.u_colorBias[${m}]);
  let a = mapped.a * u.u_alpha[${m}].v * mix(in.v_post, 1.0, max(isGrad, isGlyph)) * mix(1.0, coverage, isGlyph)${hulls ? ' * hullCoverage(in.position.xy, in.v_hullStart, in.v_hullCount)' : ''};
  return weasel_out(vec4f(mapped.rgb * a, a), u.u_weaselId);
}
`;
}

/** The module for one build, entry points `vs` and `fs`. */
export function batchFillWgsl(build: BatchBuild): string {
  const n = build.matrices ? BATCH_MATRIX_SLOTS : 1;
  const members = [
    'u_proj: mat3x3f', 'u_model: mat3x3f', 'u_color: vec4f',
    `u_alpha: array<F32Slot, ${n}>`, `u_fieldScale: array<Vec2Slot, ${BATCH_TEXTURE_SLOTS}>`,
    `u_colorMatrix: array<mat4x4f, ${n}>`, `u_colorBias: array<vec4f, ${n}>`,
    ...(build.hulls ? HULL_MEMBERS : []),
  ];
  return [
    uniformsWgsl(members), ID_OUT_WGSL, texturesWgsl(), varyingsWgsl(build), vertexWgsl(build), SAMPLE_SLOT_WGSL,
    build.area ? glyphTapWgsl() : '', build.area ? GLYPH_COVERAGE_WGSL : GLYPH_POINT_COVERAGE_WGSL,
    STRAIGHT_RGB_WGSL, build.hulls ? HULL_COVERAGE_WGSL : '', fragmentWgsl(build),
  ].join('');
}

/** Every build, keyed as `BatchVariants.get` picks them. */
export const BATCH_BUILDS: readonly BatchBuild[] = [false, true].flatMap((area) =>
  [false, true].flatMap((hulls) => [false, true].map((matrices) => ({ matrices, hulls, area }))));
