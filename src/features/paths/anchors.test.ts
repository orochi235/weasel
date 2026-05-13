import { describe, expect, it } from 'vitest';
import { countPathAnchors, pathToAnchors } from './anchors';
import { PathBuilder, polygonFromPoints, rectPath } from './builder';

describe('pathToAnchors', () => {
  it('extracts a single open subpath of corner anchors from M+L+L', () => {
    const path = new PathBuilder()
      .moveTo(0, 0).lineTo(10, 0).lineTo(10, 10)
      .build();
    const { anchors, closed } = pathToAnchors(path);
    expect(anchors).toEqual([[
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]]);
    expect(closed).toEqual([false]);
  });

  it('marks the subpath closed when it ends with Z', () => {
    const path = new PathBuilder()
      .moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).close()
      .build();
    const { closed } = pathToAnchors(path);
    expect(closed).toEqual([true]);
  });

  it('extracts handles from a cubic segment as outHandle/inHandle on adjacent anchors', () => {
    const path = new PathBuilder()
      .moveTo(0, 0)
      .curveTo(20, 0, 80, 100, 100, 100)
      .build();
    const { anchors } = pathToAnchors(path);
    expect(anchors[0]).toHaveLength(2);
    expect(anchors[0][0]).toEqual({ x: 0, y: 0, outHandle: { x: 20, y: 0 } });
    expect(anchors[0][1]).toEqual({ x: 100, y: 100, inHandle: { x: 80, y: 100 } });
  });

  it('produces multiple subpaths from multiple M commands', () => {
    const path = new PathBuilder()
      .moveTo(0, 0).lineTo(10, 0)
      .moveTo(50, 50).lineTo(60, 50)
      .build();
    const { anchors, closed } = pathToAnchors(path);
    expect(anchors).toHaveLength(2);
    expect(anchors[0]).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(anchors[1]).toEqual([{ x: 50, y: 50 }, { x: 60, y: 50 }]);
    expect(closed).toEqual([false, false]);
  });

  it('returns empty arrays for an empty path', () => {
    const path = new PathBuilder().build();
    expect(pathToAnchors(path)).toEqual({ anchors: [], closed: [] });
  });
});

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
