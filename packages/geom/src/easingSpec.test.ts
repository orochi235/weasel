import { describe, expect, it } from 'vitest';
import { curve, penner, type PennerName } from '@msb235/blits';
import { EASING_NAMES, easingDataOf, resolveEasing } from './easingSpec';
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
    expect(() => resolveEasing('constructor' as never)).toThrow(/unknown easing/i);
    expect(() => resolveEasing('toString' as never)).toThrow(/unknown easing/i);
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

describe('resolveEasing of a bezier spec', () => {
  it('reproduces linear for the identity control points', () => {
    const fn = resolveEasing({ bezier: [1 / 3, 1 / 3, 2 / 3, 2 / 3] });
    for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      expect(fn(t)).toBeCloseTo(t, 4);
    }
  });

  it('clamps input outside 0..1', () => {
    const fn = resolveEasing({ bezier: [0.4, 0, 0.2, 1] });
    expect(fn(-1)).toBeCloseTo(0, 6);
    expect(fn(2)).toBeCloseTo(1, 6);
  });

  it('leaves the unit range for an overshooting curve', () => {
    const fn = resolveEasing({ bezier: [0.34, 1.56, 0.64, 1] });
    let max = 0;
    for (let i = 0; i <= 100; i++) max = Math.max(max, fn(i / 100));
    expect(max).toBeGreaterThan(1);
  });

  it('clamps x1/x2 outside 0..1, matching the clamped curve', () => {
    const over = resolveEasing({ bezier: [1.5, 0, 0.2, 1] });
    const clamped = resolveEasing({ bezier: [1, 0, 0.2, 1] });
    const under = resolveEasing({ bezier: [-0.5, 0, 0.2, 1] });
    const clampedUnder = resolveEasing({ bezier: [0, 0, 0.2, 1] });
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(over(t)).toBeCloseTo(clamped(t), 6);
      expect(under(t)).toBeCloseTo(clampedUnder(t), 6);
    }
  });
});

describe('named curves come from blits', () => {
  it('resolves every name to blits\' curve of that name', () => {
    for (const name of EASING_NAMES) expect(resolveEasing(name), name).toBe(curve(name));
  });

  it('gives each name the data blits stores it as', () => {
    expect(easingDataOf('linear')).toEqual({ bezier: [0, 0, 1, 1] });
    for (const name of EASING_NAMES.filter((n) => n !== 'linear')) {
      expect(easingDataOf(name), name).toBe(penner[name as PennerName]);
    }
  });

  it('throws on a name that is not a built-in', () => {
    expect(() => easingDataOf('constructor' as never)).toThrow(/unknown easing/i);
  });
});
