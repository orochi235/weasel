import { GLYPH_AREA_MARGIN } from '@weasel-js/font';

/**
 * `GLYPH_COVERAGE_GLSL` and `GLYPH_POINT_COVERAGE_GLSL` (`@weasel-js/font`'s
 * `textSdf.ts`) in WGSL, the same math under the same names. The area build
 * calls `fn glyphTap(uv: vec2f) -> vec4f`, which the program defines with
 * `textureSampleLevel`, since the taps run inside a branch on a derivative.
 * A caller must reach `glyphCoverage` in uniform control flow: it takes `dpdx`.
 */

/** `GLYPH_AREA_FROM` and `GLYPH_AREA_FULL`, which `@weasel-js/font` does not
 *  export; a test holds them to the GLSL's. */
export const GLYPH_AREA_FROM = 0.2;
export const GLYPH_AREA_FULL = 0.3;

const AREA_TAPS_WGSL = /* wgsl */ `
  let area = smoothstep(${GLYPH_AREA_FROM.toFixed(2)}, ${GLYPH_AREA_FULL.toFixed(2)}, fieldPerPx);
  if (area > 0.0) {
    let band = 0.5 * aaW;
    let lo = threshold - 0.5 * band;
    var sum = 0.0;
    var at = vec2f(-0.375, -0.125);
    for (var i = 0; i < 4; i++) {
      let tap = glyphField(glyphTap(uv + at.x * du + at.y * dv), mode);
      sum += saturate((tap - lo) / band) * glyphInCell(cell + at.x * dcx + at.y * dcy, margin);
      at = vec2f(-at.y, at.x);
    }
    coverage = mix(coverage, 0.25 * sum, area);
  }`;

const IN_CELL_WGSL = /* wgsl */ `
fn glyphInCell(c: vec2f, margin: vec2f) -> f32 {
  let inside = step(margin, c) * step(c, 1.0 - margin);
  return inside.x * inside.y;
}
`;

const CELL_MARGIN_WGSL = /* wgsl */ `
  let dcx = dpdx(cell);
  let dcy = dpdy(cell);
  let margin = ${GLYPH_AREA_MARGIN.toFixed(1)} * vec2f(length(vec2f(dcx.x, dcy.x)), length(vec2f(dcx.y, dcy.y)));`;

function glyphCoverageWgsl(area: boolean): string {
  return /* wgsl */ `
fn median(r: f32, g: f32, b: f32) -> f32 {
  return max(min(r, g), min(max(r, g), b));
}

fn glyphField(texel: vec4f, mode: f32) -> f32 {
  return mix(median(texel.r, texel.g, texel.b), texel.r, step(1.5, mode));
}
${area ? IN_CELL_WGSL : ''}
fn glyphCoverage(texel: vec4f, mode: f32, synthBold: f32, uv: vec2f, fieldPerUv: vec2f${area ? ', cell: vec2f' : ''}) -> f32 {
  let du = dpdx(uv);
  let dv = dpdy(uv);${area ? CELL_MARGIN_WGSL : ''}
  let fieldPerPx = 0.5 * (length(du * fieldPerUv) + length(dv * fieldPerUv));
  let aaW = max(0.5 * fieldPerPx, 0.0005);
  let threshold = 0.5 - synthBold;
  let field = glyphField(texel, mode);
  var coverage = smoothstep(threshold - aaW, threshold + aaW, field)${area ? ' * glyphInCell(cell, margin)' : ''};${area ? AREA_TAPS_WGSL : ''}
  return coverage;
}
`;
}

/** Glyph coverage with the area taps, for a program defining `glyphTap`. */
export const GLYPH_COVERAGE_WGSL = glyphCoverageWgsl(true);

/** Glyph coverage from the field at the pixel's center alone. */
export const GLYPH_POINT_COVERAGE_WGSL = glyphCoverageWgsl(false);
