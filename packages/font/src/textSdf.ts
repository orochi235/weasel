/**
 * The GLSL that turns an atlas sample into glyph coverage, and the constants
 * naming which kind of atlas a sample came from.
 *
 * Not a program: glyphs stage into the renderer's batch alongside solid
 * geometry and image quads, and the batch shader pastes this in.
 *
 * MSDF channel layout: msdf-bmfont-xml writes R, G, and B as independent
 * signed-distance fields covering different edge directions, and the true
 * field is their median. The runtime canvas bake writes one channel that *is*
 * the field. Both encode the edge at 0.5, which is what lets one threshold
 * serve them.
 */

import type { FontStyle } from './fontStyle';
import { getFont } from './registerFont';
import { PAGE_SIZE, SDF_RADIUS } from './dynamic/dynamicAtlas';
import { BAKE_SIZE } from './dynamic/glyphRasterizer';

/** `a_paintMode` value for glyphs off an MSDF atlas — the median of R,G,B. */
export const GLYPH_MODE_MSDF = 1;
/** `a_paintMode` value for glyphs off a runtime canvas bake — `.r` alone. */
export const GLYPH_MODE_R8 = 2;

/**
 * Fields per screen pixel at which `glyphCoverage` starts taking area coverage
 * from four taps, and at which it takes nothing else. Between them it mixes the
 * two, so text zooming through the range does not change weight in a step.
 *
 * 30 and 20 px an em on a runtime canvas page (6 field units an em), and 40
 * and 27 on Inter's baked atlas (8). A regular stem is about 0.6 field units
 * wide, so these are stems of 3 and 2 pixels.
 */
export const GLYPH_AREA_FROM = 0.2;
export const GLYPH_AREA_FULL = 0.3;

/**
 * Device pixels a glyph quad grows by on every side where its glyphs take area
 * coverage. A pixel inks up to half a pixel past the outline, and a
 * multisampled target scales a pixel the quad's edge crosses by the samples it
 * covers, so a quad no wider than the glyph's padding (half a pixel for Inter
 * at 7.2px) loses ink wherever an edge lands inside a pixel.
 */
export const GLYPH_AREA_MARGIN = 1;

/**
 * Whether glyphs drawn `pxPerUv` screen pixels to a unit of texture coordinate
 * (along each axis) off an atlas of `fieldPerUv` need `GLYPH_COVERAGE_GLSL`'s
 * taps. Errs toward yes: a turned or sheared glyph's pixel spans a little more
 * field than its axes say.
 */
export function glyphNeedsArea(
  fieldPerUv: readonly [number, number], pxPerUvU: number, pxPerUvV: number,
): boolean {
  const fieldPerPx = 0.5 * (fieldPerUv[0] / pxPerUvU + fieldPerUv[1] / pxPerUvV);
  return fieldPerPx > GLYPH_AREA_FROM * 0.9;
}

const AREA_TAPS_GLSL = /* glsl */ `
  float area = smoothstep(${GLYPH_AREA_FROM.toFixed(2)}, ${GLYPH_AREA_FULL.toFixed(2)}, fieldPerPx);
  if (area > 0.0) {
    float band = 0.5 * aaW;
    float lo = threshold - 0.5 * band;
    float sum = 0.0;
    vec2 at = vec2(-0.375, -0.125);
    for (int i = 0; i < 4; i++) {
      float tap = glyphField(glyphTap(uv + at.x * du + at.y * dv), mode);
      sum += clamp((tap - lo) / band, 0.0, 1.0) * glyphInCell(cell + at.x * dcx + at.y * dcy, margin);
      at = vec2(-at.y, at.x);
    }
    coverage = mix(coverage, 0.25 * sum, area);
  }`;

/** The grown quad's cell: 1 inside the glyph's own atlas cell, 0 in the margin
 *  `GLYPH_AREA_MARGIN` added, where the atlas holds the neighboring glyph. */
