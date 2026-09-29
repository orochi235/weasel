import { describe, expect, it } from 'vitest';
import { splitCubicAtT, fitCubicThroughDeletion } from './cubicMath';

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

describe('fitCubicThroughDeletion', () => {
  it('produces controls that extend in the direction of the surviving handles', () => {
    // prev anchor at (0,0) with outgoing handle pointing right at (10, 0).
    // next anchor at (100,0) with incoming handle pointing left at (90, 0).
    // Best-fit cubic should have controls roughly co-linear with that direction,
    // forming a smooth segment.
    const { c1, c2 } = fitCubicThroughDeletion(
      { x: 0, y: 0, outHandle: { x: 10, y: 0 } },
      { x: 100, y: 0, inHandle: { x: 90, y: 0 } },
    );
    // c1 should be on the prev side, past prev's outHandle direction.
    expect(c1.x).toBeGreaterThan(10);
    expect(c1.x).toBeLessThan(100);
    // c2 should be on the next side, past next's inHandle direction.
    expect(c2.x).toBeLessThan(90);
    expect(c2.x).toBeGreaterThan(0);
  });

  it('falls back to a 1/3 - 2/3 split when prev has no outHandle', () => {
    // No outHandle on prev → use line from prev to next, place c1 at 1/3.
    const { c1, c2 } = fitCubicThroughDeletion(
      { x: 0, y: 0 },
      { x: 90, y: 0, inHandle: { x: 60, y: 0 } },
    );
    expect(c1).toEqual({ x: 30, y: 0 });
    // c2 stays at next's inHandle.
    expect(c2).toEqual({ x: 60, y: 0 });
  });
});
