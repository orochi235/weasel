import { describe, it, expect } from 'vitest';
import { constrainTo45 } from './constrainTo45';

describe('constrainTo45', () => {
  it('returns (0, 0) for the zero vector', () => {
    expect(constrainTo45(0, 0)).toEqual({ dx: 0, dy: 0 });
  });

  it('snaps a near-horizontal vector to the x axis, preserving magnitude', () => {
    const r = constrainTo45(10, 1);
    expect(r.dy).toBeCloseTo(0);
    expect(Math.hypot(r.dx, r.dy)).toBeCloseTo(Math.hypot(10, 1));
    expect(r.dx).toBeGreaterThan(0);
  });

  it('snaps a near-vertical vector to the y axis, preserving magnitude', () => {
    const r = constrainTo45(1, -10);
    expect(r.dx).toBeCloseTo(0);
    expect(Math.hypot(r.dx, r.dy)).toBeCloseTo(Math.hypot(1, 10));
    expect(r.dy).toBeLessThan(0);
  });

  it('snaps a near-45° vector to exact 45°, preserving magnitude', () => {
    const r = constrainTo45(10, 9);
    const mag = Math.hypot(10, 9);
    expect(r.dx).toBeCloseTo(mag / Math.SQRT2);
    expect(r.dy).toBeCloseTo(mag / Math.SQRT2);
  });

  it('snaps to 135° (negative x, positive y) when input is in that octant', () => {
    const r = constrainTo45(-10, 9);
    const mag = Math.hypot(10, 9);
    expect(r.dx).toBeCloseTo(-mag / Math.SQRT2);
    expect(r.dy).toBeCloseTo(mag / Math.SQRT2);
  });

  it('snaps to -135° (negative x, negative y) when input is in that octant', () => {
    const r = constrainTo45(-10, -9);
    const mag = Math.hypot(10, 9);
    expect(r.dx).toBeCloseTo(-mag / Math.SQRT2);
    expect(r.dy).toBeCloseTo(-mag / Math.SQRT2);
  });
});
