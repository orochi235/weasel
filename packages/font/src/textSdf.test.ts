import { describe, it, expect } from 'vitest';
import { getFont, textureCacheKey, _resetFontRegistryForTests } from './registerFont';
import { registerTestFont } from './testing/registerTestFont';
import {
  GLYPH_AREA_FROM, GLYPH_AREA_FULL, GLYPH_COVERAGE_GLSL, GLYPH_POINT_COVERAGE_GLSL, GLYPH_MODE_MSDF, glyphNeedsArea, GLYPH_MODE_R8, SYNTH_BOLD_AMOUNT, glyphFieldScale, syntheticBoldGrowth,
} from './textSdf';
import { SDF_RADIUS } from './dynamic/dynamicAtlas';
import { BAKE_SIZE } from './dynamic/glyphRasterizer';

/**
 * Source-level assertions, because what this GLSL does needs a GL context and
 * a rasterizer to observe. The end-to-end guard is
 * `tests/visual/text-aa.spec.ts`, which renders in real Chrome and measures the
 * edge-coverage histogram; this file is the cheap unit-tier tripwire that fires
 * in `vitest` the moment someone reintroduces a constant AA width — or a branch
 * around the derivative.
 */
describe('glyph coverage — antialiasing', () => {
  it('derives its AA band from the screen derivatives of uv, not of the field', () => {
    // fwidth(field) reads flat across a stem narrower than a pixel and
    // thresholds it away; the browser half of this is glyphCoverage.browser.test.ts.
    expect(GLYPH_COVERAGE_GLSL).toMatch(/du\s*=\s*dFdx\(uv\)/);
    expect(GLYPH_COVERAGE_GLSL).toMatch(/dv\s*=\s*dFdy\(uv\)/);
    expect(GLYPH_COVERAGE_GLSL).toMatch(/length\(du\s*\*\s*fieldPerUv\)\s*\+\s*length\(dv\s*\*\s*fieldPerUv\)/);
    expect(GLYPH_COVERAGE_GLSL).not.toMatch(/fwidth\(field\)/);
  });

  it('centers the smoothstep on the threshold', () => {
    expect(GLYPH_COVERAGE_GLSL).toMatch(
      /smoothstep\(\s*threshold\s*-\s*aaW\s*,\s*threshold\s*\+\s*aaW\s*,\s*field\s*\)/,
    );
  });

  it('floors the band so a zero derivative cannot alias', () => {
    // The floor is the whole reason `max()` is there. Without it a flat field
    // (or a driver returning a zero derivative) collapses the smoothstep to a step,
    // which is exactly the hard-edged aliasing this exists to avoid.
    const floor = /aaW\s*=\s*max\([^,]*,\s*([0-9.]+)\)/.exec(GLYPH_COVERAGE_GLSL);
    expect(floor).not.toBeNull();
    expect(Number(floor![1])).toBeGreaterThan(0);
  });
});

