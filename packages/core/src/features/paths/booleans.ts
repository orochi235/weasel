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
 * Algorithm: for every non-empty subset S ⊆ {A1..AN}, emit the region
 * `(∩ S) − (∪ complement)` — points covered by exactly the members of S
 * and no others. By construction the emitted regions are pairwise disjoint
 * and their union equals `pathUnion(A1..AN)`.
 *
 * For N=2 this collapses to the three Illustrator "Divide" outputs
 * (A−B, B−A, A∩B). For N=3 up to 7 regions are emitted. The 2^N − 1
 * subset count limits this to small N in practice; passing more than ~8
 * inputs is a misuse — the polygon-clipping kernel dominates anyway.
 */
export function pathDivide(...paths: Path[]): PolygonPath[] {
  if (paths.length === 0) return [];
  if (paths.length === 1) {
    return [multiPolygonToPath(pathToMultiPolygon(paths[0]))];
  }
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const n = mps.length;
  const out: PolygonPath[] = [];

  // Iterate every non-empty subset via bitmask. Emit subsets in size-
  // ascending order so the output is stable and reads "exclusives first,
  // then pairs, then triples, …" — matches the old N=2 ordering.
  const subsets: number[] = [];
  for (let mask = 1; mask < 1 << n; mask++) subsets.push(mask);
  subsets.sort((a, b) => popcount(a) - popcount(b) || a - b);

  for (const mask of subsets) {
    const inside: typeof mps = [];
    const outside: typeof mps = [];
    for (let i = 0; i < n; i++) {
      (mask & (1 << i) ? inside : outside).push(mps[i]);
    }
    const [insideHead, ...insideRest] = inside;
    let region = insideRest.length === 0
      ? insideHead
      : polygonClipping.intersection(insideHead, ...insideRest);
    if (region.length === 0) continue;
    if (outside.length > 0) {
      const [outHead, ...outRest] = outside;
      const outsideUnion = polygonClipping.union(outHead, ...outRest);
      region = polygonClipping.difference(region, outsideUnion);
      if (region.length === 0) continue;
    }
    out.push(multiPolygonToPath(region));
  }

  return out;
}

function popcount(n: number): number {
  let c = 0;
  while (n) { n &= n - 1; c++; }
  return c;
}

/**
 * Clip each non-topmost path to the topmost path (Illustrator "Crop").
 * Returns `N − 1` results, one per source-below-top, in input order.
 * Discards the topmost path itself — it acts purely as the clipping mask.
 *
 * Empty results (a source that lies entirely outside the mask) are
 * filtered. With `<2` inputs the result is empty.
 */
export function pathCrop(...paths: Path[]): PolygonPath[] {
  if (paths.length < 2) return [];
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const mask = mps[mps.length - 1];
  const out: PolygonPath[] = [];
  for (let i = 0; i < mps.length - 1; i++) {
    const clipped = polygonClipping.intersection(mps[i], mask);
    if (clipped.length > 0) out.push(multiPolygonToPath(clipped));
  }
  return out;
}
