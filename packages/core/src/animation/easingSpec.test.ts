import { describe, expect, it } from 'vitest';
import { resolveEasing, cubicBezierEasing } from './easingSpec';
import { easeOutBack, linear } from './easings';

describe('resolveEasing', () => {
  it('resolves undefined to linear', () => {
    const fn = resolveEasing(undefined);
    expect(fn(0)).toBe(0);
    expect(fn(0.5)).toBe(0.5);
    expect(fn(1)).toBe(1);
  });

  it('passes a function through unchanged', () => {
    expect(resolveEasing(easeOutBack)).toBe(easeOutBack);
    expect(resolveEasing(linear)).toBe(linear);
  });

  it('resolves a name to its built-in curve', () => {
    expect(resolveEasing('easeOutBack')).toBe(easeOutBack);
  });

  it('throws on a name that is not a built-in', () => {
    // @ts-expect-error deliberately outside EasingName
    expect(() => resolveEasing('easeOutNonsense')).toThrow(/unknown easing/i);
  });

  it('resolves a bezier spec to a curve pinned at both ends', () => {
    const fn = resolveEasing({ bezier: [0.4, 0, 0.2, 1] });
    expect(fn(0)).toBeCloseTo(0, 6);
    expect(fn(1)).toBeCloseTo(1, 6);
  });

  it('returns the same function for two equal bezier specs', () => {
    const a = resolveEasing({ bezier: [0.4, 0, 0.2, 1] });
    const b = resolveEasing({ bezier: [0.4, 0, 0.2, 1] });
    expect(a).toBe(b);
  });

  it('returns different functions for different bezier specs', () => {
    const a = resolveEasing({ bezier: [0.4, 0, 0.2, 1] });
    const b = resolveEasing({ bezier: [0.25, 0.1, 0.25, 1] });
    expect(a).not.toBe(b);
  });
});

describe('cubicBezierEasing', () => {
  it('reproduces linear for the identity control points', () => {
    const fn = cubicBezierEasing(1 / 3, 1 / 3, 2 / 3, 2 / 3);
    for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      expect(fn(t)).toBeCloseTo(t, 4);
    }
  });

  it('is monotone non-decreasing for a monotone curve', () => {
    const fn = cubicBezierEasing(0.4, 0, 0.2, 1);
    let prev = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const v = fn(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  it('eases out: ahead of linear through the first half', () => {
    const fn = cubicBezierEasing(0, 0, 0.2, 1);
    expect(fn(0.25)).toBeGreaterThan(0.25);
  });

  it('clamps input outside 0..1', () => {
    const fn = cubicBezierEasing(0.4, 0, 0.2, 1);
    expect(fn(-1)).toBeCloseTo(0, 6);
    expect(fn(2)).toBeCloseTo(1, 6);
  });

  it('leaves the unit range for an overshooting curve', () => {
    const fn = cubicBezierEasing(0.34, 1.56, 0.64, 1);
    let max = 0;
    for (let i = 0; i <= 100; i++) max = Math.max(max, fn(i / 100));
    expect(max).toBeGreaterThan(1);
  });
});
