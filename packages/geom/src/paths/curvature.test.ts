import { describe, expect, it } from 'vitest';
import { cubicCurvatureAt, curvatureComb } from './curvature';
import type { AnchorSet } from './anchorEdits';

/** The usual four-cubic circle's kappa. */
const K = 0.5522847498;

/** Quarter of a radius-100 circle round the origin, counterclockwise in
 *  y-up terms: (100, 0) to (0, 100). */
const quarter = [
  { x: 100, y: 0 }, { x: 100, y: 100 * K }, { x: 100 * K, y: 100 }, { x: 0, y: 100 },
] as const;

describe('cubicCurvatureAt', () => {
  it('reads one over the radius on a circular arc, positive toward the left normal', () => {
    for (const t of [0, 0.25, 0.5, 1]) {
      expect(cubicCurvatureAt(...quarter, t)).toBeCloseTo(0.01, 3);
    }
  });

  it('flips sign when the curve is walked the other way', () => {
    const [p0, p1, p2, p3] = quarter;
    expect(cubicCurvatureAt(p3, p2, p1, p0, 0.5)).toBeCloseTo(-0.01, 3);
  });

  it('is zero on a straight cubic', () => {
    expect(cubicCurvatureAt({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }, 0.4)).toBe(0);
  });
});

describe('curvatureComb', () => {
  const circleish: AnchorSet = {
    anchors: [[
      { x: 100, y: 0, outHandle: { x: 100, y: 100 * K } },
      { x: 0, y: 100, inHandle: { x: 100 * K, y: 100 } },
      { x: -100, y: 100 },
    ]],
    closed: [false],
  };

  it('stands each tooth outside the bend, scale × curvature long', () => {
    const [comb] = curvatureComb(circleish, { scale: 1000, samplesPerSegment: 5 });
    expect(comb.teeth).toHaveLength(5);
    for (const tooth of comb.teeth) {
      const fromCenter = Math.hypot(tooth.tipX, tooth.tipY);
      expect(fromCenter).toBeCloseTo(110, 0);
      expect(Math.hypot(tooth.tipX - tooth.x, tooth.tipY - tooth.y)).toBeCloseTo(10, 0);
    }
  });

  it('gives straight segments no comb', () => {
    const combs = curvatureComb(circleish, { scale: 1000 });
    expect(combs.map((c) => c.segIdx)).toEqual([0]);
  });

  it('reads the curvature an end is approached with when its handle sits on the anchor', () => {
    const set: AnchorSet = {
      anchors: [[
        { x: 0, y: 0, outHandle: { x: 0, y: 0 } },
        { x: 100, y: 0, inHandle: { x: 50, y: 50 } },
      ]],
      closed: [false],
    };
    const [comb] = curvatureComb(set, { scale: 100, samplesPerSegment: 3 });
    expect(comb.teeth[0].curvature).not.toBe(0);
  });

  it('includes a closed subpath\'s closing segment', () => {
    const set: AnchorSet = {
      anchors: [[
        { x: 0, y: 0, inHandle: { x: -20, y: 30 }, outHandle: { x: 20, y: -30 } },
        { x: 100, y: 0, inHandle: { x: 80, y: -30 }, outHandle: { x: 120, y: 30 } },
      ]],
      closed: [true],
    };
    expect(curvatureComb(set, { scale: 1 }).map((c) => c.segIdx)).toEqual([0, 1]);
  });
});
