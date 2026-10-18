import { describe, expect, it } from 'vitest';
import {
  boundsOfPath, cubicPointAt, pathContainsPoint, pathToAnchors, PathBuilder, withCorner, type CornerSpec, type Path,
  type PolygonPath,
} from '@weasel-js/geom';
import { offsetPath } from './offsetPath';

const SQUARE: Path = new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close().build();

const bounds = (p: Path) => {
  const b = boundsOfPath(p);
  return [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 100) / 100);
};

describe('offsetPath', () => {
  it('grows a square by the distance, keeping its mitered corners', () => {
    const out = offsetPath(SQUARE, 10);
    expect(bounds(out)).toEqual([-10, -10, 120, 120]);
    expect(pathToAnchors(out).anchors[0]).toHaveLength(4);
  });

  it('rounds the corners with a round join, as curves rather than a polygon', () => {
    const out = offsetPath(SQUARE, 10, { join: 'round' });
    const sub = pathToAnchors(out).anchors[0];
    // Four flats and four quarter arcs.
    expect(sub).toHaveLength(8);
    const radii: number[] = [];
    for (let i = 0; i < sub.length; i++) {
      const a = sub[i], b = sub[(i + 1) % sub.length];
      for (let k = 0; k <= 20; k++) {
        const p = cubicPointAt(a, a.outHandle ?? a, b.inHandle ?? b, b, k / 20);
        if (p.x < 0 && p.y < 0) radii.push(Math.hypot(p.x, p.y));
      }
    }
    expect(Math.min(...radii)).toBeGreaterThan(9.8);
    expect(Math.max(...radii)).toBeLessThan(10.2);
  });

  it('shrinks with a negative distance, and leaves nothing past the middle', () => {
    expect(bounds(offsetPath(SQUARE, -10))).toEqual([10, 10, 80, 80]);
    expect(offsetPath(SQUARE, -60).commands).toHaveLength(0);
  });

  it('treats an open path as the region it fills', () => {
    const open = new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).build();
    const out = offsetPath(open, -5, { join: 'bevel' });
    expect(pathContainsPoint(out, 90, 20)).toBe(true);
    expect(pathContainsPoint(out, 10, 20)).toBe(false);
    expect(pathToAnchors(out as PolygonPath).closed.every(Boolean)).toBe(true);
  });

  it('answers the region itself at distance zero', () => {
    const rect = offsetPath({ kind: 'rect', x: 0, y: 0, width: 10, height: 20 }, 0);
    expect(bounds(rect)).toEqual([0, 0, 10, 20]);
  });

  describe('corner specs', () => {
    const cornered = (spec: CornerSpec) => withCorner(SQUARE as PolygonPath, 1, spec);
    const specsOf = (p: PolygonPath) => pathToAnchors(p).anchors.flat()
      .flatMap((a) => (a.corner ? [{ x: Math.round(a.x * 100) / 100, y: Math.round(a.y * 100) / 100, ...a.corner }] : []));

    it('keeps a round corner, grown by the distance about the same center', () => {
      const out = offsetPath(cornered({ shape: 'round', radius: 20 }), 10);
      const [spec] = specsOf(out);
      expect(spec).toMatchObject({ x: 110, y: -10, shape: 'round' });
      expect(spec!.radius).toBeCloseTo(30, 1);
    });

    it('keeps a round corner shrunk with the region', () => {
      const out = offsetPath(cornered({ shape: 'round', radius: 10 }), -5);
      const [spec] = specsOf(out);
      expect(spec).toMatchObject({ x: 95, y: 5, shape: 'round' });
      expect(spec!.radius).toBeCloseTo(5, 1);
    });

    it('expands a corner whose offset is no longer its shape', () => {
      const out = offsetPath(cornered({ shape: 'bevel', radius: 10 }), 10);
      expect(specsOf(out)).toEqual([]);
    });

    it('keeps every corner at distance zero', () => {
      expect(specsOf(offsetPath(cornered({ shape: 'bevel', radius: 10 }), 0))).toEqual([{ x: 100, y: 0, shape: 'bevel', radius: 10 }]);
    });
  });
});
