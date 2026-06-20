/**
 * Polygon-boolean operations on `GeomPath` values, backed by
 * `polygon-clipping`. Ported from `src/features/paths/booleans.ts`.
 *
 * v1 limitations (documented; see design doc):
 *   - Bezier inputs are flattened to straight-line segments before clipping.
 *     The result therefore contains only M/L/Z commands.
 *   - Open contours are treated as closed for boolean purposes (a polyline
 *     has zero area and would otherwise be silently dropped).
 *   - Output `fillRule` is always `'nonzero'`. The engine emits canonical
 *     non-overlapping rings, so the choice is cosmetic on its output.
 *
 * This is the ONLY geom module that depends on `polygon-clipping`; it lives in
 * the `@weasel-js/geom/booleans` subpath so the core stays `deps: {}`.
 */
import polygonClipping from 'polygon-clipping';
import { pathToMultiPolygon, multiPolygonToPath, type GeomPath, type GeomPolygonPath } from './adapter';

export type { GeomPath, GeomPolygonPath } from './adapter';

/** Union of N paths. Commutative. Returns an empty path if all inputs are empty. */
export function pathUnion(...paths: GeomPath[]): GeomPolygonPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  return multiPolygonToPath(polygonClipping.union(head, ...rest));
}

/** Intersection of N paths. Commutative. Empty result is an empty path. */
export function pathIntersect(...paths: GeomPath[]): GeomPolygonPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  return multiPolygonToPath(polygonClipping.intersection(head, ...rest));
}

/** Asymmetric difference: returns `a − b`. */
export function pathSubtract(a: GeomPath, b: GeomPath): GeomPolygonPath {
  return multiPolygonToPath(polygonClipping.difference(pathToMultiPolygon(a), pathToMultiPolygon(b)));
}

/** Symmetric difference (XOR) of N paths. Commutative. */
export function pathExclude(...paths: GeomPath[]): GeomPolygonPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  return multiPolygonToPath(polygonClipping.xor(head, ...rest));
}

/**
 * Fracture N paths along every intersection into the maximal set of
 * non-overlapping regions. Returns one polygon path per region.
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
export function pathDivide(...paths: GeomPath[]): GeomPolygonPath[] {
  if (paths.length === 0) return [];
  if (paths.length === 1) {
    return [multiPolygonToPath(pathToMultiPolygon(paths[0]))];
  }
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const n = mps.length;
  const out: GeomPolygonPath[] = [];

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
