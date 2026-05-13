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

  it('computes tight bounds for cubic Bezier — control points outside the curve do not expand the AABB', () => {
    // Control point 1 is at y=-20, but the curve itself only dips to about y=-2.27.
    // Loose bounds would report y=-20; tight bounds report the actual extremum.
    const p = new PathBuilder()
      .moveTo(0, 0)
      .curveTo(50, -20, 100, 100, 0, 50)
      .build();
    const b = boundsOfPath(p);
    expect(b.y).toBeGreaterThan(-3);
    expect(b.y).toBeLessThan(-2);
    expect(b.x).toBe(0);
    // Verify the curve fits within the reported bounds (sanity).
    expect(b.y + b.height).toBeGreaterThanOrEqual(50);
  });

  it('computes tight bounds for quadratic Bezier', () => {
    // Quadratic with control point above the endpoints: peak is at the midpoint
    // of control/endpoint average, not at the control point itself.
    const p = new PathBuilder()
      .moveTo(0, 0)
      .quadTo(50, -100, 100, 0)
      .build();
    const b = boundsOfPath(p);
    // Peak of (1-t)²·0 + 2(1-t)t·(-100) + t²·0 at t=0.5 → y = -50.
    expect(b.y).toBeCloseTo(-50, 5);
    expect(b.x).toBe(0);
    expect(b.width).toBe(100);
  });

  it('returns a zero rect for an empty polygon', () => {
    const p = polygonFromPoints([]);
    expect(boundsOfPath(p)).toEqual({ kind: 'rect', x: 0, y: 0, width: 0, height: 0 });
  });
});
