import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { FIXTURE_FONT } from './FontAtlas';
import { __setGlyphRasterizerForTests, registerCanvasFont, _resetDynamicFontsForTests } from './dynamic/dynamicAtlas';
import { setFontFallbackPolicy, _resetFallbackForTests, type FontFallbackPolicy } from './fallback';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { resolveFontVariant, _resetFontRegistryForTests } from './registerFont';
import { resolveGlyph, type ResolvedGlyph } from './resolveGlyph';
import { registerTestFont } from './testing/registerTestFont';

const RUNS = 200;
/** Code points the fake rasterizer draws nothing for: the dynamic tier has no glyph for them. */
const BLANK = new Set([0xe000, 0x200d]);

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFallbackForTests();
  _resetDynamicFontsForTests();
  __setGlyphRasterizerForTests({
    faceMetrics: () => ({ ascent: 40, descent: 8 }),
    rasterize: (_f, _w, _s, cp) => BLANK.has(cp)
      ? { width: 0, height: 0, alpha: new Uint8ClampedArray(0), left: 0, top: 0, advance: 0 }
      : { width: 4, height: 4, alpha: new Uint8ClampedArray(16).fill(255), left: 0, top: 4, advance: 5 + (cp % 7) },
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  await registerTestFont('inter');
});
afterEach(() => vi.restoreAllMocks());

const cp = fc.oneof(fc.constantFrom(...FIXTURE_FONT.chars.map((c) => c.id)), fc.integer({ min: 0x20, max: 0x7e }), fc.constantFrom(...BLANK), fc.integer({ min: 0x80, max: 0x2fff }));
const policy = fc.constantFrom<FontFallbackPolicy>('substitute', 'canvas', 'none');
const family = fc.constantFrom('inter', 'Nowhere Sans', 'Canvas Serif');

describe('resolveGlyph, property', () => {
  it('measures a glyph by the metrics of the tier serving it, the same with or without a record to fill', () => {
    const t = tally();
    fc.assert(fc.property(policy, family, fc.array(cp, { minLength: 1, maxLength: 10 }), (p, f, cps) => {
      setFontFallbackPolicy(p);
      if (f === 'Canvas Serif') registerCanvasFont(f);
      const resolved = resolveFontVariant(f, 400, 'normal');
      const into = {} as ResolvedGlyph;
      for (const c of cps) {
        const got = resolveGlyph(resolved, f, 400, 'normal', c, false);
        const filled = resolveGlyph(resolved, f, 400, 'normal', c, false, into);
        if (!got) { expect(filled).toBeNull(); t.count('miss'); continue; }
        expect(filled).toBe(into);
        expect({ ...filled }).toEqual(got);
        expect(got.advance).toBe(got.metrics.advanceOf(c));
        expect(got.glyph?.id ?? c).toBe(c);
        t.count(got.resolved.dynamicFace ? 'dynamic' : got.resolved === resolved ? 'own' : 'escalated');
      }
    }), runs(RUNS));
    t.atLeast('own', 50);
    t.atLeast('dynamic', 50);
    t.atLeast('miss', 20);
  }, timeoutFor(RUNS, 5));
});
