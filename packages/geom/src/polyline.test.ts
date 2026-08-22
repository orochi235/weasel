import { describe, it, expect } from 'vitest';
import { pointInPolygon, segmentsCross, pointSegmentDist2 } from './polyline';
import { approxEq } from './scalar';

// An L-shaped (non-convex) polygon, interleaved & unclosed.
const L = [0, 0, 4, 0, 4, 2, 2, 2, 2, 4, 0, 4];

describe('pointInPolygon (flat, even-odd)', () => {
  it('inside the lower arm', () => expect(pointInPolygon(L, 1, 1)).toBe(true));
  it('inside the upper arm', () => expect(pointInPolygon(L, 1, 3)).toBe(true));
  it('in the notch (outside)', () => expect(pointInPolygon(L, 3, 3)).toBe(false));
  it('far outside', () => expect(pointInPolygon(L, 9, 9)).toBe(false));
  it('degenerate (<3 verts) is false', () => expect(pointInPolygon([0, 0, 1, 1], 0, 0)).toBe(false));
});

describe('segmentsCross', () => {
  it('crossing diagonals intersect', () => {
    expect(segmentsCross(0, 0, 4, 4, 0, 4, 4, 0)).toBe(true);
  });
  it('parallel segments do not', () => {
    expect(segmentsCross(0, 0, 4, 0, 0, 1, 4, 1)).toBe(false);
  });
});

describe('pointSegmentDist2', () => {
  it('perpendicular distance squared to a segment', () => {
    expect(approxEq(pointSegmentDist2(2, 3, 0, 0, 4, 0), 9)).toBe(true);
  });
  it('clamps to the nearer endpoint past the end', () => {
    expect(approxEq(pointSegmentDist2(-3, 0, 0, 0, 4, 0), 9)).toBe(true);
  });
});

describe('segmentsCross degenerate configurations', () => {
  it('counts a T-junction and a shared endpoint as a crossing', () => {
    expect(segmentsCross(0, 0, 10, 0, 5, 0, 5, 10)).toBe(true);
    expect(segmentsCross(0, 0, 10, 0, 0, 0, 0, 10)).toBe(true);
  });
  it('does not count collinear overlap or a degenerate segment', () => {
    expect(segmentsCross(0, 0, 10, 0, 5, 0, 15, 0)).toBe(false);
    expect(segmentsCross(0, 0, 10, 0, 5, 0, 5, 0)).toBe(false);
    expect(segmentsCross(0, 0, 0, 0, 0, 0, 0, 0)).toBe(false);
  });
});

describe('pointInPolygon degenerate contours', () => {
  it('rejects fewer than three vertices', () => {
    expect(pointInPolygon([0, 0, 10, 10], 5, 5)).toBe(false);
    expect(pointInPolygon([], 0, 0)).toBe(false);
  });
  it('rejects a zero-area collinear contour', () => {
    expect(pointInPolygon([0, 0, 5, 0, 10, 0], 5, 0)).toBe(false);
  });
});

describe('pointSegmentDist2 degenerate segment', () => {
  it('falls back to the endpoint distance when the segment has no length', () => {
    expect(pointSegmentDist2(3, 4, 0, 0, 0, 0)).toBe(25);
  });
});
