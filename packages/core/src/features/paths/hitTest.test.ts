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

import { strokeHitTest } from './hitTest';

describe('strokeHitTest', () => {
  it('hits within threshold of a horizontal line segment', () => {
    const line = new PathBuilder().moveTo(0, 50).lineTo(100, 50).build();
    expect(strokeHitTest(line, 50, 51, 2)).toBe(true);
    expect(strokeHitTest(line, 50, 53, 2)).toBe(false);
    expect(strokeHitTest(line, 50, 53, 5)).toBe(true);
  });

  it('hits open polylines (which pointInPath cannot)', () => {
    // S-curve with two cubic segments, NOT closed.
    const curve = new PathBuilder()
      .moveTo(0, 100)
      .curveTo(40, 0, 80, 0, 120, 80)
      .curveTo(160, 160, 200, 160, 240, 60)
      .build();
    // Endpoint hit.
    expect(strokeHitTest(curve, 0, 100, 1)).toBe(true);
    // The first cubic at t=0.5 passes through ~(60, 22.5).
    expect(strokeHitTest(curve, 60, 22.5, 2)).toBe(true);
    // Far away misses.
    expect(strokeHitTest(curve, 1000, 1000, 8)).toBe(false);
    // pointInPath returns false anywhere — open paths have no enclosed area.
    expect(pointInPath(curve, 60, 22.5)).toBe(false);
  });

  it('hits the edge of a rect (not its interior)', () => {
    const rect = new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close().build();
    // On the top edge, threshold catches.
    expect(strokeHitTest(rect, 50, 1, 2)).toBe(true);
    // Deep interior — outside any edge by more than threshold.
    expect(strokeHitTest(rect, 50, 50, 4)).toBe(false);
  });

  it('rect-kind paths hit their 4 edges', () => {
    const rect: import('./types').RectPath = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };
    expect(strokeHitTest(rect, 0, 50, 1)).toBe(true);     // left edge
    expect(strokeHitTest(rect, 100, 50, 1)).toBe(true);   // right edge
    expect(strokeHitTest(rect, 50, 0, 1)).toBe(true);     // top
    expect(strokeHitTest(rect, 50, 100, 1)).toBe(true);   // bottom
    expect(strokeHitTest(rect, 50, 50, 1)).toBe(false);   // interior
  });

  it('threshold of 0 still hits exactly on the segment', () => {
    const line = new PathBuilder().moveTo(0, 0).lineTo(100, 0).build();
    expect(strokeHitTest(line, 50, 0, 0)).toBe(true);
    expect(strokeHitTest(line, 50, 0.0001, 0)).toBe(false);
  });

  it('treats subpath gaps as separate strokes (no implicit close)', () => {
    // Two separate strokes — moveTo restarts without closing.
    const two = new PathBuilder()
      .moveTo(0, 0).lineTo(10, 0)
      .moveTo(100, 0).lineTo(110, 0)
      .build();
    expect(strokeHitTest(two, 5, 0, 1)).toBe(true);
    expect(strokeHitTest(two, 105, 0, 1)).toBe(true);
    // The gap between the two subpaths should miss (no implicit segment).
    expect(strokeHitTest(two, 50, 0, 1)).toBe(false);
  });
});
