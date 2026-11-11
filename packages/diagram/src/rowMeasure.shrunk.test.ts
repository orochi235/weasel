import { describe, expect, it } from 'vitest';
import { FALLBACK_LINE, GLYPH, canvasMeasure, estimatedWidth } from './rowMeasure';

describe('row measures, shrunk', () => {
  it('gives an emoji one glyph, not one per UTF-16 unit', () => {
    expect(estimatedWidth('a😀b', undefined)).toBe(3 * FALLBACK_LINE * GLYPH);
  });

  it('reports a cap center of 0 for a 0px font, not NaN', () => {
    const ctx = { font: '', measureText: () => ({ width: 0, fontBoundingBoxAscent: 0, fontBoundingBoxDescent: 0, actualBoundingBoxAscent: 0 }) };
    expect(canvasMeasure(ctx)('', { fontSize: 0 })).toEqual({ width: 0, height: 0, capCenter: 0 });
  });
});
