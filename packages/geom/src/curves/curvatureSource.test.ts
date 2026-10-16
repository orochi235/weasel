import { describe, expect, it } from 'vitest';
import { combTeeth, curvatureComb } from '../paths/curvature';
import { bezierCubic } from './bezierCubic';
import { curvatureSourceOf } from './curvatureSource';
import { nurbs } from './nurbs';
import type { SharedAnchor } from './types';

describe('curvatureSourceOf', () => {
  it('stands the same comb on a cubic representation as the path comb does', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0, outHandle: { x: 30, y: -60 } },
      { x: 100, y: 0, inHandle: { x: 70, y: -20 } },
    ];
    const fromRep = combTeeth(curvatureSourceOf(bezierCubic, anchors), { scale: 500, samplesPerSegment: 7 });
    const [fromPath] = curvatureComb(
      { anchors: [anchors.map((a) => ({ ...a }))], closed: [false] },
      { scale: 500, samplesPerSegment: 7 },
    );
    fromRep.forEach((tooth, i) => {
      const want = fromPath.teeth[i];
      expect(tooth.x).toBeCloseTo(want.x, 4);
      expect(tooth.y).toBeCloseTo(want.y, 4);
      expect(tooth.tipX).toBeCloseTo(want.tipX, 2);
      expect(tooth.tipY).toBeCloseTo(want.tipY, 2);
    });
  });

  it('gives a straight NURBS teeth of no length', () => {
    const line: SharedAnchor[] = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }];
    for (const tooth of combTeeth(curvatureSourceOf(nurbs, line), { scale: 500, samplesPerSegment: 9 })) {
      expect(Math.hypot(tooth.tipX - tooth.x, tooth.tipY - tooth.y)).toBeCloseTo(0, 6);
    }
  });
});
