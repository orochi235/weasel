/**
 * `@weasel-js/geom/booleans` — booleans on `Path` values, curve-preserving
 * where an input has curves, and the path splitting built on them. The only geom entry that needs `polygon-clipping`,
 * which geom takes as an optional peer so the root barrel stays `deps: {}`.
 *
 * @packageDocumentation
 */
export {
  pathUnion, pathIntersect, pathSubtract, pathExclude, pathDivide, pathCrop,
  pathDividePieces, pathFacePieces, pathCropPieces, pathTrim, pathMerge, type BooleanPiece,
} from './ops';
export { trianglesToPath } from './trianglesToPath';
export { pathToMultiPolygon, multiPolygonToPath } from './adapter';
export type { Pair, Ring, Polygon, MultiPolygon, PathToMultiPolygonOptions } from './adapter';
export { splitPathBySegment, splitPathByPolyline, snipPathByPolyline, type SplitBySegmentOptions } from './splitBySegment';
export { snipPathsAtCrossings, type SnipAtCrossingsOptions } from './snipAtCrossings';
