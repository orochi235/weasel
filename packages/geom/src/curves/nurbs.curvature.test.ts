import { describe, expect, it } from 'vitest';
import { nurbs } from './nurbs';

describe('nurbs curvature at the ends', () => {
  // Four anchors on clamped knots are one cubic Bezier, whose end curvature is
  // (2/3) * |(P1 - P0) x (P2 - P1)| / |P1 - P0|³ = (2/3) * 9 / 27 = 2/9.
  const anchors = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 }];

  it('matches the Bezier end curvature at t = 0 and t = 1', () => {
    expect(nurbs.curvatureAt(anchors, 0)).toBeCloseTo(2 / 9, 2);
    expect(nurbs.curvatureAt(anchors, 1)).toBeCloseTo(2 / 9, 2);
  });
});
