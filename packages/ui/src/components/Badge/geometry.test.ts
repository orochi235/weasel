import { describe, expect, it } from 'vitest';
import {
  OCTANT_BSPLINE_MIN_WEIGHT, octantBSplineRadius, octantSplineRadius, type BadgeSplineAnchor,
} from '@weasel-js/ui/components/Badge/geometry';

const bent: BadgeSplineAnchor[] = [{ s: 0, r: 48, w: 1 }, { s: 0.5, r: 20, w: 1 }, { s: 1, r: 40, w: 1 }];

describe('octantSplineRadius', () => {
  it('passes through every anchor', () => {
    const r = octantSplineRadius(bent);
    expect(r(0)).toBe(48);
    expect(r(0.5)).toBeCloseTo(20, 10);
    expect(r(1)).toBe(40);
  });
});

describe('octantBSplineRadius', () => {
  it('pulls toward an interior anchor without reaching it', () => {
    const r = octantBSplineRadius(bent);
    expect(r(0.5)).toBeGreaterThan(20);
    expect(r(0.5)).toBeLessThan(48);
  });

  it('draws a weight of zero as the least weight', () => {
    const zero = octantBSplineRadius(bent.map((a, i) => (i === 1 ? { ...a, w: 0 } : a)));
    const least = octantBSplineRadius(bent.map((a, i) => (i === 1 ? { ...a, w: OCTANT_BSPLINE_MIN_WEIGHT } : a)));
    for (const s of [0, 0.2, 0.5, 0.8, 1]) expect(zero(s)).toBe(least(s));
    expect(Number.isFinite(zero(0.5))).toBe(true);
  });
});
