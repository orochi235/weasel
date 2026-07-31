import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  registerCanvasFont, isCanvasFont, unregisterCanvasFont, getDynamicFace,
  autoEnrollCanvasFont, listCanvasFonts,
  _resetDynamicFontsForTests, __setGlyphRasterizerForTests,
  PAGE_SIZE, _getPagesForTests,
  resetBakeBudget, subscribeGlyphReady,
} from './dynamicAtlas';
import type { FontFallbackPolicy } from '../fallback';
import { setFontFallbackPolicy, _resetFallbackForTests } from '../fallback';
import { BAKE_SIZE, type GlyphRasterizer } from './glyphRasterizer';

const ALL_POLICIES: readonly FontFallbackPolicy[] = ['substitute', 'canvas', 'none'];

/** Deterministic fake: every glyph is a solid 20×24 box; space is blank. */
function fakeRasterizer(): GlyphRasterizer {
  return {
    faceMetrics: () => ({ ascent: 40, descent: 8 }),
    rasterize: (_family, _weight, _style, cp) => {
      if (cp === 32) {
        return { width: 0, height: 0, alpha: new Uint8ClampedArray(0), left: 0, top: 0, advance: 12 };
      }
      const w = 20, h = 24;
      return {
        width: w, height: h,
        alpha: new Uint8ClampedArray(w * h).fill(255),
        left: -8, top: 26, advance: 22,
      };
    },
  };
}

beforeEach(() => {
  _resetDynamicFontsForTests();
  // isCanvasFont reads the fallback policy, which is process-global module
  // state: a policy another test file left behind would change its answers.
  _resetFallbackForTests();
  __setGlyphRasterizerForTests(fakeRasterizer());
});
afterEach(() => vi.restoreAllMocks());

describe('canvas font registry', () => {
  it('register/is/unregister round-trips', () => {
    expect(isCanvasFont('Futura')).toBe(false);
    registerCanvasFont('Futura');
    expect(isCanvasFont('Futura')).toBe(true);
    unregisterCanvasFont('Futura');
    expect(isCanvasFont('Futura')).toBe(false);
  });
});

describe('listCanvasFonts enumerates what the dynamic tier will serve', () => {
  it('lists explicitly registered families with their provenance', () => {
    registerCanvasFont('Impact');
    registerCanvasFont('Georgia');
    expect(listCanvasFonts()).toEqual([
      { family: 'Georgia', enrollment: 'explicit' },
      { family: 'Impact', enrollment: 'explicit' },
    ]);
  });

  it('is empty before anything is enrolled', () => {
    expect(listCanvasFonts()).toEqual([]);
  });

  it('drops an unregistered family', () => {
    registerCanvasFont('Impact');
    unregisterCanvasFont('Impact');
    expect(listCanvasFonts()).toEqual([]);
  });

  it('reports service, not membership — same rule as isCanvasFont', () => {
    setFontFallbackPolicy('canvas');
    autoEnrollCanvasFont('Helvetica Neue');
    registerCanvasFont('Georgia');
    expect(listCanvasFonts()).toEqual([
      { family: 'Georgia', enrollment: 'explicit' },
      { family: 'Helvetica Neue', enrollment: 'auto' },
    ]);

    // The auto-enrolled one stops being served when the policy changes; the
    // explicit one outranks every policy.
    setFontFallbackPolicy('substitute');
    expect(listCanvasFonts()).toEqual([{ family: 'Georgia', enrollment: 'explicit' }]);
  });

  it('agrees with isCanvasFont for every enrolled family', () => {
    setFontFallbackPolicy('canvas');
    autoEnrollCanvasFont('Helvetica Neue');
    registerCanvasFont('Georgia');
    for (const policy of ALL_POLICIES) {
      setFontFallbackPolicy(policy);
      const listed = listCanvasFonts().map((c) => c.family);
      for (const family of ['Helvetica Neue', 'Georgia']) {
        expect(listed.includes(family), `${family} under ${policy}`).toBe(isCanvasFont(family));
      }
    }
  });
});

describe('isCanvasFont answers "served right now", not "enrolled"', () => {
  it('reports an explicitly registered family under every policy', () => {
    registerCanvasFont('Futura');
    for (const policy of ALL_POLICIES) {
      setFontFallbackPolicy(policy);
      expect(isCanvasFont('Futura'), `policy ${policy}`).toBe(true);
    }
  });

  it('reports an auto-enrolled family only while the policy is canvas', () => {
    // Enrollment happens under 'canvas'; the family is only actually served
    // by the dynamic tier for as long as that policy stays in force.
    setFontFallbackPolicy('canvas');
    autoEnrollCanvasFont('Helvetica Neue');
    expect(isCanvasFont('Helvetica Neue')).toBe(true);

    setFontFallbackPolicy('substitute');
    expect(isCanvasFont('Helvetica Neue')).toBe(false);

    setFontFallbackPolicy('none');
    expect(isCanvasFont('Helvetica Neue')).toBe(false);

    // …and comes back when the policy does: the enrollment lapses, it is not
    // discarded.
    setFontFallbackPolicy('canvas');
    expect(isCanvasFont('Helvetica Neue')).toBe(true);
  });

  it('reports an auto-enrolled family promoted to explicit under every policy', () => {
    setFontFallbackPolicy('canvas');
    autoEnrollCanvasFont('Helvetica Neue');
    registerCanvasFont('Helvetica Neue');

    for (const policy of ALL_POLICIES) {
      setFontFallbackPolicy(policy);
      expect(isCanvasFont('Helvetica Neue'), `policy ${policy}`).toBe(true);
    }
  });

  it('reports false for a family that was never enrolled, even under canvas', () => {
    setFontFallbackPolicy('canvas');
    // The 'canvas' policy enrolls families lazily, on first miss. Answering
    // true for anything at all under this policy would make the query useless.
    expect(isCanvasFont('Never Asked For')).toBe(false);
  });
});

