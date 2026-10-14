import { describe, expect, it } from 'vitest';
import {
  normalizeWidthProfile, removeWidthStop, setWidthStop, widestInProfile, widthProfileAt,
} from './widthProfile';

describe('widthProfileAt', () => {
  it('reads 1 from an empty profile', () => {
    expect(widthProfileAt([], 0.3)).toBe(1);
  });

  it('holds a single stop everywhere', () => {
    expect(widthProfileAt([{ t: 0.5, width: 3 }], 0)).toBe(3);
    expect(widthProfileAt([{ t: 0.5, width: 3 }], 1)).toBe(3);
  });

  it('passes through every stop and holds past the ends', () => {
    const p = [{ t: 0.2, width: 1 }, { t: 0.5, width: 4 }, { t: 0.9, width: 2 }];
    expect(widthProfileAt(p, 0.2)).toBeCloseTo(1, 9);
    expect(widthProfileAt(p, 0.5)).toBeCloseTo(4, 9);
    expect(widthProfileAt(p, 0.9)).toBeCloseTo(2, 9);
    expect(widthProfileAt(p, 0)).toBe(1);
    expect(widthProfileAt(p, 1)).toBe(2);
  });

  it('never overshoots the stops between them', () => {
    const p = [{ t: 0, width: 1 }, { t: 0.5, width: 4 }, { t: 0.6, width: 4 }, { t: 1, width: 0.5 }];
    for (let i = 0; i <= 100; i++) {
      const w = widthProfileAt(p, i / 100);
      expect(w).toBeGreaterThanOrEqual(0.5 - 1e-9);
      expect(w).toBeLessThanOrEqual(4 + 1e-9);
    }
  });

  it('eases into a stop rather than kinking at it', () => {
    const p = [{ t: 0, width: 1 }, { t: 0.5, width: 3 }, { t: 1, width: 5 }];
    // On a straight ramp a smooth curve is the ramp itself.
    expect(widthProfileAt(p, 0.25)).toBeCloseTo(2, 6);
    expect(widthProfileAt(p, 0.75)).toBeCloseTo(4, 6);
  });

  it('wraps across the seam of a closed run', () => {
    const p = [{ t: 0.25, width: 1 }, { t: 0.75, width: 3 }];
    expect(widthProfileAt(p, 0, true)).toBeCloseTo(widthProfileAt(p, 1, true), 9);
    expect(widthProfileAt(p, 0, true)).toBeCloseTo(2, 6);
  });
});

describe('profile editing', () => {
  it('sorts, clamps, and drops unusable stops', () => {
    expect(normalizeWidthProfile([
      { t: 0.8, width: 2 }, { t: -1, width: 1 }, { t: 0.4, width: NaN }, { t: 0.5, width: -3 },
    ])).toEqual([{ t: 0, width: 1 }, { t: 0.5, width: 0 }, { t: 0.8, width: 2 }]);
  });

  it('adds a stop, or moves the one already near t', () => {
    const one = setWidthStop([], 0.5, 2);
    expect(one).toEqual([{ t: 0.5, width: 2 }]);
    expect(setWidthStop(one, 0.51, 3, 0.02)).toEqual([{ t: 0.51, width: 3 }]);
    expect(setWidthStop(one, 0.2, 3, 0.02)).toEqual([{ t: 0.2, width: 3 }, { t: 0.5, width: 2 }]);
  });

  it('removes a stop by index', () => {
    expect(removeWidthStop([{ t: 0, width: 1 }, { t: 1, width: 2 }], 0)).toEqual([{ t: 1, width: 2 }]);
  });

  it('answers the widest factor', () => {
    expect(widestInProfile(undefined)).toBe(1);
    expect(widestInProfile([{ t: 0, width: 0.5 }, { t: 1, width: 3 }])).toBe(3);
  });
});
