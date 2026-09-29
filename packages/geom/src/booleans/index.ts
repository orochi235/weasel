/**
 * `@weasel-js/geom/booleans` — polygon booleans on `Path` values, and the path
 * splitting built on them. The only geom entry that needs `polygon-clipping`,
 * which geom takes as an optional peer so the root barrel stays `deps: {}`.
 */
export { pathUnion, pathIntersect, pathSubtract, pathExclude, pathDivide, pathCrop } from './ops';
export { pathToMultiPolygon, multiPolygonToPath } from './adapter';
export type { Pair, Ring, Polygon, MultiPolygon, PathToMultiPolygonOptions } from './adapter';
export { splitPathBySegment, splitPathByPolyline, snipPathByPolyline, type SplitBySegmentOptions } from './splitBySegment';
