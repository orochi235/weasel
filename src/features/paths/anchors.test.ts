import { describe, expect, it } from 'vitest';
import { countPathAnchors } from './anchors';
import { PathBuilder, polygonFromPoints, rectPath } from './builder';

describe('countPathAnchors', () => {
  it('returns 4 for a RectPath (one anchor per corner)', () => {
    expect(countPathAnchors(rectPath(0, 0, 10, 10))).toBe(4);
  });

  it('counts M + L commands in a polygon-from-points (Z does not count)', () => {
    const p = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    // polygonFromPoints emits M + L + L + Z → 3 anchors
    expect(countPathAnchors(p)).toBe(3);
  });

  it('counts C and Q commands as one anchor each (destination point)', () => {
    const p = new PathBuilder()
      .moveTo(0, 0)
      .lineTo(10, 0)
      .curveTo(20, 0, 20, 10, 10, 10)
      .quadTo(0, 20, 0, 10)
      .build();
    // M + L + C + Q = 4 anchors
    expect(countPathAnchors(p)).toBe(4);
  });

  it('sums anchors across multiple contours', () => {
    const p = new PathBuilder()
      .moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).close()
      .moveTo(20, 20).lineTo(30, 20).close()
      .build();
    // contour 1: M + L + L = 3; contour 2: M + L = 2; total 5
    expect(countPathAnchors(p)).toBe(5);
  });
});
