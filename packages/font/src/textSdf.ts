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
 * The antialiasing band has to be one *screen* pixel wide, so it comes from
 * `fwidth` of the field rather than from a constant: that single quantity
 * folds in font size, zoom and DPR at once. Minify the glyph and the field
 * changes faster between neighboring fragments, so the band widens in field
 * units to stay one pixel on screen; magnify it and the band narrows. A
 * constant band cannot be right at more than one scale, and this was one
 * (0.05) until 2026-07-29 — at 16px it fell well under a pixel and edges
 * quantized to stair-steps, while display sizes read mushy. The `max()` floor
 * keeps a degenerate derivative — a flat field, or a driver answering 0 — from
 * collapsing the band back to that.
 *
 * **Nothing here branches, and the caller must not branch around it.**
 * `fwidth` in non-uniform control flow is undefined, so the derivative has to
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

float glyphCoverage(vec4 texel, float mode, float synthBold) {
  float field = mix(median(texel.r, texel.g, texel.b), texel.r, step(1.5, mode));
  float aaW = max(0.5 * fwidth(field), 0.0005);
  float threshold = 0.5 - synthBold;
  return smoothstep(threshold - aaW, threshold + aaW, field);
}
`;
