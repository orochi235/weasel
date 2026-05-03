import { describe, expect, it } from 'vitest';
import { boundsOfPath } from './bounds';
import { PathBuilder, polygonFromPoints, rectPath } from './builder';

describe('boundsOfPath', () => {
  it('returns the rect itself for RectPath (O(1) fast path)', () => {
    const r = rectPath(5, 7, 20, 30);
    expect(boundsOfPath(r)).toBe(r);
  });

  it('walks vertices for a polygon', () => {
    const p = polygonFromPoints([
      { x: 10, y: 10 }, { x: 30, y: 20 }, { x: 20, y: 40 },
    ]);
    expect(boundsOfPath(p)).toEqual({ kind: 'rect', x: 10, y: 10, width: 20, height: 30 });
  });

  it('includes bezier control points (loose bound, conservative)', () => {
    const p = new PathBuilder()
      .moveTo(0, 0)
      .curveTo(50, -20, 100, 100, 0, 50) // control 1 dips above
      .build();
    const b = boundsOfPath(p);
    expect(b.y).toBe(-20); // conservative: includes the high control point
    expect(b.x).toBe(0);
  });

  it('returns a zero rect for an empty polygon', () => {
    const p = polygonFromPoints([]);
    expect(boundsOfPath(p)).toEqual({ kind: 'rect', x: 0, y: 0, width: 0, height: 0 });
  });
});
