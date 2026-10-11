/**
 * The outline of a triangle mesh: the union of its triangles as one path.
 * This is what turns a tessellated shape back into geometry, e.g. a stroke's
 * ribbon into the region the stroke covers.
 */
import polygonClipping from 'polygon-clipping';
import { multiPolygonToPath, type MultiPolygon } from './adapter';
import type { PolygonPath } from '../path';

/**
 * Union the triangles of an indexed mesh (`vertices` as x, y pairs; `indices`
 * three per triangle) into canonical, non-overlapping rings. Overlaps count
 * once, and triangles with no area are skipped. The result holds only M/L/Z.
 */
export function trianglesToPath(vertices: ArrayLike<number>, indices: ArrayLike<number>): PolygonPath {
  const triangles: MultiPolygon[] = [];
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = indices[i] * 2, b = indices[i + 1] * 2, c = indices[i + 2] * 2;
    const ax = vertices[a], ay = vertices[a + 1];
    const bx = vertices[b], by = vertices[b + 1];
    const cx = vertices[c], cy = vertices[c + 1];
    if ((bx - ax) * (cy - ay) - (cx - ax) * (by - ay) === 0) continue;
    triangles.push([[[[ax, ay], [bx, by], [cx, cy], [ax, ay]]]]);
  }
  if (triangles.length === 0) return multiPolygonToPath([]);
  const [head, ...rest] = triangles;
  return multiPolygonToPath(polygonClipping.union(head, ...rest));
}