const IN_CELL_GLSL = /* glsl */ `
float glyphInCell(vec2 c, vec2 margin) {
  vec2 inside = step(margin, c) * step(c, 1.0 - margin);
  return inside.x * inside.y;
}
`;

const CELL_MARGIN_GLSL = /* glsl */ `
  vec2 dcx = dFdx(cell);
  vec2 dcy = dFdy(cell);
  vec2 margin = ${GLYPH_AREA_MARGIN.toFixed(1)} * vec2(length(vec2(dcx.x, dcy.x)), length(vec2(dcx.y, dcy.y)));`;

function glyphCoverageGlsl(area: boolean): string {
  return /* glsl */ `
float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

float glyphField(vec4 texel, float mode) {
  return mix(median(texel.r, texel.g, texel.b), texel.r, step(1.5, mode));
}
${area ? IN_CELL_GLSL : ''}
float glyphCoverage(vec4 texel, float mode, float synthBold, vec2 uv, vec2 fieldPerUv${area ? ', vec2 cell' : ''}) {
  vec2 du = dFdx(uv);
  vec2 dv = dFdy(uv);${area ? CELL_MARGIN_GLSL : ''}
  float fieldPerPx = 0.5 * (length(du * fieldPerUv) + length(dv * fieldPerUv));
  float aaW = max(0.5 * fieldPerPx, 0.0005);
  float threshold = 0.5 - synthBold;
  float field = glyphField(texel, mode);
  float coverage = smoothstep(threshold - aaW, threshold + aaW, field)${area ? ' * glyphInCell(cell, margin)' : ''};${area ? AREA_TAPS_GLSL : ''}
  return coverage;
}
`;
}

/**
 * Glyph coverage from the atlas, as GLSL for a program to paste in.
 *
 * `texel` is the atlas sample at `uv`; `mode` says which field it carries:
 * `GLYPH_MODE_MSDF` takes the median of R,G,B, `GLYPH_MODE_R8` reads `.r`
 * alone.
 *
 * The antialiasing band has to be one *screen* pixel wide: `fieldPerUv` is how
 * far the field runs per unit of texture coordinate on each axis (see
 * `glyphFieldScale`), and the screen derivatives of `uv` turn that into field
 * units per screen pixel.
 *
 * Not `fwidth(field)`: that is the field's slope only where the field is a
 * straight ramp. Across a stem narrower than a pixel the two columns of a 2x2
 * quad sample either side of the ridge at equal values, the derivative reads
 * flat, and the stem is thresholded away. The derivative of `uv` is constant
 * across a glyph quad, so it cannot do that. Nor a constant band, which is
 * right at one scale only.
 *
 * **Small text takes area coverage.** One sample at the pixel's center inks a
 * stem narrower than a pixel by where it sits: centered on a column it inks
 * half a pixel plus half its width, straddling two it inks its width, so a
 * glyph's ink shifts as it moves through a pixel. Where a pixel spans
 * more of the field than `GLYPH_AREA_FROM` (see there), coverage is the mean of
 * four taps on a rotated grid, at the centers of the pixel's quarters along
 * either axis, each through a linear ramp a quarter pixel wide: a box filter
 * over the pixel, which keeps a stem's ink to its width wherever it lands. A
 * 2x2 grid would put only two taps along each axis, and a stem narrower than
 * half a pixel snaps between them. The program defines
 * `vec4 glyphTap(vec2 uv)` before pasting this in, returning the atlas sample
 * at `uv` with no implicit derivative (`textureLod` at level 0: an atlas has no
 * mipmaps), because it runs inside the branch.
 *
 * **A glyph taking area coverage draws on a grown quad.** Its quad grows by
 * `GLYPH_AREA_MARGIN` device pixels on every side, and `cell` runs 0 to 1
 * across the grown quad, corner to corner, so the shader can tell the glyph's
 * own cell from the margin, where the atlas holds the next glyph over: what
 * lands there reads as no ink. A quad that has not grown passes one constant
 * `cell`, which reads as all cell.
 *
 * **Nothing before that branch may be skipped, and the caller must not branch
 * around this.** A derivative in non-uniform control flow is undefined, so both
 * are taken first, and before anything selects on paint mode. A merged program
 * therefore runs the glyph math on fragments that are not glyphs and discards
 * the result; it passes a zero `fieldPerUv` for those, which keeps them out of
 * the branch.
 *
 * The branch costs fragments that never take it: 6 to 15% of a batch fragment
 * that is not a glyph (`tests/perf/recorded/glyph-area-coverage-2026-10-30/`),
 * however its condition is decided. So a program that knows no fragment will
 * need the taps pastes `GLYPH_POINT_COVERAGE_GLSL` instead, which has no
 * branch and needs no `glyphTap`; `glyphNeedsArea` tells a caller staging
 * glyphs which they need.
 *
 * `synthBold` shifts the threshold to thicken strokes where the resolver fell
 * back from a missing bold variant to the regular atlas.
 */
