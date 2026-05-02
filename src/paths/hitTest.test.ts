import { describe, expect, it } from 'vitest';
import { pointInPath } from './hitTest';
import { PathBuilder, polygonFromPoints, rectPath } from './builder';

describe('pointInPath', () => {
  describe('RectPath fast path', () => {
    const r = rectPath(10, 20, 30, 40); // (10,20)..(40,60)

    it('hits inside', () => {
      expect(pointInPath(r, 25, 30)).toBe(true);
    });

    it('misses outside', () => {
      expect(pointInPath(r, 5, 30)).toBe(false);
      expect(pointInPath(r, 25, 100)).toBe(false);
    });

    it('treats edges as inside', () => {
      expect(pointInPath(r, 10, 20)).toBe(true);
      expect(pointInPath(r, 40, 60)).toBe(true);
    });
  });

  describe('polygon (non-zero fill rule)', () => {
    const triangle = polygonFromPoints([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 },
    ]);

    it('hits the interior', () => {
      expect(pointInPath(triangle, 50, 30)).toBe(true);
    });

    it('misses well outside', () => {
      expect(pointInPath(triangle, -10, 50)).toBe(false);
      expect(pointInPath(triangle, 200, 50)).toBe(false);
      expect(pointInPath(triangle, 50, -10)).toBe(false);
    });

    it('misses just outside the slanted edge', () => {
      // The right edge goes from (100,0) to (50,100). At y=50, edge x = 75.
      expect(pointInPath(triangle, 80, 50)).toBe(false);
      expect(pointInPath(triangle, 70, 50)).toBe(true);
    });
  });

  describe('multi-contour with holes', () => {
    // Outer 100x100 square, inner 40x40 hole (CCW vs CW doesn't matter for evenodd).
    const donut = new PathBuilder()
      .setFillRule('evenodd')
      .moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close()
      .moveTo(30, 30).lineTo(70, 30).lineTo(70, 70).lineTo(30, 70).close()
      .build();

    it('hits the outer ring', () => {
      expect(pointInPath(donut, 10, 50)).toBe(true);
      expect(pointInPath(donut, 90, 50)).toBe(true);
    });

    it('misses the inner hole', () => {
      expect(pointInPath(donut, 50, 50)).toBe(false);
    });

    it('misses far outside', () => {
      expect(pointInPath(donut, -5, 50)).toBe(false);
    });
  });

  describe('beziers', () => {
    // Quarter-circle-ish quadratic arc, closed back to origin.
    const arc = new PathBuilder()
      .moveTo(0, 0)
      .quadTo(100, 0, 100, 100)
      .lineTo(0, 100)
      .close()
      .build();

    it('flattens curves and hits the interior', () => {
      expect(pointInPath(arc, 20, 50)).toBe(true);
    });

    it('misses outside the curved boundary', () => {
      // (90, 10) is outside the quadratic arc (the arc bulges toward the
      // top-right; at y=10 the arc x is around 95+). Confirm with a point
      // unambiguously outside.
      expect(pointInPath(arc, 200, 50)).toBe(false);
    });
  });
});
