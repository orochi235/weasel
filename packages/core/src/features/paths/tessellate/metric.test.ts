import { describe, it, expect } from 'vitest';
import { strokeSpaceOf } from './metric';

/** Apply the 2×2 [[p, q], [q, r]] to a vector. */
const applyP = (m: { p: number; q: number; r: number }, x: number, y: number) =>
  [m.p * x + m.q * y, m.q * x + m.r * y];

describe('strokeSpaceOf', () => {
  it('has no metric for a uniform scale, and the scale is that scale', () => {
    expect(strokeSpaceOf(3, 0, 0, 3)).toEqual({ scale: 3, metric: null });
  });

  it('has no metric for a rotation, a reflection, or both under a uniform scale', () => {
    const c = Math.cos(0.7) * 2, s = Math.sin(0.7) * 2;
    expect(strokeSpaceOf(c, s, -s, c).metric).toBeNull();
    expect(strokeSpaceOf(-2, 0, 0, 2).metric).toBeNull();
    expect(strokeSpaceOf(c, s, s, -c).metric).toBeNull();
  });

  it('splits 4:1 into the geometric-mean scale and a unit-determinant stretch', () => {
    const { scale, metric } = strokeSpaceOf(4, 0, 0, 1);
    expect(scale).toBeCloseTo(2, 12);
    expect(metric!.p).toBeCloseTo(2, 12);
    expect(metric!.q).toBeCloseTo(0, 12);
    expect(metric!.r).toBeCloseTo(0.5, 12);
  });

  // The metric is the transform with its outer rotation removed: scale times
  // the metric, then some rotation, has to reproduce the transform's lengths
  // in every direction.
  it.each([
    ['4:1 then a rotation', [4 * Math.cos(1), 4 * Math.sin(1), -Math.sin(1), Math.cos(1)]],
    ['a skew', [1, 0, 0.8, 1]],
    ['a rotation then 1:3', [Math.cos(0.4), 3 * Math.sin(0.4), -Math.sin(0.4), 3 * Math.cos(0.4)]],
  ])('preserves every direction\'s length under %s', (_label, [a, b, c, d]) => {
    const { scale, metric } = strokeSpaceOf(a, b, c, d);
    expect(metric).not.toBeNull();
    expect(metric!.p * metric!.r - metric!.q * metric!.q).toBeCloseTo(1, 12);
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI;
      const x = Math.cos(t), y = Math.sin(t);
      const [px, py] = applyP(metric!, x, y);
      expect(scale * Math.hypot(px, py)).toBeCloseTo(Math.hypot(a * x + c * y, b * x + d * y), 10);
    }
  });

  it('answers the same metric for a transform under an outer rotation', () => {
    const base = strokeSpaceOf(4, 0, 0, 1).metric!;
    const c = Math.cos(0.3), s = Math.sin(0.3);
    // R · diag(4, 1)
    const turned = strokeSpaceOf(c * 4, s * 4, -s, c).metric!;
    expect(turned.p).toBeCloseTo(base.p, 12);
    expect(turned.q).toBeCloseTo(base.q, 12);
    expect(turned.r).toBeCloseTo(base.r, 12);
  });

  it('has no scale to divide by for a singular transform', () => {
    expect(strokeSpaceOf(1, 0, 0, 0)).toEqual({ scale: 0, metric: null });
  });
});
