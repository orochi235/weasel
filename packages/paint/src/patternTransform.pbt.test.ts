import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { composePatternTransform, decomposePatternTransform, type PatternTransform } from './patternTransform';
import { maxDiff, runs } from './pbt.fixture';

const RUNS = runs(300);
const entry = fc.double({ min: -100, max: 100, noNaN: true });
const scale = fc.oneof(fc.double({ min: 1e-3, max: 100, noNaN: true }), fc.double({ min: -100, max: -1e-3, noNaN: true }));

describe('decomposePatternTransform, property', () => {
  it('composes back to an invertible matrix it took apart', () => {
    const matrix = fc.tuple(entry, entry, entry, entry)
      .filter(([a, b, c, d]) => Math.abs(a * d - b * c) > 1e-6 * Math.max(1, a * a + b * b + c * c + d * d));
    fc.assert(fc.property(matrix, (m) => {
      const back = composePatternTransform(decomposePatternTransform(m));
      expect(maxDiff(back, m)).toBeLessThan(1e-9 * Math.max(1, ...m.map(Math.abs)));
    }), RUNS);
  });

  it('takes apart the parts it composed, with rotation in (-π, π], scaleX positive, and skew short of a quarter turn', () => {
    const parts = fc.record({
      rotation: fc.double({ min: -Math.PI + 1e-6, max: Math.PI, noNaN: true }),
      scaleX: fc.double({ min: 1e-3, max: 100, noNaN: true }),
      scaleY: scale,
      skewX: fc.double({ min: -1.5, max: 1.5, noNaN: true }),
    });
    fc.assert(fc.property(parts, (p) => {
      const got = decomposePatternTransform(composePatternTransform(p));
      const tol = 1e-9 * (1 + Math.abs(Math.tan(p.skewX))) * Math.max(1, p.scaleX / Math.abs(p.scaleY), Math.abs(p.scaleY) / p.scaleX);
      expect(Math.abs(Math.atan2(Math.sin(got.rotation - p.rotation), Math.cos(got.rotation - p.rotation)))).toBeLessThan(tol);
      expect(Math.abs(got.scaleX - p.scaleX)).toBeLessThan(tol * p.scaleX);
      expect(Math.abs(got.scaleY - p.scaleY)).toBeLessThan(tol * Math.abs(p.scaleY));
      expect(Math.abs(got.skewX - p.skewX)).toBeLessThan(tol);
    }), RUNS);
  });

  it('reads no transform as the identity, both ways', () => {
    expect(maxDiff(composePatternTransform(decomposePatternTransform(undefined)), [1, 0, 0, 1])).toBe(0);
    const m: PatternTransform = [0, 0, 2, 3];
    expect(maxDiff(composePatternTransform(decomposePatternTransform(m)), m)).toBeLessThan(1e-15);
    // Singular with parallel columns: no scale-skew-rotate product holds a second column there.
    expect(composePatternTransform(decomposePatternTransform([1, 0, 1, 0]))).toEqual([1, 0, 0, 0]);
  });
});
