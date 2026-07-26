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

  it('diagonal cut of a square produces 2 pieces with conserved total area', () => {
    // Cut along the main diagonal but offset slightly off the corners so the
    // segment properly crosses both edges (exact corner touches hit the
    // proper-crossing exclusion and return null).
    const sq = rectPath(0, 0, 100, 100);
    const pieces = splitPathByLine(sq, { x: -5, y: -10 }, { x: 110, y: 105 });
    expect(pieces).not.toBeNull();
    expect(pieces!.length).toBe(2);
    // Total area must be conserved (≈ 100×100 = 10 000).
    const sum = pieces!.reduce((s, p) => s + polyArea(p), 0);
    expect(sum).toBeCloseTo(100 * 100, 0);
    // Each triangle should carry roughly half the area.
    for (const p of pieces!) {
      expect(polyArea(p)).toBeGreaterThan(1000);
    }
  });

  it('pins v1 concave over-cut behavior (regression tripwire)', () => {
    // An L-shaped concave polygon. The cut segment only PARTLY crosses the
    // visible stroke (entering the concave notch) but the implementation uses
    // the INFINITE line within a gated shape, so far-side crossings inside the
    // notch may be seen — accepted v1 limitation (see spec non-goals).
    // This test does NOT assert "ideal" behavior; it pins whatever v1 returns
    // so a future change can't silently alter it.
    const lShape = polygonFromPoints([
      { x: 0,   y: 0   },
      { x: 60,  y: 0   },
      { x: 60,  y: 40  },
      { x: 30,  y: 40  },
      { x: 30,  y: 100 },
      { x: 0,   y: 100 },
    ]);
    // Segment crosses only through the top arm of the L, not extending to the
    // bottom arm — but the infinite line does reach the bottom arm.
    const result = splitPathByLine(lShape, { x: -10, y: 20 }, { x: 70, y: 20 });
    // v1 actually cuts (infinite line crosses both arms); pin the piece count.
    // If this changes, investigate whether the concave-handling contract changed.
    expect(result).not.toBeNull();
    expect(result!.length).toBe(2);
  });
});