describe('getDynamicFace', () => {
  it('builds a BmFont-shaped face from canvas metrics', () => {
    const face = getDynamicFace('Futura', 400, 'normal');
    expect(face.font.info.size).toBe(BAKE_SIZE);
    expect(face.font.common.base).toBe(40);
    expect(face.font.common.lineHeight).toBe(48);
    expect(face.font.common.scaleW).toBe(PAGE_SIZE);
    expect(face.font.common.scaleH).toBe(PAGE_SIZE);
    expect(face.font.charMap.size).toBe(0);
  });

  it('caches faces per (family, weight, style)', () => {
    const a = getDynamicFace('Futura', 400, 'normal');
    expect(getDynamicFace('Futura', 400, 'normal')).toBe(a);
    expect(getDynamicFace('Futura', 700, 'normal')).not.toBe(a);
  });
});

describe('requestGlyph', () => {
  it('measures and bakes a glyph synchronously', () => {
    const face = getDynamicFace('Futura', 400, 'normal');
    const ch = face.requestGlyph(65);
    expect(ch.xadvance).toBe(22);
    expect(ch.xoffset).toBe(-8);
    expect(ch.yoffset).toBe(40 - 26); // base − top
    expect(ch.width).toBe(20);
    expect(ch.height).toBe(24);
    expect(ch.page).toBe(0);
    expect(face.requestGlyph(65)).toBe(ch); // cached record
  });

  it('writes SDF bytes into the page and logs a patch', () => {
    const face = getDynamicFace('Futura', 400, 'normal');
    const ch = face.requestGlyph(65);
    const pages = _getPagesForTests();
    expect(pages.length).toBe(1);
    expect(pages[0].version).toBe(1);
    expect(pages[0].patches).toEqual([{ seq: 1, x: ch.x, y: ch.y, w: 20, h: 24 }]);
    // Solid-alpha input → interior of the glyph rect saturates high.
    const centerIdx = (ch.y + 12) * PAGE_SIZE + ch.x + 10;
    expect(pages[0].data[centerIdx]).toBeGreaterThan(200);
  });

  it('handles blank glyphs (space) without allocating atlas space', () => {
    const face = getDynamicFace('Futura', 400, 'normal');
    const ch = face.requestGlyph(32);
    expect(ch.xadvance).toBe(12);
    expect(ch.width).toBe(0);
    expect(ch.page).toBe(0); // marked done, never queued
    expect(_getPagesForTests().length).toBe(0);
  });

  it('leaves the glyph invisible (width 0) when pages are full', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({
        width: PAGE_SIZE, height: PAGE_SIZE,
        alpha: new Uint8ClampedArray(PAGE_SIZE * PAGE_SIZE).fill(255),
        left: 0, top: 0, advance: PAGE_SIZE,
      }),
    });
    const face = getDynamicFace('Big', 400, 'normal');
    for (let i = 0; i < 4; i++) expect(face.requestGlyph(65 + i).page).toBe(i);
    const fifth = face.requestGlyph(70);
    expect(fifth.page).toBe(-1);
    expect(fifth.width).toBe(0);
    expect(fifth.xadvance).toBe(PAGE_SIZE); // advance still valid
  });
});

describe('unregisterCanvasFont', () => {
  it('drops the family faces but keeps baked pages (no eviction)', () => {
    registerCanvasFont('Futura');
    const face = getDynamicFace('Futura', 400, 'normal');
    face.requestGlyph(65);
    unregisterCanvasFont('Futura');
    expect(getDynamicFace('Futura', 400, 'normal')).not.toBe(face);
    expect(_getPagesForTests().length).toBe(1);
  });
});

describe('bake budget and overflow queue', () => {
  it('bakes N within budget now, K after the deferred flush, and notifies', () => {
    vi.useFakeTimers();
    try {
      const notified = vi.fn();
      const unsub = subscribeGlyphReady(notified);
      resetBakeBudget(2);
      const face = getDynamicFace('Futura', 400, 'normal');
      const chars = [65, 66, 67, 68, 69].map((cp) => face.requestGlyph(cp));

      // N=2 baked synchronously, K=3 queued.
      expect(chars.filter((c) => c.page >= 0).length).toBe(2);
      expect(chars.filter((c) => c.page === -1).length).toBe(3);
      // Advances are valid immediately even for queued glyphs.
      for (const c of chars) expect(c.xadvance).toBe(22);
      expect(notified).not.toHaveBeenCalled();

      vi.runAllTimers();
      expect(chars.every((c) => c.page >= 0)).toBe(true);
      expect(notified).toHaveBeenCalled();
      unsub();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Infinity budget never defers (headless print path)', () => {
    vi.useFakeTimers();
    try {
      resetBakeBudget(Infinity);
      const face = getDynamicFace('Futura', 400, 'normal');
      const chars: number[] = [];
      for (let cp = 33; cp < 33 + 50; cp++) chars.push(face.requestGlyph(cp).page);
      expect(chars.every((p) => p >= 0)).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('unsubscribe stops notifications', () => {
    vi.useFakeTimers();
    try {
      const notified = vi.fn();
      const unsub = subscribeGlyphReady(notified);
      unsub();
      resetBakeBudget(0);
      getDynamicFace('Futura', 400, 'normal').requestGlyph(65);
      vi.runAllTimers();
      expect(notified).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
