// src/features/paths/splitByLine.test.ts
import { describe, it, expect } from 'vitest';
import { splitPathByLine } from './splitByLine';
import { rectPath, polygonFromPoints } from './builder';
import { extractPolylines } from './tessellate/polyline';

const polyArea = (p: import('./types').Path): number => {
  // shoelace over the first contour's flattened points (test helper)
  let total = 0;
  for (const pl of extractPolylines(p) as Array<{ points: number[] }>) {
    const pts = pl.points; let a = 0;
    for (let i = 0; i < pts.length; i += 2) {
      const j = (i + 2) % pts.length;
      a += pts[i] * pts[j + 1] - pts[j] * pts[i + 1];
    }
    total += Math.abs(a) / 2;
  }
  return total;
};

describe('splitPathByLine', () => {
  it('returns null when the segment does not cross the path boundary', () => {
    const sq = rectPath(0, 0, 100, 100);
    expect(splitPathByLine(sq, { x: -50, y: 50 }, { x: -10, y: 50 })).toBeNull();
  });

  it('splits an axis-aligned square crossed left-to-right into two pieces', () => {
    const sq = rectPath(0, 0, 100, 100);
    const pieces = splitPathByLine(sq, { x: -20, y: 50 }, { x: 120, y: 50 });
    expect(pieces).not.toBeNull();
    expect(pieces!.length).toBe(2);
  });

  it('conserves total area across the cut', () => {
    const sq = rectPath(0, 0, 100, 100);
    const pieces = splitPathByLine(sq, { x: -20, y: 50 }, { x: 120, y: 50 })!;
    const sum = pieces.reduce((s, p) => s + polyArea(p), 0);
    expect(sum).toBeCloseTo(100 * 100, 0);
  });

  it('preserves fillRule on the pieces', () => {
    const tri = polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }], { fillRule: 'evenodd' });
    const pieces = splitPathByLine(tri, { x: -10, y: 40 }, { x: 110, y: 40 })!;
    expect(pieces.every((p) => p.kind === 'polygon' && p.fillRule === 'evenodd')).toBe(true);
  });

  it('returns null when only one side has area (degenerate/tangent)', () => {
    const sq = rectPath(0, 0, 100, 100);
    expect(splitPathByLine(sq, { x: -10, y: 0 }, { x: 110, y: 0 })).toBeNull();
  });
});
