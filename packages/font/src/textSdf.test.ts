import { describe, it, expect } from 'vitest';
import { GLYPH_COVERAGE_GLSL, GLYPH_MODE_MSDF, GLYPH_MODE_R8 } from './textSdf';

/**
 * Source-level assertions, because what this GLSL does needs a GL context and
 * a rasterizer to observe. The end-to-end guard is
 * `tests/visual/text-aa.spec.ts`, which renders in real Chrome and measures the
 * edge-coverage histogram; this file is the cheap unit-tier tripwire that fires
 * in `vitest` the moment someone reintroduces a constant AA width — or a branch
 * around the derivative.
 */
describe('glyph coverage — antialiasing', () => {
  it('derives its AA band from fwidth()', () => {
    expect(GLYPH_COVERAGE_GLSL).toMatch(/aaW\s*=\s*max\(\s*0\.5\s*\*\s*fwidth\(field\)/);
  });

  it('centers the smoothstep on the threshold', () => {
    expect(GLYPH_COVERAGE_GLSL).toMatch(
      /smoothstep\(\s*threshold\s*-\s*aaW\s*,\s*threshold\s*\+\s*aaW\s*,\s*field\s*\)/,
    );
  });

  it('floors the band so a zero derivative cannot alias', () => {
    // The floor is the whole reason `max()` is there. Without it a flat field
    // (or a driver returning fwidth === 0) collapses the smoothstep to a step,
    // which is exactly the hard-edged aliasing this exists to avoid.
    const floor = /max\([^)]*fwidth\(field\)\s*,\s*([0-9.]+)\)/.exec(GLYPH_COVERAGE_GLSL);
    expect(floor).not.toBeNull();
    expect(Number(floor![1])).toBeGreaterThan(0);
  });

  it('declares no constant AA-width uniform', () => {
    // Regression guard: `u_aaWidth` was a CPU-set constant (0.05), which is
    // correct at exactly one combination of font size, zoom, and DPR.
    expect(GLYPH_COVERAGE_GLSL).not.toMatch(/u_aaWidth/);
  });
});

describe('glyph coverage — no branch around the derivative', () => {
  /**
   * `fwidth` in non-uniform control flow is undefined, so a caller runs this on
   * every fragment and the field selection has to be arithmetic. An `if` here
   * would compile, pass every unit test, and produce driver-dependent edges on
   * some machines and not others.
   */
  it('selects between the two field layouts without a conditional', () => {
    expect(GLYPH_COVERAGE_GLSL).toMatch(/mix\(median\(/);
    expect(GLYPH_COVERAGE_GLSL).not.toMatch(/\bif\s*\(/);
    expect(GLYPH_COVERAGE_GLSL).not.toMatch(/\?/);
  });

  it('splits the two layouts at a threshold between their mode values', () => {
    const step = /step\(\s*([0-9.]+)\s*,\s*mode\s*\)/.exec(GLYPH_COVERAGE_GLSL);
    expect(step).not.toBeNull();
    const at = Number(step![1]);
    expect(at).toBeGreaterThan(GLYPH_MODE_MSDF);
    expect(at).toBeLessThan(GLYPH_MODE_R8);
  });
});
