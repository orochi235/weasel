/**
 * The outline of a triangle mesh: the union of its triangles as one path.
 * This is what turns a tessellated shape back into geometry, e.g. a stroke's
 * ribbon into the region the stroke covers.
 */
import polygonClipping from 'polygon-clipping';
import { multiPolygonToPath, type MultiPolygon } from './adapter';
import { junctionRings } from './meshJunctions';
import type { PolygonPath } from '../path';

/**
 * Union the triangles of an indexed mesh (`vertices` as x, y pairs; `indices`
 * three per triangle) into canonical, non-overlapping rings. Overlaps count
 * once, triangles with no area are skipped, and a vertex lying on another
 * triangle's edge joins it there rather than leaving a crack. The result
 * holds only M/L/Z.
 */
export function trianglesToPath(vertices: ArrayLike<number>, indices: ArrayLike<number>): PolygonPath {
  const kept: number[] = [];
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = indices[i] * 2, b = indices[i + 1] * 2, c = indices[i + 2] * 2;
    const ax = vertices[a], ay = vertices[a + 1];
    if ((vertices[b] - ax) * (vertices[c + 1] - ay) - (vertices[c] - ax) * (vertices[b + 1] - ay) === 0) continue;
    kept.push(indices[i], indices[i + 1], indices[i + 2]);
  }
  if (kept.length === 0) return multiPolygonToPath([]);
  const [head, ...rest]: MultiPolygon[] = junctionRings(vertices, kept).map((ring) => [[ring]]);
  return multiPolygonToPath(polygonClipping.union(head, ...rest));
}
