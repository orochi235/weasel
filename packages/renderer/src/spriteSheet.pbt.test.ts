import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs } from './pbt.fixture';
import { frameRect, type SpriteSheet } from './spriteSheet';

const sheet: fc.Arbitrary<SpriteSheet> = fc.record({
  frameWidth: fc.integer({ min: 1, max: 64 }), frameHeight: fc.integer({ min: 1, max: 64 }), columns: fc.integer({ min: 1, max: 12 }),
  margin: fc.option(fc.integer({ min: 0, max: 8 }), { nil: undefined }), spacing: fc.option(fc.integer({ min: 0, max: 8 }), { nil: undefined }),
});

describe('frameRect, property', () => {
  it('lays frames out row by row, none overlapping, each a gutter from the next', () => {
    fc.assert(fc.property(sheet, fc.integer({ min: 0, max: 200 }), fc.integer({ min: 0, max: 200 }), (s, i, j) => {
      const a = frameRect(s, i), b = frameRect(s, j);
      const m = s.margin ?? 0, g = s.spacing ?? 0;
      expect([a.w, a.h]).toEqual([s.frameWidth, s.frameHeight]);
      expect(a.x).toBeGreaterThanOrEqual(m);
      expect(a.y).toBeGreaterThanOrEqual(m);
      expect(a.x + a.w).toBeLessThanOrEqual(m + s.columns * (s.frameWidth + g) - g);
      if (i !== j) {
        const apart = a.x + a.w + g <= b.x || b.x + b.w + g <= a.x || a.y + a.h + g <= b.y || b.y + b.h + g <= a.y;
        expect(apart).toBe(true);
      }
      const next = frameRect(s, i + 1);
      if ((i + 1) % s.columns === 0) expect([next.x, next.y]).toEqual([m, a.y + s.frameHeight + g]);
      else expect([next.x, next.y]).toEqual([a.x + s.frameWidth + g, a.y]);
    }), runs(300));
  });
});
