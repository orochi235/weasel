/**
 * Boolean operations on `Path` values.
 *
 *   - Union, intersect, subtract and exclude keep curves: where any input has
 *     a curve, each curve in the result is a piece of an input curve
 *     (`curveBoolean`). Inputs of straight lines only, very large inputs, and
 *     the cases `curveBoolean` declines (self-crossing cubics, some
 *     tangencies) are flattened and clipped by `polygon-clipping`
 *     instead, so their result has only M/L/Z commands.
 *   - Divide, crop, trim, merge and the face pieces keep curves the same
 *     way (`curvePieces`), and fall back to the clipper in the same cases.
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
import { curveBoolean } from './curveBoolean';
import { curveDivide, curveMerge, curveTrim, type CurvePiece } from './curvePieces';
import type { Path, PolygonPath } from '../path';
import { keepCorners } from '../paths/cornerRestore';

/** `mp` as a path, with the corners of `sources` it still draws whole kept as corners. */
function toPath(mp: MultiPolygon, sources: readonly Path[]): PolygonPath {
  return keepCorners(sources, multiPolygonToPath(mp));
}

type Clip = (head: MultiPolygon, ...rest: MultiPolygon[]) => MultiPolygon;

/** `keep` over `paths` with curves kept, or `clip` on their flattening where that declines. */
function boolean(paths: Path[], keep: (inside: boolean[]) => boolean, clip: Clip): PolygonPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const curved = curveBoolean(paths, keep);
  if (curved) return keepCorners(paths, curved);
  const [head, ...rest] = paths.map((p) => pathToMultiPolygon(p));
  return toPath(clip(head, ...rest), paths);
}

const any = (inside: boolean[]): boolean => inside.includes(true);
const all = (inside: boolean[]): boolean => !inside.includes(false);
const aNotB = (inside: boolean[]): boolean => inside[0] && !inside[1];
const odd = (inside: boolean[]): boolean => inside.filter(Boolean).length % 2 === 1;

/** Union of N paths. Commutative. Returns an empty path if all inputs are empty. */
export function pathUnion(...paths: Path[]): PolygonPath {
  return boolean(paths, any, polygonClipping.union);
}

/** Intersection of N paths. Commutative. Empty result is an empty path. */
export function pathIntersect(...paths: Path[]): PolygonPath {
  return boolean(paths, all, polygonClipping.intersection);
}

/** Asymmetric difference: returns `a − b`. */
export function pathSubtract(a: Path, b: Path): PolygonPath {
  return boolean([a, b], aNotB, polygonClipping.difference);
}

/** Symmetric difference (XOR) of N paths: what an odd number of them cover. Commutative. */
export function pathExclude(...paths: Path[]): PolygonPath {
  return boolean(paths, odd, polygonClipping.xor);
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

/** Curved pieces with the corners of `sources` they still draw whole kept as corners. */
const cornered = (pieces: CurvePiece[], sources: readonly Path[]): BooleanPiece[] =>
  pieces.map(({ path, sources: s }) => ({ path: keepCorners(sources, path), sources: s }));

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
  const curved = curveDivide(paths, false);
  if (curved) return cornered(curved, paths);
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
  const curved = curveDivide(paths, true);
  if (curved) return cornered(curved, paths);
  return faces(paths).map(({ polygon, sources }) => ({ path: toPath([polygon], paths), sources }));
}

/**
 * Remove from each path what the paths after it cover (Illustrator "Trim"):
 * given back to front, every piece is the part of its input left showing.
 * One piece per input in input order, less the inputs wholly hidden.
 */
export function pathTrim(...paths: Path[]): BooleanPiece[] {
  const curved = curveTrim(paths);
  if (curved) return cornered(curved, paths);
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
  const curved = curveMerge(paths, keyOf);
  if (curved) return cornered(curved, paths);
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
  const mask = paths[paths.length - 1];
  const out: BooleanPiece[] = [];
  for (let i = 0; i < paths.length - 1; i++) {
    const clipped = pathIntersect(paths[i], mask);
    if (clipped.commands.length > 0) out.push({ path: clipped, sources: [i] });
  }
  return out;
}
