/**
 * The outline of a triangle mesh: the union of its triangles as one path.
 * This is what turns a tessellated shape back into geometry, e.g. a stroke's
 * ribbon into the region the stroke covers.
 */
import { clipper } from './clipper';
import { multiPolygonToPath } from './adapter';
import { junctionRings } from './meshJunctions';
import { meshEdges, meshOutline } from './meshOutline';
import { coverageBoundary } from './coverageBoundary';
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
  const rings = junctionRings(vertices, kept);
  const loops = coverageBoundary(meshEdges(rings));
  if (loops === null) {
    const outline = meshOutline(rings);
    return multiPolygonToPath(outline ? clipper.union([[outline]]) : []);
  }
  // The loops bound the region, outer ones counterclockwise and holes clockwise, so they fill it as they stand. A
  // clipper pass over them would only rebuild them, and at a stroke a million wide it dropped some of its slivers.
  return multiPolygonToPath(loops.map((loop) => [loop]));
}
