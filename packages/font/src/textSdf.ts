/**
 * The GLSL that turns an atlas sample into glyph coverage, and the constants
 * naming which kind of atlas a sample came from.
 *
 * Not a program: text has no program of its own any more. Glyphs stage into
 * the renderer's batch alongside solid geometry and image quads, and the batch
 * shader pastes this in — which is why what lives here is a snippet rather
 * than a vertex and fragment pair. The two channel layouts a glyph atlas can
 * have are the part that belongs to this package, so they stay here.
 *
 * MSDF channel layout: msdf-bmfont-xml writes R, G and B as independent
 * signed-distance fields covering different edge directions, and the true
 * field is their median — which recovers a sharp outline while averaging out
 * single-channel aliasing. The runtime canvas bake writes one channel that
 * *is* the field. Both encode the edge at 0.5, which is what lets one
 * threshold serve them.
 *
 * The single-channel bake rounds corners away from its bake size, mildest near
 * it. `glyphRasterizer.ts` carries the measurements and the reason neither a
 * larger bake nor extra taps would improve the small-text end.
 */

import type { FontStyle } from './fontStyle';
import { getFont } from './registerFont';
import { PAGE_SIZE, SDF_RADIUS } from './dynamic/dynamicAtlas';

/** `a_paintMode` value for glyphs off an MSDF atlas — the median of R,G,B. */
export const GLYPH_MODE_MSDF = 1;
/** `a_paintMode` value for glyphs off a runtime canvas bake — `.r` alone. */
export const GLYPH_MODE_R8 = 2;

/**
 * Glyph coverage from one atlas sample, as GLSL for a program to paste in.
 *
 * `mode` says which field the sample carries: `GLYPH_MODE_MSDF` takes the
 * median of R,G,B, `GLYPH_MODE_R8` reads `.r` alone. A caller whose fragment
 * is not a glyph at all still calls this and discards the result — see below.
 *
 * The antialiasing band has to be one *screen* pixel wide, so it is measured
 * from how fast the atlas moves under the fragment: `fieldPerUv` is how far
 * the field runs per unit of texture coordinate on each axis (see
 * `glyphFieldScale`), and the screen derivatives of `uv` turn that into field
 * units per screen pixel — one quantity folding in font size, zoom and DPR.
 *
 * Not `fwidth(field)`, which it was until 2026-09-29: that is the field's
 * slope only where the field is a straight ramp. Across a stem narrower than a
 * pixel — a 12px superscript's, minified 4x off the atlas — the two columns of
 * a 2x2 quad sample either side of the ridge at equal values, the derivative
 * reads flat, the band collapses to the floor, and the stem is thresholded
 * away. The derivative of `uv` is constant across a glyph quad, so it cannot
 * do that. Nor a constant band, which was 0.05 until 2026-07-29 and right at
 * one scale only. The `max()` floor keeps a degenerate derivative from
 * collapsing the band.
 *
 * **Nothing here branches, and the caller must not branch around it.**
 * A derivative in non-uniform control flow is undefined, so it has to
 * be taken before anything selects on paint mode. That is why a merged program
 * runs the glyph math on fragments that are not glyphs, and it is why the two
 * fields are selected with a `mix` rather than an `if`.
 *
 * `synthBold` shifts the threshold to thicken strokes where the resolver fell
 * back from a missing bold variant to the regular atlas.
 */
export const GLYPH_COVERAGE_GLSL = /* glsl */ `
float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

float glyphCoverage(vec4 texel, float mode, float synthBold, vec2 uv, vec2 fieldPerUv) {
  float field = mix(median(texel.r, texel.g, texel.b), texel.r, step(1.5, mode));
  float fieldPerPx = 0.5 * (length(dFdx(uv) * fieldPerUv) + length(dFdy(uv) * fieldPerUv));
  float aaW = max(0.5 * fieldPerPx, 0.0005);
  float threshold = 0.5 - synthBold;
  return smoothstep(threshold - aaW, threshold + aaW, field);
}
`;

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
  return [font.common.scaleW / range, font.common.scaleH / range];
}
