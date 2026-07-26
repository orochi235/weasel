import { describe, it, expect } from 'vitest';
import { bezierCubic } from './bezierCubic';
import { bezierQuadratic } from './bezierQuadratic';
import { nurbs } from './nurbs';
import { spiro } from './spiro';
import type { CurveRepresentation, SharedAnchor } from './types';

const sCurve: SharedAnchor[] = [
  { x: 0, y: 50 },
  { x: 50, y: -50 },
  { x: 100, y: 50 },
];

const reps: CurveRepresentation[] = [bezierCubic, bezierQuadratic, nurbs, spiro];

describe.each(reps)('CurveRepresentation contract: $kind', (rep) => {
  it('evaluate(t=0) returns the first anchor (within 1px)', () => {
    const p = rep.evaluate(sCurve, 0);
    expect(p.x).toBeCloseTo(sCurve[0].x, 0);
    expect(p.y).toBeCloseTo(sCurve[0].y, 0);
  });

  it('evaluate(t=1) returns the last anchor (within 1px)', () => {
    const p = rep.evaluate(sCurve, 1);
    expect(p.x).toBeCloseTo(sCurve[sCurve.length - 1].x, 0);
    expect(p.y).toBeCloseTo(sCurve[sCurve.length - 1].y, 0);
  });

  it('toPath returns a non-empty PolygonPath', () => {
    const path = rep.toPath(sCurve);
    expect(path.kind).toBe('polygon');
    expect(path.coords.length).toBeGreaterThan(2);
  });

  it('curvatureAt returns finite values across [0, 1]', () => {
    for (let i = 0; i <= 10; i++) {
      const k = rep.curvatureAt(sCurve, i / 10);
      expect(Number.isFinite(k)).toBe(true);
    }
  });

  it('toPath returns an empty polygon for empty anchor list', () => {
    const path = rep.toPath([]);
    expect(path.coords.length).toBe(0);
  });
});
