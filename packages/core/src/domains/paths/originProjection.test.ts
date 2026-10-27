import { describe, expect, it } from 'vitest';
import { pathOriginProjection } from './originProjection';
import { boundsOfPath, polygonFromPoints, type PolygonPath } from './index';

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
