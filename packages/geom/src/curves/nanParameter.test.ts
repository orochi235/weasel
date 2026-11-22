import { describe, expect, it } from 'vitest';
import { bezierCubic } from './bezierCubic';
import { bezierQuadratic } from './bezierQuadratic';
import { curvatureSourceOf } from './curvatureSource';
import { nurbs } from './nurbs';
import { spiro } from './spiro';
import type { CurveRepresentation, SharedAnchor } from './types';

const anchors: SharedAnchor[] = [{ x: 0, y: 50 }, { x: 50, y: -50 }, { x: 100, y: 50 }];

describe.each<CurveRepresentation>([bezierCubic, bezierQuadratic, nurbs, spiro])('$kind at a NaN parameter', (rep) => {
  it('answers NaN rather than throwing', () => {
    const p = rep.evaluate(anchors, NaN);
    expect(p.x).toBeNaN();
    expect(p.y).toBeNaN();
    expect(() => rep.curvatureAt?.(anchors, NaN)).not.toThrow();
    expect(() => curvatureSourceOf(rep, anchors).pointAt(NaN)).not.toThrow();
  });
});
