/**
 * A ribbon tessellated under a stroke metric is a world-space mesh that, taken
 * to the screen, is exactly `width × scale` wide in every direction — the
 * point of building it after the transform's linear part.
 */
import { describe, it, expect } from 'vitest';
import type { Path, Stroke } from '@weasel-js/core';
import { ellipsePath, linePath } from '@weasel-js/geom';
import { extractPolylines } from '@weasel-js/geom/tessellate';
import { tessellateStroke } from './stroke';
import { strokeSpaceOf } from './metric';

/** World → screen: 4:1, the anisotropy the TODO entry measured. */
const A = 4, D = 1;
const { scale, metric } = strokeSpaceOf(A, 0, 0, D);
const toScreen = (x: number, y: number): [number, number] => [A * x, D * y];

/** The ribbon's vertices, on screen. */
function screenVertices(path: Path, stroke: Stroke): [number, number][] {
  const mesh = tessellateStroke(path, stroke, { metric: metric! });
  const out: [number, number][] = [];
  for (let i = 0; i < mesh.vertices.length; i += 2) out.push(toScreen(mesh.vertices[i], mesh.vertices[i + 1]));
  return out;
}

/** Distance from (x, y) to the nearest segment of a screen polyline. */
function distanceToPolyline(x: number, y: number, pts: [number, number][], closed: boolean): number {
  let best = Infinity;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

/** A 1px stroke resolved the way the renderer resolves it under this metric. */
const onePx = (extra: Partial<Stroke> = {}): Stroke => ({
  paint: { color: '#000' }, width: 1 / scale, cap: 'butt', join: 'round', ...extra,
});

describe('tessellateStroke under a stroke metric', () => {
  it.each([
    ['horizontal', { x: 0, y: 10 }, { x: 50, y: 10 }],
    ['vertical', { x: 10, y: 0 }, { x: 10, y: 50 }],
    ['diagonal', { x: 0, y: 0 }, { x: 30, y: 40 }],
  ])('puts every vertex of a %s line half a pixel from it on screen', (_label, a, b) => {
    const line: [number, number][] = [toScreen(a.x, a.y), toScreen(b.x, b.y)];
    for (const [x, y] of screenVertices(linePath(a, b), onePx())) {
      expect(distanceToPolyline(x, y, line, false)).toBeCloseTo(0.5, 6);
    }
  });

  // Only the outer side is measured: a vertex on the inside of a bend sits
  // nearer the next segment than half a pixel, by the cosine of the turn.
  // On the outside of a convex outline every vertex is the offset end of its
  // own segment, bar the join pivots on the curve itself. A world-space ribbon
  // at the mean scale ranges from 0.25 to 1.
  it('puts every outer vertex of an ellipse half a pixel from its flattened outline', () => {
    const path = ellipsePath({ x: 0, y: 0, width: 40, height: 40 });
    const outline = extractPolylines(path)[0];
    const screen: [number, number][] = [];
    for (let i = 0; i < outline.points.length; i += 2) screen.push(toScreen(outline.points[i], outline.points[i + 1]));
    const outside = ([x, y]: [number, number]) => ((x - 80) / 80) ** 2 + ((y - 20) / 20) ** 2 > 1.005;
    const outer = screenVertices(path, onePx({ join: 'bevel' })).filter(outside);
    expect(outer.length).toBeGreaterThan(20);
    for (const [x, y] of outer) expect(distanceToPolyline(x, y, screen, true)).toBeCloseTo(0.5, 4);
  });

  it('outlines a rect with edges a pixel thick on both axes', () => {
    const path: Path = { kind: 'rect', x: 10, y: 10, width: 20, height: 40 };
    const xs = new Set<number>(), ys = new Set<number>();
    for (const [x, y] of screenVertices(path, onePx({ join: 'miter' }))) {
      xs.add(Math.round(x * 1e6) / 1e6);
      ys.add(Math.round(y * 1e6) / 1e6);
    }
    expect([...xs].sort((p, q) => p - q)).toEqual([39.5, 40, 40.5, 119.5, 120, 120.5]);
    expect([...ys].sort((p, q) => p - q)).toEqual([9.5, 10, 10.5, 49.5, 50, 50.5]);
  });

  it.each([['inner', [40.5, 119.5], [10.5, 49.5]], ['outer', [39.5, 120.5], [9.5, 50.5]]] as const)(
    'aligns a rect %s by a whole pixel on both axes',
    (align, [x0, x1], [y0, y1]) => {
      const path: Path = { kind: 'rect', x: 10, y: 10, width: 20, height: 40 };
      const xs: number[] = [], ys: number[] = [];
      for (const [x, y] of screenVertices(path, onePx({ join: 'miter', align }))) {
        xs.push(x);
        ys.push(y);
      }
      // The ribbon's middle runs half a pixel inside (or outside) the edge.
      const set = (v: number[]) => [...new Set(v.map((n) => Math.round(n * 1e6) / 1e6))].sort((p, q) => p - q);
      expect(set(xs)).toEqual([x0 - 0.5, x0, x0 + 0.5, x1 - 0.5, x1, x1 + 0.5]);
      expect(set(ys)).toEqual([y0 - 0.5, y0, y0 + 0.5, y1 - 0.5, y1, y1 + 0.5]);
    },
  );

  // Dash lengths are in the same units as the width: under a metric, the
  // resolved screen length over the scale, so a dash is that long on screen
  // whichever way the line runs.
  it.each([
    ['horizontal', { x: 0, y: 0 }, { x: 100, y: 0 }],
    ['vertical', { x: 0, y: 0 }, { x: 0, y: 100 }],
  ])('measures a %s dash on screen', (_label, a, b) => {
    const mesh = tessellateStroke(linePath(a, b), onePx({ dash: [6 / scale, 4 / scale] }), { metric: metric! });
    // Four vertices per butt-capped dash; the first dash spans its first four.
    const first: [number, number][] = [];
    for (let i = 0; i < 8; i += 2) first.push(toScreen(mesh.vertices[i], mesh.vertices[i + 1]));
    const along = first.map(([x, y]) => (a.x === b.x ? y : x));
    expect(Math.max(...along) - Math.min(...along)).toBeCloseTo(6, 6);
  });
});
