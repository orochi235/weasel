import { describe, it, expect } from 'vitest';
import { polygonContainsPoint, ringSignedArea, segmentsCross } from './polyline';
import { pointSegmentDist2 } from './points2';
import { approxEq } from './scalar';

// An L-shaped (non-convex) polygon, interleaved & unclosed.
const L = [0, 0, 4, 0, 4, 2, 2, 2, 2, 4, 0, 4];

describe('polygonContainsPoint (flat, even-odd)', () => {
  it('inside the lower arm', () => expect(polygonContainsPoint(L, 1, 1)).toBe(true));
  it('inside the upper arm', () => expect(polygonContainsPoint(L, 1, 3)).toBe(true));
  it('in the notch (outside)', () => expect(polygonContainsPoint(L, 3, 3)).toBe(false));
  it('far outside', () => expect(polygonContainsPoint(L, 9, 9)).toBe(false));
  it('degenerate (<3 verts) is false', () => expect(polygonContainsPoint([0, 0, 1, 1], 0, 0)).toBe(false));
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
  it('counts collinear segments meeting end to end at one point', () => {
    expect(segmentsCross(0, 0, 1, 0, 1, 0, 2, 0)).toBe(true);
    expect(segmentsCross(1, 0, 2, 0, 0, 0, 1, 0)).toBe(true);
    expect(segmentsCross(0, 0, 1, 1, 2, 2, 1, 1)).toBe(true);
    expect(segmentsCross(0, 0, 1, 0, 2, 0, 3, 0)).toBe(false);
  });
  it('does not count collinear overlap or a degenerate segment', () => {
    expect(segmentsCross(0, 0, 10, 0, 5, 0, 15, 0)).toBe(false);
    expect(segmentsCross(0, 0, 10, 0, 5, 0, 5, 0)).toBe(false);
    expect(segmentsCross(0, 0, 0, 0, 0, 0, 0, 0)).toBe(false);
  });
});

describe('polygonContainsPoint degenerate contours', () => {
  it('rejects fewer than three vertices', () => {
    expect(polygonContainsPoint([0, 0, 10, 10], 5, 5)).toBe(false);
    expect(polygonContainsPoint([], 0, 0)).toBe(false);
  });
  it('rejects a zero-area collinear contour', () => {
    expect(polygonContainsPoint([0, 0, 5, 0, 10, 0], 5, 0)).toBe(false);
  });
});

describe('pointSegmentDist2 degenerate segment', () => {
  it('falls back to the endpoint distance when the segment has no length', () => {
    expect(pointSegmentDist2(3, 4, 0, 0, 0, 0)).toBe(25);
  });
});

describe('polygonContainsPoint over a vertex range', () => {
  // Two contours in one buffer: a 0..10 square, then a 20..30 square.
  const coords = [
    0, 0, 10, 0, 10, 10, 0, 10,
    20, 20, 30, 20, 30, 30, 20, 30,
  ];

  it('tests only the requested contour', () => {
    expect(polygonContainsPoint(coords, 5, 5, 0, 4)).toBe(true);
    expect(polygonContainsPoint(coords, 25, 25, 0, 4)).toBe(false);
    expect(polygonContainsPoint(coords, 25, 25, 4, 8)).toBe(true);
    expect(polygonContainsPoint(coords, 5, 5, 4, 8)).toBe(false);
  });

  it('rejects a range of fewer than three vertices', () => {
    expect(polygonContainsPoint(coords, 5, 5, 0, 2)).toBe(false);
  });
});

describe('ringSignedArea', () => {
  // Unit square, counterclockwise with y up.
  const ccw = [0, 0, 2, 0, 2, 2, 0, 2];
  it('is positive counterclockwise (y up) and negative clockwise', () => {
    expect(ringSignedArea(ccw)).toBe(4);
    expect(ringSignedArea([0, 0, 0, 2, 2, 2, 2, 0])).toBe(-4);
  });
  it('is zero for fewer than three vertices', () => {
    expect(ringSignedArea([])).toBe(0);
    expect(ringSignedArea([1, 1])).toBe(0);
    expect(ringSignedArea([0, 0, 3, 3])).toBe(0);
  });
  it('reads one ring out of a shared buffer by vertex range', () => {
    const buf = [9, 9, 9, 9, ...ccw, 7, 7];
    expect(ringSignedArea(buf, 2, 6)).toBe(4);
  });
});
