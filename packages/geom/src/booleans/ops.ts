/**
 * Polygon-boolean operations on `Path` values, backed by `polygon-clipping`.
 *
 *   - Bezier inputs are flattened to straight-line segments before clipping,
 *     so the result contains only M/L/Z commands.
 *   - Open contours are treated as closed (a polyline has zero area and would
 *     otherwise be silently dropped).
 *   - Output `fillRule` is always `'nonzero'`.
 *
 * This is the only geom module that depends on `polygon-clipping`; it lives in
 * the `@weasel-js/geom/booleans` subpath so the core stays `deps: {}`.
 */
import polygonClipping from 'polygon-clipping';
import { pathToMultiPolygon, multiPolygonToPath } from './adapter';
import type { Path, PolygonPath } from '../path';

/** Union of N paths. Commutative. Returns an empty path if all inputs are empty. */
export function pathUnion(...paths: Path[]): PolygonPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  return multiPolygonToPath(polygonClipping.union(head, ...rest));
}

/** Intersection of N paths. Commutative. Empty result is an empty path. */
export function pathIntersect(...paths: Path[]): PolygonPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  return multiPolygonToPath(polygonClipping.intersection(head, ...rest));
}

/** Asymmetric difference: returns `a − b`. */
export function pathSubtract(a: Path, b: Path): PolygonPath {
  return multiPolygonToPath(polygonClipping.difference(pathToMultiPolygon(a), pathToMultiPolygon(b)));
}

/** Symmetric difference (XOR) of N paths. Commutative. */
export function pathExclude(...paths: Path[]): PolygonPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  return multiPolygonToPath(polygonClipping.xor(head, ...rest));
}

/** One path of a result that keeps its pieces apart, and the inputs it came
 *  from: their indices in the call, ascending, so the last is the topmost of
 *  inputs given back to front. */
export interface BooleanPiece {
  path: PolygonPath;
  sources: number[];
}

/** {@link pathDividePieces} as bare paths. */
export function pathDivide(...paths: Path[]): PolygonPath[] {
  return pathDividePieces(...paths).map((p) => p.path);
}

/** {@link pathCropPieces} as bare paths. */
export function pathCrop(...paths: Path[]): PolygonPath[] {
  return pathCropPieces(...paths).map((p) => p.path);
}

/**
 * Fracture N paths along every intersection into the maximal set of
 * non-overlapping regions. Returns one piece per region, naming every input
 * that covers it. For N=2 these are the three Illustrator "Divide" outputs
 * (A−B, B−A, A∩B).
 *
 * One region per non-empty subset of the inputs, so the 2^N − 1 subset count
 * limits this to small N; passing more than ~8 inputs is a misuse.
 */
export function pathDividePieces(...paths: Path[]): BooleanPiece[] {
  if (paths.length === 0) return [];
  if (paths.length === 1) {
    return [{ path: multiPolygonToPath(pathToMultiPolygon(paths[0])), sources: [0] }];
  }
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const n = mps.length;
  const out: BooleanPiece[] = [];

  // Size-ascending, so the output is stable: exclusives first, then pairs,
  // then triples, …
  const subsets: number[] = [];
  for (let mask = 1; mask < 1 << n; mask++) subsets.push(mask);
  subsets.sort((a, b) => popcount(a) - popcount(b) || a - b);

  for (const mask of subsets) {
    const inside: typeof mps = [];
    const outside: typeof mps = [];
    const sources: number[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) sources.push(i);
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
    out.push({ path: multiPolygonToPath(region), sources });
  }

  return out;
}

/**
 * Remove from each path what the paths after it cover (Illustrator "Trim"):
 * given back to front, every piece is the part of its input left showing.
 * One piece per input in input order, less the inputs wholly hidden.
 */
export function pathTrim(...paths: Path[]): BooleanPiece[] {
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const out: BooleanPiece[] = [];
  // Front to back, so the cover over each input is built once.
  let cover: (typeof mps)[number] | null = null;
  for (let i = mps.length - 1; i >= 0; i--) {
    const shown = cover ? polygonClipping.difference(mps[i], cover) : mps[i];
    if (shown.length > 0) out.unshift({ path: multiPolygonToPath(shown), sources: [i] });
    cover = cover ? polygonClipping.union(cover, mps[i]) : mps[i];
  }
  return out;
}

/**
 * {@link pathTrim}, then unite the pieces of the inputs `keyOf` gives the same
 * key (Illustrator "Merge", keyed by paint). Keys compare with `===`. A piece
 * names every input left showing in it, and the pieces are ordered by their
 * topmost one. Pieces that share a key and do not touch come back as one path
 * of several contours.
 */
export function pathMerge(paths: readonly Path[], keyOf: (index: number) => unknown): BooleanPiece[] {
  const groups = new Map<unknown, BooleanPiece[]>();
  for (const piece of pathTrim(...paths)) {
    const key = keyOf(piece.sources[0]!);
    const group = groups.get(key);
    if (group) group.push(piece);
    else groups.set(key, [piece]);
  }
  const top = (p: BooleanPiece): number => p.sources[p.sources.length - 1]!;
  return [...groups.values()]
    .map((g): BooleanPiece => (g.length === 1 ? g[0]! : {
      path: pathUnion(...g.map((p) => p.path)),
      sources: g.map((p) => p.sources[0]!),
    }))
    .sort((a, b) => top(a) - top(b));
}

function popcount(n: number): number {
  let c = 0;
  while (n) { n &= n - 1; c++; }
  return c;
}

/**
 * Clip each non-topmost path to the topmost path (Illustrator "Crop"), which
 * acts purely as the mask and is discarded. Returns up to `N - 1` pieces in
 * input order, each naming the one input it was clipped from; a source
 * entirely outside the mask is dropped.
 */
export function pathCropPieces(...paths: Path[]): BooleanPiece[] {
  if (paths.length < 2) return [];
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const mask = mps[mps.length - 1];
  const out: BooleanPiece[] = [];
  for (let i = 0; i < mps.length - 1; i++) {
    const clipped = polygonClipping.intersection(mps[i], mask);
    if (clipped.length > 0) out.push({ path: multiPolygonToPath(clipped), sources: [i] });
  }
  return out;
}
