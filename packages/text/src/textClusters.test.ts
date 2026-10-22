/**
 * `textClusters` against the bundled Inter subset, the face `textToPath.test.ts`
 * reads, so kerning and the x-height are a real font's.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerFontOutlines, loadFontOutlines, type OutlineFace } from '@weasel-js/font';
import {
  _resetFontRegistryForTests, _resetFontOutlinesForTests, _resetDynamicFontsForTests, __setGlyphRasterizerForTests,
} from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { bidi } from '@weasel-js/bidi';
import { boundsOfPath } from '@weasel-js/geom';
import { layoutTextPose, registerBidi } from '@weasel-js/text';
import { textClusters, type TextCluster } from './textClusters';
import { textToPath, TextOutlinesError, type TextOutlineSource } from './textToPath';

const INTER = resolve(import.meta.dirname, '../../../assets/fonts/inter');

function ttf(): ArrayBuffer {
  return new Uint8Array(readFileSync(`${INTER}/inter.ttf`)).buffer;
}

const INK = { paint: { kind: 'solid', color: '#000' } } as const;

const text = (s: string, family = 'outline-inter'): TextOutlineSource => ({
  text: s, style: { fontFamily: family, fontSize: 100 }, fill: INK,
});

function lineWidth(src: TextOutlineSource): number {
  const { laid } = layoutTextPose({ x: 0, y: 0, width: 1e6, height: 0, text: src.text, style: src.style, fill: INK });
  return laid.lines[0].x1 - laid.lines[0].x0;
}

function inkBounds(c: TextCluster) {
  return c.paths.map((p) => boundsOfPath(p.path));
}

/** A face with a narrow alef and a bar for every other code point. */
const ALL: OutlineFace = {
  unitsPerEm: 1000,
  ascender: 0.8,
  advanceOf: (cp) => (cp === 0x5d0 ? 0.3 : 0.6),
  kernOf: () => 0,
  glyphD: () => 'M0 -0.5L0.2 -0.5L0.2 0L0 0Z',
};

async function registerAll(): Promise<void> {
  registerFontOutlines('all', {}, new ArrayBuffer(4), { parser: () => ALL });
  await loadFontOutlines('all');
}

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
  registerFontOutlines('outline-inter', {}, ttf());
  await loadFontOutlines('outline-inter');
});
afterEach(() => { registerBidi(null); });

