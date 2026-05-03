import { describe, expect, it } from 'vitest';
import { pathOriginProjection } from './originProjection';
import { boundsOfPath, polygonFromPoints, type PolygonPath } from './index';
import { gridSnapStrategy } from '../../interactions/gestures/shared';
import type { GestureContext } from '../../interactions/gestures/types';
import type { Path } from './index';

const ctx = {} as unknown as GestureContext<Path>;

describe('pathOriginProjection', () => {
  it('reports the AABB top-left as origin and translates every coord on write', () => {
    const tri = polygonFromPoints([
      { x: 5, y: 7 },
      { x: 15, y: 7 },
      { x: 10, y: 17 },
    ]);
    expect(pathOriginProjection.getOrigin(tri)).toEqual({ x: 5, y: 7 });

    const moved = pathOriginProjection.translate(tri, 10, -7) as PolygonPath;
    expect(boundsOfPath(moved)).toEqual({
      kind: 'rect',
      x: 15,
      y: 0,
      width: 10,
      height: 10,
    });
  });
});

describe('gridSnapStrategy + pathOriginProjection', () => {
  it('snaps a Path so its bounds top-left lands on the grid', () => {
    const tri = polygonFromPoints([
      { x: 7, y: 13 },
      { x: 17, y: 13 },
      { x: 12, y: 23 },
    ]);
    const strategy = gridSnapStrategy<Path>(10, { origin: pathOriginProjection });
    const snapped = strategy.snap(tri, ctx) as PolygonPath;
    const b = boundsOfPath(snapped);
    expect(b.x).toBe(10);
    expect(b.y).toBe(10);
    // Width/height preserved.
    expect(b.width).toBe(10);
    expect(b.height).toBe(10);
  });
});