describe('glyph coverage — no branch around the derivative', () => {
  /**
   * A derivative in non-uniform control flow is undefined, so a caller runs
   * this on every fragment and the field selection has to be arithmetic. A
   * derivative behind an `if` would compile, pass every unit test, and produce
   * driver-dependent edges on some machines and not others.
   */
  it('selects between the two field layouts without a conditional', () => {
    expect(GLYPH_COVERAGE_GLSL).toMatch(/mix\(median\(/);
    expect(GLYPH_COVERAGE_GLSL).not.toMatch(/\?/);
  });

  it('takes both derivatives before its one branch', () => {
    const branches = [...GLYPH_COVERAGE_GLSL.matchAll(/\bif\s*\(/g)];
    expect(branches).toHaveLength(1);
    const at = branches[0].index;
    expect(GLYPH_COVERAGE_GLSL.lastIndexOf('dFdx(')).toBeLessThan(at);
    expect(GLYPH_COVERAGE_GLSL.lastIndexOf('dFdy(')).toBeLessThan(at);
    expect(GLYPH_COVERAGE_GLSL).not.toMatch(/fwidth\(/);
  });

  it('samples inside that branch only through the program\'s glyphTap', () => {
    // texture() takes its level of detail from an implicit derivative; each
    // host's glyphTap is a textureLod, pinned in batchFill.test.ts and glyphPaint.test.ts.
    expect(GLYPH_COVERAGE_GLSL).not.toMatch(/\btexture(Lod|Grad)?\s*\(/);
    expect(GLYPH_COVERAGE_GLSL).toMatch(/glyphTap\(/);
  });

  it('splits the two layouts at a threshold between their mode values', () => {
    const step = /step\(\s*([0-9.]+)\s*,\s*mode\s*\)/.exec(GLYPH_COVERAGE_GLSL);
    expect(step).not.toBeNull();
    const at = Number(step![1]);
    expect(at).toBeGreaterThan(GLYPH_MODE_MSDF);
    expect(at).toBeLessThan(GLYPH_MODE_R8);
  });
});

describe('glyph coverage — area taps', () => {
  it('blends into area coverage over a range of field per pixel, in order', () => {
    expect(GLYPH_AREA_FROM).toBeGreaterThan(0);
    expect(GLYPH_AREA_FULL).toBeGreaterThan(GLYPH_AREA_FROM);
    expect(GLYPH_COVERAGE_GLSL).toContain(
      `smoothstep(${GLYPH_AREA_FROM.toFixed(2)}, ${GLYPH_AREA_FULL.toFixed(2)}, fieldPerPx)`,
    );
  });

  it('has a build without the taps that is otherwise the same', () => {
    expect(GLYPH_POINT_COVERAGE_GLSL).not.toMatch(/\bif\s*\(|glyphTap/);
    const taps = GLYPH_COVERAGE_GLSL.slice(GLYPH_COVERAGE_GLSL.indexOf('  float area'), GLYPH_COVERAGE_GLSL.indexOf('  return coverage;'));
    // Besides the taps, the area build reads the grown quad's cell (see GLYPH_AREA_MARGIN).
    const withoutCell = GLYPH_COVERAGE_GLSL.replace(taps, '')
      .replace(/\nfloat glyphInCell[\s\S]*?\n}\n/, '')
      .replace(', vec2 cell)', ')')
      .replace(/\n {2}vec2 dcx[^\n]*\n {2}vec2 dcy[^\n]*\n {2}vec2 margin[^\n]*/, '')
      .replace(' * glyphInCell(cell, margin)', '');
    expect(withoutCell).toBe(GLYPH_POINT_COVERAGE_GLSL);
  });

  it('tells a caller its glyphs need the taps from where the shader starts mixing them in', () => {
    // Inter's baked atlas: 512 texels wide, range 4, so 128 field units a unit
    // of u; 32 texels an em, so 1/16 of u is an em.
    const field = [128, 128] as const;
    const pxPerUv = (pxPerEm: number) => pxPerEm * 16;
    expect(glyphNeedsArea(field, pxPerUv(12), pxPerUv(12))).toBe(true);
    expect(glyphNeedsArea(field, pxPerUv(40), pxPerUv(40))).toBe(true);
    expect(glyphNeedsArea(field, pxPerUv(48), pxPerUv(48))).toBe(false);
  });

  it('puts 16px text and smaller at DPR 1 wholly in area coverage, on either atlas', () => {
    // Field per pixel is field units an em over pixels an em: 6 on a runtime
    // canvas page, 8 on Inter's baked atlas (32 texels an em, range 4).
    const canvasPerEm = BAKE_SIZE / SDF_RADIUS;
    expect(canvasPerEm / 16).toBeGreaterThanOrEqual(GLYPH_AREA_FULL);
    expect(32 / 4 / 16).toBeGreaterThanOrEqual(GLYPH_AREA_FULL);
  });
});

describe('glyphFieldScale', () => {
  it('scales a runtime canvas page by its size over the bake radius', () => {
    expect(glyphFieldScale('canvas', 'Anything', 400, 'normal')).toEqual([128, 128]);
  });

  it('answers undefined for an atlas nobody registered', () => {
    expect(glyphFieldScale('atlas', 'never-registered', 400, 'normal')).toBeUndefined();
  });

  it('answers each of two atlases with its own scale, back and forth', async () => {
    // The last answer is kept, so switching back has to be told apart from it.
    _resetFontRegistryForTests();
    await registerTestFont('fs-a');
    await registerTestFont('fs-b');
    const b = getFont('fs-b', 400, 'normal')!.font;
    b.common = { ...b.common, scaleW: b.common.scaleW * 2 };
    const a = glyphFieldScale('atlas', 'fs-a', 400, 'normal')!;
    expect(glyphFieldScale('atlas', 'fs-a', 400, 'normal')).toEqual(a);
    expect(glyphFieldScale('atlas', 'fs-b', 400, 'normal')).toEqual([a[0] * 2, a[1]]);
    expect(glyphFieldScale('atlas', 'fs-a', 400, 'normal')).toEqual(a);
  });
});

describe('textureCacheKey', () => {
  it('names each variant apart, back and forth', () => {
    expect(textureCacheKey('inter', 400, 'normal')).toBe('inter|400|normal');
    expect(textureCacheKey('inter', 400, 'normal')).toBe('inter|400|normal');
    expect(textureCacheKey('inter', 700, 'normal')).toBe('inter|700|normal');
    expect(textureCacheKey('inter', 700, 'italic')).toBe('inter|700|italic');
    expect(textureCacheKey('mono', 700, 'italic')).toBe('mono|700|italic');
    expect(textureCacheKey('inter', 400, 'normal')).toBe('inter|400|normal');
  });
});

describe('syntheticBoldGrowth', () => {
  it('moves a canvas glyph\'s edge by the shift across the bake radius, per em of bake', () => {
    // Field 0.5 at the edge, falling 1 per SDF_RADIUS texels; BAKE_SIZE texels to the em.
    expect(syntheticBoldGrowth('canvas', 'Anything', 700, 'normal'))
      .toBeCloseTo((SYNTH_BOLD_AMOUNT * SDF_RADIUS) / BAKE_SIZE, 12);
  });

  it('answers undefined for an atlas nobody registered', () => {
    expect(syntheticBoldGrowth('atlas', 'never-registered', 700, 'normal')).toBeUndefined();
  });
});