describe('textClusters', () => {
  it('one cluster per grapheme, advances summing to the line', () => {
    const src = text('AVA');
    const cs = textClusters(src);
    expect(cs).toHaveLength(3);
    for (let i = 0; i + 1 < cs.length; i++) {
      expect(cs[i + 1].x).toBeGreaterThan(cs[i].x);
      expect(cs[i + 1].x).toBeCloseTo(cs[i].x + cs[i].advance, 6);
    }
    const sum = cs.reduce((s, c) => s + c.advance, 0);
    expect(sum).toBeCloseTo(lineWidth(src), 6);
    const [lone] = textClusters(text('A'));
    expect(cs[0].advance).not.toBeCloseTo(lone.advance, 3);
  });

  it('a combining mark stays with its base', async () => {
    // The Inter subset has no combining marks.
    await registerAll();
    expect(textClusters(text('e\u0301x', 'all'))).toHaveLength(2);
  });

  it('a space is a cluster with no paths', () => {
    const cs = textClusters(text('a b'));
    expect(cs).toHaveLength(3);
    expect(cs[1].paths).toEqual([]);
    expect(cs[1].advance).toBeGreaterThan(0);
  });

  it('glyphs sit on the baseline at the slot\'s left', () => {
    const cs = textClusters(text('Hx'));
    for (const c of cs) {
      expect(c.paths.length).toBeGreaterThan(0);
      for (const b of inkBounds(c)) {
        expect(b.x).toBeGreaterThanOrEqual(-1);
        expect(b.x + b.width).toBeLessThanOrEqual(c.advance + 1);
      }
    }
    const [x] = inkBounds(cs[1]);
    expect(x.y + x.height).toBeCloseTo(0, 1);
    expect(cs[1].paths[0].fill).toEqual(INK);
  });

  it('puts the middle at half the face\'s x-height', () => {
    const [c] = textClusters(text('x'));
    const [b] = inkBounds(c);
    // Inter's x of ~0.55 em, measured against its own ink.
    expect(c.middle).toBeCloseTo(b.height / 2, 0);
  });

  it('only the first line', () => {
    expect(textClusters(text('ab\ncd'))).toHaveLength(2);
  });

  it('right-to-left text comes in visual order', async () => {
    await registerAll();
    registerBidi(bidi);
    // Logically alef, bet, gimel: alef, the narrow one, lands at the right.
    const cs = textClusters(text('אבג', 'all'));
    expect(cs).toHaveLength(3);
    expect(cs[0].x).toBeLessThan(cs[1].x);
    expect(cs[1].x).toBeLessThan(cs[2].x);
    expect(cs[2].advance).toBeCloseTo(30, 6);
    expect(cs[0].advance).toBeCloseTo(60, 6);
  });

  it('a color glyph keeps its slot and paints nothing', () => {
    _resetDynamicFontsForTests();
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({ width: 0, height: 0, alpha: new Uint8ClampedArray(0), left: 0, top: 0, advance: 22 }),
      rasterizeColor: () => ({
        width: 60, height: 60, rgba: new Uint8ClampedArray(60 * 60 * 4).fill(255), left: -6, top: 50, advance: 48,
      }),
    });
    try {
      const cs = textClusters(text('H\u{1F600}'));
      expect(cs).toHaveLength(2);
      expect(cs[1].paths).toEqual([]);
      expect(cs[1].advance).toBeGreaterThan(0);
    } finally {
      _resetDynamicFontsForTests();
    }
  });

  it('a multi-code-point color cluster paints none of its code points', () => {
    _resetDynamicFontsForTests();
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({ width: 0, height: 0, alpha: new Uint8ClampedArray(0), left: 0, top: 0, advance: 22 }),
      rasterizeColor: () => ({
        width: 60, height: 60, rgba: new Uint8ClampedArray(60 * 60 * 4).fill(255), left: -6, top: 50, advance: 48,
      }),
    });
    try {
      // Keycap one: the color glyph sits on U+20E3, and the face has a '1'.
      const cs = textClusters(text('H1\uFE0F\u20E3'));
      expect(cs).toHaveLength(2);
      expect(cs[1].paths).toEqual([]);
      expect(cs[1].advance).toBeGreaterThan(0);
    } finally {
      _resetDynamicFontsForTests();
    }
  });

  it('a glyph a fallback face with no outlines draws keeps its slot and paints nothing', () => {
    _resetDynamicFontsForTests();
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({
        width: 20, height: 20, alpha: new Uint8ClampedArray(20 * 20).fill(255), left: 0, top: 20, advance: 22,
      }),
    });
    try {
      // The Inter subset has no arrow, so the system fallback rasterizes it.
      const src = text('H→H');
      expect(() => textToPath(src, { x: 0, y: 0, width: 1e6, height: 0 })).toThrow(TextOutlinesError);
      const cs = textClusters(src);
      expect(cs).toHaveLength(3);
      expect(cs[1].paths).toEqual([]);
      expect(cs[1].advance).toBeGreaterThan(0);
      expect(cs[0].paths).toHaveLength(1);
      expect(cs[2].paths).toHaveLength(1);
    } finally {
      _resetDynamicFontsForTests();
    }
  });

  it('lays out at the given width, so a wrapping style keeps its first wrapped line', () => {
    const src: TextOutlineSource = {
      text: 'ab cd', style: { fontFamily: 'outline-inter', fontSize: 100, wrap: true }, fill: INK,
    };
    expect(textClusters(src)).toHaveLength(5);
    const narrow = textClusters(src, { width: 150 });
    expect(narrow.map((c) => c.paths.length > 0)).toEqual([true, true, false]);
  });

  it('sizes a small capital and its middle by the glyph\'s own size', () => {
    const style = { fontFamily: 'outline-inter', fontSize: 100, fontVariantCaps: 'small-caps' as const };
    const [big, small] = textClusters({ text: 'Xx', style, fill: INK });
    const ratio = small.middle / big.middle;
    expect(ratio).toBeLessThan(0.95);
    const h = (c: TextCluster) => inkBounds(c)[0].height;
    expect(h(small) / h(big)).toBeCloseTo(ratio, 2);
  });

  it('keeps a run\'s baseline shift in its ink', () => {
    const [x] = textClusters({
      text: 'x', runs: [{ text: 'x', baselineShift: 0.2 }],
      style: { fontFamily: 'outline-inter', fontSize: 100 }, fill: INK,
    });
    const [b] = inkBounds(x);
    expect(b.y + b.height).toBeCloseTo(-20, 1);
  });

  it('names itself in the errors it throws', () => {
    expect(() => textClusters(text('H', 'nowhere'))).toThrow(/^textClusters: /);
  });

  it('throws as textToPath does for a face with no outlines', () => {
    expect(() => textClusters(text('H', 'nowhere'))).toThrow(TextOutlinesError);
  });
});
