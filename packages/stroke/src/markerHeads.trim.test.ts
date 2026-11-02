import { describe, it, expect } from 'vitest';
import {
  type PolygonPath, polygonFromPoints, polylineFromPoints, resolveCornersWithSources,
} from '@weasel-js/geom';
import { extractPolylines } from '@weasel-js/geom/tessellate';
import type { Stroke } from '@weasel-js/paint';
import { markerHeads, type MarkerHead } from './markerHeads';
import { tessellateStroke } from './tessellate/stroke';
import { windowPolylines } from './trim/windowPolylines';

const INK = { kind: 'solid', color: '#000' } as const;
const LINE = polylineFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }]);

/** An arrow's tip, at its anchor, and the direction from its back to the tip. */
function tip(head: MarkerHead): { x: number; y: number; angle: number } {
  const c = head.path.coords;
  const bx = (c[2] + c[4]) / 2, by = (c[3] + c[5]) / 2;
  return { x: c[0], y: c[1], angle: Math.atan2(c[1] - by, c[0] - bx) };
}

/** A dot's center. */
function center(head: MarkerHead): [number, number] {
  const c = head.path.coords;
  let x = 0, y = 0;
  for (let i = 0; i < c.length; i += 2) { x += c[i]; y += c[i + 1]; }
  return [x / (c.length / 2), y / (c.length / 2)];
}

describe('markerHeads under a trim', () => {
  it('end head rides the window front', () => {
    const heads = markerHeads(LINE, { paint: INK, width: 2, markerEnd: 'arrow', trim: { end: 0.5 } }, 2, undefined);
    expect(heads).toHaveLength(1);
    const t = tip(heads[0]);
    expect(t.x).toBeCloseTo(50, 4);
    expect(t.y).toBeCloseTo(0, 4);
    expect(t.angle).toBeCloseTo(0, 4);
  });

  it('mid markers appear only inside the span', () => {
    const path = polylineFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }]);
    const stroke: Stroke = { paint: INK, width: 1, markerMid: 'dot', trim: { end: { anchor: 2 } } };
    const heads = markerHeads(path, stroke, 1, undefined);
    expect(heads).toHaveLength(1);
    expect(center(heads[0])[0]).toBeCloseTo(10, 4);
  });

  it('closed subpath cut gets no start/end head', () => {
    const square = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
    const stroke: Stroke = { paint: INK, width: 1, markerStart: 'arrow', markerEnd: 'arrow', trim: { end: 0.5 } };
    expect(markerHeads(square, stroke, 1, undefined)).toEqual([]);
  });

  it('draws no head for an empty window', () => {
    const stroke: Stroke = { paint: INK, width: 2, markerEnd: 'arrow', trim: { start: 0.6, end: 0.4 } };
    expect(markerHeads(LINE, stroke, 2, undefined)).toEqual([]);
  });

  it('head meets the ribbon on a cornered path', () => {
    const cornered = {
      ...polylineFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]),
      corners: [null, { shape: 'round', radius: 20 }, null],
    } as PolygonPath;
    const stroke: Stroke = { paint: INK, width: 2, cap: 'butt', markerEnd: 'arrow', trim: { end: { anchor: 1 } } };
    const heads = markerHeads(cornered, stroke, 2, undefined);
    expect(heads).toHaveLength(1);
    const t = tip(heads[0]);

    const { path, anchorSources } = resolveCornersWithSources(cornered);
    const [{ polyline }] = windowPolylines(extractPolylines(path), stroke.trim, anchorSources)!;
    const ex = polyline.points[polyline.points.length - 2], ey = polyline.points[polyline.points.length - 1];
    expect(ex + ey).toBeCloseTo(100, 3);
    expect(Math.abs(t.x - ex)).toBeLessThan(1e-6);
    expect(Math.abs(t.y - ey)).toBeLessThan(1e-6);

    // The ribbon's last quad ends on that point, between its two edge vertices.
    const v = tessellateStroke(cornered, stroke).vertices;
    let best = Infinity;
    for (let i = 2; i * 2 + 3 < v.length; i += 4) {
      best = Math.min(best, Math.hypot((v[i * 2] + v[i * 2 + 2]) / 2 - ex, (v[i * 2 + 1] + v[i * 2 + 3]) / 2 - ey));
    }
    expect(best).toBeLessThan(1e-4);
  });
});