export const GLYPH_COVERAGE_GLSL = glyphCoverageGlsl(true);

/** `GLYPH_COVERAGE_GLSL` reading the field at the pixel's center alone, for a
 *  program drawing no glyph small enough to need area coverage. */
export const GLYPH_POINT_COVERAGE_GLSL = glyphCoverageGlsl(false);

/** msdf-bmfont-xml's default `distanceRange`, for an atlas that records none. */
const DEFAULT_MSDF_RANGE = 4;

/** A runtime canvas page: `PAGE_SIZE` texels, field 0 to 1 over `SDF_RADIUS` of them. */
const CANVAS_FIELD_SCALE = [PAGE_SIZE / SDF_RADIUS, PAGE_SIZE / SDF_RADIUS] as const;

/**
 * Field units per unit of texture coordinate along u and v for the atlas a
 * glyph group samples — the `fieldPerUv` that `glyphCoverage` takes. A baked
 * MSDF atlas answers from its page size and `distanceRange`, a runtime canvas
 * page from the dynamic tier's page size and bake radius. `undefined` for an
 * atlas that is not registered.
 */
export function glyphFieldScale(
  source: 'atlas' | 'canvas', family: string, weight: number, style: FontStyle,
): readonly [number, number] | undefined {
  if (source === 'canvas') return CANVAS_FIELD_SCALE;
  const font = getFont(family, weight, style)?.font;
  if (!font) return undefined;
  const range = font.distanceRange ?? DEFAULT_MSDF_RANGE;
  const u = font.common.scaleW / range, v = font.common.scaleH / range;
  // Asked once per text command per frame, so the last answer is kept.
  if (lastFieldScale[0] !== u || lastFieldScale[1] !== v) lastFieldScale = [u, v];
  return lastFieldScale;
}

let lastFieldScale: readonly [number, number] = [NaN, NaN];

/**
 * How far the field threshold drops for a glyph faked bold from a lighter
 * face. Tuned on Inter: it thickens strokes about a pixel at 16px without
 * breaking glyph topology.
 */
export const SYNTH_BOLD_AMOUNT = 0.08;

/**
 * How far synthetic bold moves each edge of a glyph outward, in em, for the
 * atlas that serves it: `SYNTH_BOLD_AMOUNT` of the field's span, which is
 * `distanceRange` texels in a baked MSDF atlas and `SDF_RADIUS` in a runtime
 * canvas page, over the atlas's texels per em. `undefined` for an atlas that
 * is not registered.
 */
export function syntheticBoldGrowth(
  source: 'atlas' | 'canvas', family: string, weight: number, style: FontStyle,
): number | undefined {
  if (source === 'canvas') return (SYNTH_BOLD_AMOUNT * SDF_RADIUS) / BAKE_SIZE;
  const font = getFont(family, weight, style)?.font;
  if (!font) return undefined;
  return (SYNTH_BOLD_AMOUNT * (font.distanceRange ?? DEFAULT_MSDF_RANGE)) / font.info.size;
}
