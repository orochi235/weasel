/**
 * Measuring a row's text where nothing measures it, and through a 2D context. `estimatedWidth` gives every character
 * a glyph and its tracking, a character being a code point as the tracking already counts it; `capCenterFrom` scales
 * with the size; `canvasMeasure` adds the tracking to what the context reports, sets the font the style names, and
 * reports a finite `capCenter` read from a capital H at any size, 0 included.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { RowTextStyle } from './body';
import { nonFinite, runs, timeoutFor } from './pbt.fixture';
import { FALLBACK_LINE, GLYPH, canvasMeasure, capCenterFrom, estimatedWidth, trackingWidth, weightOf } from './rowMeasure';

const RUNS = 400;

const text = fc.oneof(fc.string(), fc.string({ unit: 'grapheme' }), fc.string({ unit: 'binary' }), fc.constantFrom('', '😀', 'a😀b', '\uD83D', 'é'));
const style: fc.Arbitrary<RowTextStyle> = fc.record({
  fontSize: fc.oneof(fc.integer({ min: 0, max: 72 }), fc.double({ min: 0, max: 200, noNaN: true })),
  tracking: fc.oneof(fc.constant(0), fc.double({ min: -0.2, max: 0.5, noNaN: true })),
  bold: fc.boolean(),
  italic: fc.boolean(),
  weight: fc.constantFrom(100, 400, 700, 900),
  fontFamily: fc.constantFrom('Inter', 'sans-serif', 'Noto Sans JP', 'a "quoted" face'),
}, { requiredKeys: [] });

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

describe('estimatedWidth', () => {
  it('gives each code point a glyph and its tracking', () => {
    fc.assert(fc.property(text, fc.option(style, { nil: undefined }), (t, s) => {
      const size = s?.fontSize ?? FALLBACK_LINE;
      const chars = Array.from(t).length;
      expect(near(estimatedWidth(t, s), chars * size * GLYPH + trackingWidth(t, s))).toBe(true);
      expect(near(trackingWidth(t, s), chars * size * (s?.tracking ?? 0))).toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

const metrics = fc.record({ ascent: fc.double({ min: 0, max: 1.2, noNaN: true }), descent: fc.double({ min: 0, max: 0.6, noNaN: true }), capHeight: fc.double({ min: 0, max: 1, noNaN: true }) });

describe('capCenterFrom', () => {
  it('scales with the size', () => {
    fc.assert(fc.property(metrics, fc.double({ min: 0, max: 200, noNaN: true }), fc.double({ min: 0, max: 10, noNaN: true }), (m, size, k) => {
      expect(Math.abs(capCenterFrom(m, size * k) - k * capCenterFrom(m, size))).toBeLessThanOrEqual(1e-9 * Math.max(1, size * k * 2));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('canvasMeasure', () => {
  it('reports the context\'s width plus tracking, the line height, and a finite cap center', () => {
    fc.assert(fc.property(text, style, metrics, fc.boolean(), (t, s, m, bounded) => {
      const size = s.fontSize ?? FALLBACK_LINE;
      const fonts: string[] = [];
      const ctx = {
        font: '',
        measureText(run: string) {
          fonts.push(this.font);
          return {
            width: Array.from(run).length * size * 0.55,
            ...(bounded ? { fontBoundingBoxAscent: m.ascent * size, fontBoundingBoxDescent: m.descent * size, actualBoundingBoxAscent: m.capHeight * size } : {}),
          };
        },
      };
      const out = canvasMeasure(ctx)(t, s);
      expect(nonFinite(out)).toEqual([]);
      expect(near(out.width, Array.from(t).length * size * 0.55 + trackingWidth(t, s))).toBe(true);
      expect(out.height).toBe(Math.ceil(size * 1.2));
      expect(fonts.every((f) => f.includes(`${size}px `) && f.startsWith(s.italic ? 'italic ' : '') === true)).toBe(true);
      const weight = weightOf(s);
      if (weight !== undefined) expect(fonts[0]).toContain(`${weight} ${size}px`);
      if (!bounded) expect(out.capCenter).toBeUndefined();
      else if (size > 0) expect(Math.abs(out.capCenter! - capCenterFrom(m, size))).toBeLessThanOrEqual(1e-9 * Math.max(1, size));
      else expect(out.capCenter).toBe(0);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
