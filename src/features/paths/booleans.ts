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

/** Asymmetric difference: returns `a − b`. */
export function pathSubtract(a: Path, b: Path): PolygonPath {
  const result = polygonClipping.difference(
    pathToMultiPolygon(a),
    pathToMultiPolygon(b),
  );
  return multiPolygonToPath(result);
}

/** Symmetric difference (XOR) of N paths. Commutative. */
export function pathExclude(...paths: Path[]): PolygonPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  const result = polygonClipping.xor(head, ...rest);
  return multiPolygonToPath(result);
}

/**
 * Fracture N paths along every intersection into the maximal set of
 * non-overlapping regions. Returns one `PolygonPath` per region.
 *
 * Behavior:
 *   - For each input Ai, the exclusive region `Ai − (union of all Aj, j≠i)`
 *     is emitted if non-empty.
 *   - For each pair (Ai, Aj) with i<j, the overlap `Ai ∩ Aj` is emitted if
 *     non-empty.
 *
 * For N=2 this is exactly the three Illustrator "Divide" outputs. For N>2
 * it misses higher-order overlap distinctions (e.g. a region covered by 3
 * inputs is not separated from a region covered by only 2 of them when
 * those 2 are a subset). Documented as a v1 limitation; higher-order
 * decomposition is deferred.
 */
export function pathDivide(...paths: Path[]): PolygonPath[] {
  if (paths.length === 0) return [];
  if (paths.length === 1) {
    return [multiPolygonToPath(pathToMultiPolygon(paths[0]))];
  }
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const out: PolygonPath[] = [];

  // Exclusive regions: Ai − union(others).
  for (let i = 0; i < mps.length; i++) {
    const others = mps.filter((_, j) => j !== i);
    const [head, ...rest] = others;
    const othersUnion = polygonClipping.union(head, ...rest);
    const exclusive = polygonClipping.difference(mps[i], othersUnion);
    if (exclusive.length > 0) out.push(multiPolygonToPath(exclusive));
  }

  // Pairwise intersections (each pair once).
  for (let i = 0; i < mps.length; i++) {
    for (let j = i + 1; j < mps.length; j++) {
      const inter = polygonClipping.intersection(mps[i], mps[j]);
      if (inter.length > 0) out.push(multiPolygonToPath(inter));
    }
  }

  return out;
}
