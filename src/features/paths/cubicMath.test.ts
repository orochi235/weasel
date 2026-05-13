import { describe, expect, it } from 'vitest';
import { splitCubicAtT } from './cubicMath';

describe('splitCubicAtT', () => {
  it('splits a cubic at t=0.5 into two halves that re-evaluate to the original geometry', () => {
    // Original: P0=(0,0) P1=(0,100) P2=(100,100) P3=(100,0)
    const { left, right } = splitCubicAtT(
      { x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 0 },
      0.5,
    );
    // The midpoint of the original cubic at t=0.5:
    //   B(0.5) = 0.125·P0 + 0.375·P1 + 0.375·P2 + 0.125·P3
    //          = (50, 75)
    // Both halves share this point as their meeting endpoint.
    expect(left[3]).toEqual({ x: 50, y: 75 });
    expect(right[0]).toEqual({ x: 50, y: 75 });
    // Endpoints of each half match the original endpoints.
    expect(left[0]).toEqual({ x: 0, y: 0 });
    expect(right[3]).toEqual({ x: 100, y: 0 });
  });

  it('returns the original cubic in the right half when t=0', () => {
    const p0 = { x: 0, y: 0 }, p1 = { x: 10, y: 20 }, p2 = { x: 30, y: 40 }, p3 = { x: 50, y: 0 };
    const { left, right } = splitCubicAtT(p0, p1, p2, p3, 0);
    expect(left).toEqual([p0, p0, p0, p0]);
    expect(right).toEqual([p0, p1, p2, p3]);
  });

  it('returns the original cubic in the left half when t=1', () => {
    const p0 = { x: 0, y: 0 }, p1 = { x: 10, y: 20 }, p2 = { x: 30, y: 40 }, p3 = { x: 50, y: 0 };
    const { left, right } = splitCubicAtT(p0, p1, p2, p3, 1);
    expect(left).toEqual([p0, p1, p2, p3]);
    expect(right).toEqual([p3, p3, p3, p3]);
  });
});
