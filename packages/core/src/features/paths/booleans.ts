/**
 * Polygon-boolean operations on `Path` values. The kernel lives in
 * `@weasel-js/geom/booleans`; these are its kit-typed face.
 *
 * Core declares `polygon-clipping` even though nothing here imports it: geom
 * takes it as an optional peer, and core is what supplies it.
 *
 * v1 limitations (documented; see design doc):
 *   - Bezier inputs are flattened to straight-line segments before clipping.
 *     The result therefore contains only M/L/Z commands.
 *   - Open contours are treated as closed for boolean purposes (a polyline
 *     has zero area and would otherwise be silently dropped).
 *   - Output `fillRule` is always `'nonzero'`. The engine emits canonical
 *     non-overlapping rings, so the choice is cosmetic on its output.
 */
import {
  pathUnion as geomUnion,
  pathIntersect as geomIntersect,
  pathSubtract as geomSubtract,
  pathExclude as geomExclude,
  pathDivide as geomDivide,
  pathCrop as geomCrop,
} from '@weasel-js/geom/booleans';
import type { Path, PolygonPath } from './types';

/** Union of N paths. Commutative. Returns an empty path if all inputs are empty. */
export function pathUnion(...paths: Path[]): PolygonPath {
  return geomUnion(...paths);
}

/** Intersection of N paths. Commutative. Empty result is an empty path. */
export function pathIntersect(...paths: Path[]): PolygonPath {
  return geomIntersect(...paths);
}

/** Asymmetric difference: returns `a − b`. */
export function pathSubtract(a: Path, b: Path): PolygonPath {
  return geomSubtract(a, b);
}

/** Symmetric difference (XOR) of N paths. Commutative. */
export function pathExclude(...paths: Path[]): PolygonPath {
  return geomExclude(...paths);
}

/**
 * Fracture N paths along every intersection into the maximal set of
 * non-overlapping regions. Returns one `PolygonPath` per region.
 *
 * For N=2 this collapses to the three Illustrator "Divide" outputs
 * (A−B, B−A, A∩B). For N=3 up to 7 regions are emitted. The 2^N − 1
 * subset count limits this to small N in practice; passing more than ~8
 * inputs is a misuse — the polygon-clipping kernel dominates anyway.
 */
export function pathDivide(...paths: Path[]): PolygonPath[] {
  return geomDivide(...paths);
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
  return geomCrop(...paths);
}
