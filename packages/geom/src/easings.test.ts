import { describe, expect, it } from 'vitest';
import {
  linear, easeInQuad, easeOutQuad, easeInOutQuad,
  EASINGS,
  easeInBack, easeOutBack, easeInElastic, easeOutElastic,
  easeInBounce, easeOutBounce,
} from './easings';

describe('easings', () => {
  it.each([linear, easeInQuad, easeOutQuad, easeInOutQuad])('endpoints are 0 and 1 for %o', (fn) => {
    expect(fn(0)).toBeCloseTo(0, 10);
    expect(fn(1)).toBeCloseTo(1, 10);
  });

  it('linear is identity', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(linear(t)).toBeCloseTo(t, 10);
    }
  });

  it('easeInQuad is convex (slow start)', () => {
    expect(easeInQuad(0.5)).toBeLessThan(0.5);
  });

  it('easeOutQuad is concave (fast start)', () => {
    expect(easeOutQuad(0.5)).toBeGreaterThan(0.5);
  });

  it('easeInOutQuad is symmetric around 0.5', () => {
    for (const t of [0.1, 0.2, 0.3, 0.4]) {
      expect(easeInOutQuad(t) + easeInOutQuad(1 - t)).toBeCloseTo(1, 10);
    }
    expect(easeInOutQuad(0.5)).toBeCloseTo(0.5, 10);
  });
});

describe('EASINGS bag', () => {
  it('every easing is exactly 0 at t=0 and exactly 1 at t=1', () => {
    for (const [name, fn] of Object.entries(EASINGS)) {
      expect(fn(0) === 0, `${name} at 0: ${fn(0)}`).toBe(true);
      expect(fn(1), `${name} at 1`).toBe(1);
    }
  });

  it('overshoot easings push past their endpoints somewhere in the middle', () => {
    expect(easeInBack(0.2)).toBeLessThan(0);
    expect(easeOutBack(0.8)).toBeGreaterThan(1);
    expect(easeInElastic(0.2)).toBeLessThan(0);
    expect(easeOutElastic(0.8)).toBeGreaterThan(1);
  });

  it('bounce easings stay within [0,1] everywhere', () => {
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const a = easeInBounce(t);
      const b = easeOutBounce(t);
      expect(a).toBeGreaterThanOrEqual(-1e-9);
      expect(a).toBeLessThanOrEqual(1 + 1e-9);
      expect(b).toBeGreaterThanOrEqual(-1e-9);
      expect(b).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});
