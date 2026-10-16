import { describe, expect, it } from 'vitest';
import { linePath, rectPath } from './builder';
import { boundsOfPath } from './bounds';
import { pathFromD } from './pathFromD';
import { bendAlongPath } from './bendAlongPath';
import { pathToCubicContours } from './cubicContours';

describe('bendAlongPath', () => {
  it('lays a shape along a straight spine, stretched to its length', () => {
    const b = boundsOfPath(bendAlongPath(rectPath(0, 0, 10, 4), linePath({ x: 100, y: 50 }, { x: 200, y: 50 }))!);
    expect(b.x).toBeCloseTo(100, 3);
    expect(b.width).toBeCloseTo(100, 3);
    expect(b.y).toBeCloseTo(48, 3);
    expect(b.height).toBeCloseTo(4, 3);
  });

  it('keeps its width with natural fit', () => {
    const out = bendAlongPath(rectPath(0, 0, 10, 4), linePath({ x: 100, y: 50 }, { x: 200, y: 50 }), { fit: 'natural' })!;
    expect(boundsOfPath(out).width).toBeCloseTo(10, 3);
  });

  it('bends a straight edge round a curved spine, within tolerance, keeping the shape upright', () => {
    // Half a circle of radius 50 about (50, 0), over the top.
    const spine = pathFromD('M 0 0 A 50 50 0 0 1 100 0');
    const out = bendAlongPath(rectPath(0, 0, 100, 10), spine, { tolerance: 0.1, baseline: 1 })!;
    const [contour] = pathToCubicContours(out);
    expect(contour!.segs.length).toBeGreaterThan(4);
    for (const seg of contour!.segs) {
      for (const t of [0.25, 0.5, 0.75]) {
        // Upright along an arch, the strip's top is outside it: radius 50 to 60.
        const u = 1 - t;
        const c = seg.c;
        const x = u * u * u * c[0] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6];
        const y = u * u * u * c[1] + 3 * u * u * t * c[3] + 3 * u * t * t * c[5] + t * t * t * c[7];
        const r = Math.hypot(x - 50, y);
        expect(r).toBeGreaterThan(49.7);
        expect(r).toBeLessThan(60.3);
      }
    }
  });

  it('mirrors the shape across the spine with flip', () => {
    const out = bendAlongPath(rectPath(0, 0, 10, 4), linePath({ x: 0, y: 0 }, { x: 10, y: 0 }), { baseline: 0, flip: true })!;
    expect(boundsOfPath(out).y).toBeCloseTo(-4, 3);
  });

  it('answers null for a spine with no length', () => {
    expect(bendAlongPath(rectPath(0, 0, 1, 1), linePath({ x: 5, y: 5 }, { x: 5, y: 5 }))).toBeNull();
  });
});
