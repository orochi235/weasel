import { describe, expect, it } from 'vitest';
import { easeIn, easeInOut, easeOut, linear, SPRING_PRESETS } from './easings';

describe('easings', () => {
  it.each([linear, easeIn, easeOut, easeInOut])('endpoints are 0 and 1 for %o', (fn) => {
    expect(fn(0)).toBeCloseTo(0, 10);
    expect(fn(1)).toBeCloseTo(1, 10);
  });

  it('linear is identity', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(linear(t)).toBeCloseTo(t, 10);
    }
  });

  it('easeIn is convex (slow start)', () => {
    expect(easeIn(0.5)).toBeLessThan(0.5);
  });

  it('easeOut is concave (fast start)', () => {
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });

  it('easeInOut is symmetric around 0.5', () => {
    for (const t of [0.1, 0.2, 0.3, 0.4]) {
      expect(easeInOut(t) + easeInOut(1 - t)).toBeCloseTo(1, 10);
    }
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 10);
  });
});

describe('SPRING_PRESETS', () => {
  it('exposes the four named presets with positive scalars', () => {
    for (const name of ['gentle', 'wobbly', 'stiff', 'slow'] as const) {
      const p = SPRING_PRESETS[name];
      expect(p.stiffness).toBeGreaterThan(0);
      expect(p.damping).toBeGreaterThan(0);
      expect(p.mass).toBeGreaterThan(0);
    }
  });
});
