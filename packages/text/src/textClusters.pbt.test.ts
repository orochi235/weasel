/**
 * `textClusters` over mixed-script text: one cluster per grapheme of the first line as `Intl.Segmenter` reads
 * it, the slots tiling the line from its start, and every outline and rule finite and inside its slot's frame.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { registerFontOutlines, loadFontOutlines, type OutlineFace } from '@weasel-js/font';
import { _resetFontOutlinesForTests, _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { bidi } from '@weasel-js/bidi';
import { textClusters } from './textClusters';
import { layoutTextPose } from './layout/textPoseLayout';
import { registerBidi } from './layout/bidiRegistry';
import { mixedText, runs, segmenterEnds, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;

/** A bar for every code point, narrower for Hebrew, none for a combining mark. */
const BARS: OutlineFace = {
  unitsPerEm: 1000,
  ascender: 0.8,
  advanceOf: (cp) => (/\p{Mn}/u.test(String.fromCodePoint(cp)) ? 0 : cp >= 0x590 && cp < 0x600 ? 0.3 : 0.6),
  kernOf: (a, b) => (a === 65 && b === 66 ? -0.05 : 0),
  glyphD: () => 'M0 -0.5L0.2 -0.5L0.2 0L0 0Z',
};

beforeAll(async () => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  registerFontOutlines('bars', {}, new ArrayBuffer(4), { parser: () => BARS });
  await loadFontOutlines('bars');
});
afterEach(() => { registerBidi(null); });

const INK = { paint: { kind: 'solid', color: '#000' } } as const;
/** No color glyphs: they keep a slot but would need a rasterizer. */
const noEmoji = (t: string) => t.replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}⃣️]/gu, 'x');

const source = fc.record({
  text: mixedText(12).map(noEmoji),
  fontSize: fc.constantFrom(20, 100),
  letterSpacing: fc.constantFrom(0, 3, -2),
  underline: fc.boolean(),
  withBidi: fc.boolean(),
});

describe('textClusters, property', () => {
  it('gives one cluster per grapheme of the first line, tiling it from its start, all finite', () => {
    const t = tally();
    fc.assert(fc.property(source, ({ text, fontSize, letterSpacing, underline, withBidi }) => {
      registerBidi(withBidi ? bidi : null);
      const style = { fontFamily: 'bars', fontSize, letterSpacing, underline };
      const data = { text, style, fill: INK };
      const cs = textClusters(data);
      const first = text.split(/\r\n|[\n\r\u000b\u000c\u0085\u2028\u2029]/u)[0]!;
      expect(cs.length, JSON.stringify(text)).toBe(segmenterEnds(first).length);
      if (cs.length === 0) return;
      const line = layoutTextPose({ x: 0, y: 0, width: 1e6, height: 0, text, style, fill: INK }).laid.lines[0]!;
      expect(cs[0]!.x).toBeCloseTo(0, 6);
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i]!;
        for (const v of [c.x, c.advance, c.middle]) expect(Number.isFinite(v)).toBe(true);
        if (i + 1 < cs.length) expect(cs[i + 1]!.x).toBeCloseTo(c.x + c.advance, 6);
        for (const p of c.paths) for (const v of p.path.coords) expect(Number.isFinite(v)).toBe(true);
        for (const r of c.rules) {
          expect(r.x0).toBeGreaterThanOrEqual(-1e-6);
          expect(r.x1).toBeLessThanOrEqual(c.advance + 1e-6);
          expect(r.x1).toBeGreaterThan(r.x0);
          expect(r.y1).toBeGreaterThan(r.y0);
        }
      }
      const last = cs[cs.length - 1]!;
      expect(last.x + last.advance).toBeCloseTo(line.x1 - line.x0, 6);
      if (cs.length > 3 && withBidi && /[֐-ۿ]/u.test(first)) t.count('rtl');
      if (cs.some((c) => c.rules.length > 0)) t.count('ruled');
    }), runs(RUNS));
    t.atLeast('rtl', 10);
    t.atLeast('ruled', 30);
  }, timeoutFor(RUNS, 20));

  it('hands back the same clusters for the same data, and new ones for another width', () => {
    fc.assert(fc.property(source, ({ text, fontSize }) => {
      const data = { text, style: { fontFamily: 'bars', fontSize, wrap: true }, fill: INK };
      const a = textClusters(data, { width: 1e6 });
      expect(textClusters(data, { width: 1e6 })).toBe(a);
      const narrow = textClusters(data, { width: fontSize });
      expect(narrow.length).toBeLessThanOrEqual(a.length);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 20));

  it('keeps visual order and opens at the line start under tracking tighter than an advance (shrunk counterexamples)', () => {
    // A lone mark has no advance, so tracking sets the A after it left of it; an alef and its mark set a pen
    // before the line's start.
    for (const [text, withBidi] of [['\u0301A', false], ['\u0627\u064b', true]] as const) {
      registerBidi(withBidi ? bidi : null);
      const cs = textClusters({ text, style: { fontFamily: 'bars', fontSize: 20, letterSpacing: -2 }, fill: INK });
      expect(cs[0]!.x).toBe(0);
      if (!withBidi) expect(cs[0]!.advance).toBeCloseTo(-2, 9);
    }
  });
});

