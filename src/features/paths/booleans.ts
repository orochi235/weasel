/**
 * Polygon-boolean operations on `Path` values, backed by `polygon-clipping`.
 *
 * v1 limitations (documented; see design doc):
 *   - Bezier inputs are flattened to straight-line segments before clipping.
 *     The result therefore contains only M/L/Z commands.
 *   - Open contours are treated as closed for boolean purposes (a polyline
 *     has zero area and would otherwise be silently dropped).
 *   - Output `fillRule` is always `'nonzero'`. The engine emits canonical
 *     non-overlapping rings, so the choice is cosmetic on its output.
 */
import polygonClipping from 'polygon-clipping';
import type { Path, PolygonPath } from './types';
import { pathToMultiPolygon, multiPolygonToPath } from './booleans.adapter';

/** Union of N paths. Commutative. Returns an empty path if all inputs are empty. */
export function pathUnion(...paths: Path[]): PolygonPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  const result = polygonClipping.union(head, ...rest);
  return multiPolygonToPath(result);
}

/** Intersection of N paths. Commutative. Empty result is an empty path. */
export function pathIntersect(...paths: Path[]): PolygonPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  const result = polygonClipping.intersection(head, ...rest);
  return multiPolygonToPath(result);
}
