import { describe, expect, it } from 'vitest';
import { bezierCubic } from './bezierCubic';
import { bezierQuadratic } from './bezierQuadratic';
import { nurbs } from './nurbs';
import type { SharedAnchor } from './types';

const arc: SharedAnchor[] = [{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 3, y: 2.5 }, { x: 4, y: 0 }];

describe('a curve rep answers curvature by the curve’s shape, not its size', () => {
  for (const rep of [bezierCubic, bezierQuadratic, nurbs]) {
    for (const scale of [1e-5, 1e-150, 1e120]) {
      it(`${rep.kind} at ${scale}`, () => {
        const scaled = arc.map((a) => ({ x: a.x * scale, y: a.y * scale }));
        for (const t of [0.1, 0.4, 0.8]) {
          const k = rep.curvatureAt(arc, t);
          expect(k).not.toBe(0);
          expect(rep.curvatureAt(scaled, t) * scale / k).toBeCloseTo(1, 6);
        }
      });
    }
  }
});
