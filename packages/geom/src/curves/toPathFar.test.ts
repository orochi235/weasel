import { describe, expect, it } from 'vitest';
import { worldCoords } from '../paths/pathOrigin';
import { bezierCubic } from './bezierCubic';
import { bezierQuadratic } from './bezierQuadratic';
import { nurbs } from './nurbs';
import { spiro } from './spiro';

const anchors = [{ x: 1_000_000.3, y: 2_000_000.7 }, { x: 1_000_010.1, y: 2_000_005.3 }, { x: 1_000_020.9, y: 2_000_000.1 }];

describe('a curve rep writes a path far from 0 without float32 rounding', () => {
  for (const rep of [bezierCubic, bezierQuadratic, nurbs, spiro]) {
    it(rep.kind, () => {
      const path = rep.toPath(anchors);
      if (path.kind !== 'polygon') throw new Error('polygon expected');
      const w = worldCoords(path);
      expect(Math.abs(w[0] - anchors[0].x)).toBeLessThan(1e-3);
      expect(Math.abs(w[1] - anchors[0].y)).toBeLessThan(1e-3);
      expect(Math.abs(w[w.length - 2] - anchors[2].x)).toBeLessThan(1e-3);
      expect(Math.abs(w[w.length - 1] - anchors[2].y)).toBeLessThan(1e-3);
    });
  }
});
