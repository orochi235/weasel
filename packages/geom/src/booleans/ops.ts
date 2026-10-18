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
import { pathToMultiPolygon, multiPolygonToPath, type MultiPolygon, type Polygon } from './adapter';
import { arrangementFaces } from './arrangementFaces';
import type { Path, PolygonPath } from '../path';
import { keepCorners } from '../paths/cornerRestore';

/** `mp` as a path, with the corners of `sources` it still draws whole kept as corners. */
function toPath(mp: MultiPolygon, sources: readonly Path[]): PolygonPath {
  return keepCorners(sources, multiPolygonToPath(mp));
}

/** Union of N paths. Commutative. Returns an empty path if all inputs are empty. */
export function pathUnion(...paths: Path[]): PolygonPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  return toPath(polygonClipping.union(head, ...rest), paths);
}

/** Intersection of N paths. Commutative. Empty result is an empty path. */
export function pathIntersect(...paths: Path[]): PolygonPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  return toPath(polygonClipping.intersection(head, ...rest), paths);
}

/** Asymmetric difference: returns `a − b`. */
export function pathSubtract(a: Path, b: Path): PolygonPath {
  return toPath(polygonClipping.difference(pathToMultiPolygon(a), pathToMultiPolygon(b)), [a, b]);
}

/** Symmetric difference (XOR) of N paths. Commutative. */
export function pathExclude(...paths: Path[]): PolygonPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  return toPath(polygonClipping.xor(head, ...rest), paths);
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

/** The faces the paths' outlines cut the plane into, each naming the inputs covering it. */
function faces(paths: Path[]): { polygon: Polygon; sources: number[] }[] {
  const clean = paths.map((p) => {
    const mp = pathToMultiPolygon(p);
    return mp.length === 0 ? mp : polygonClipping.union(mp);
  });
  return arrangementFaces(clean).map(({ mask, polygon }) => {
    const sources: number[] = [];
    for (let i = 0; i < paths.length; i++) if (mask & (1n << BigInt(i))) sources.push(i);
    return { polygon, sources };
  });
}

/**
 * Fracture N paths along every intersection into the maximal set of
 * non-overlapping regions. Returns one piece per set of inputs covering some
 * region, naming them. For N=2 these are the three Illustrator "Divide"
 * outputs (A−B, B−A, A∩B). Pieces with fewer sources come first.
 */
export function pathDividePieces(...paths: Path[]): BooleanPiece[] {
  const regions = new Map<string, { polygons: Polygon[]; sources: number[] }>();
  for (const { polygon, sources } of faces(paths)) {
    const key = sources.join(',');
    const region = regions.get(key);
    if (region) region.polygons.push(polygon);
    else regions.set(key, { polygons: [polygon], sources });
  }
  return [...regions.values()].map(({ polygons, sources }) => ({ path: toPath(polygons, paths), sources }));
}

/**
 * The faces the paths cut each other into: {@link pathDividePieces}, with a
 * region that falls apart split into one piece per connected part. A face
 * keeps its holes. Same order, a region's parts left to right.
 *
 * Traces the arrangement of the outlines once, so the cost grows with the
 * edges and their crossings rather than with the subsets of the inputs.
 */
export function pathFacePieces(...paths: Path[]): BooleanPiece[] {
  return faces(paths).map(({ polygon, sources }) => ({ path: toPath([polygon], paths), sources }));
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
    if (shown.length > 0) out.unshift({ path: toPath(shown, paths), sources: [i] });
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
    if (clipped.length > 0) out.push({ path: toPath(clipped, paths), sources: [i] });
  }
  return out;
}
