/**
 * Path data model: the vector-graphics primitive every weasel package uses as
 * its canonical shape. An SVG-style command stream covers lines, polygons,
 * beziers and multi-contour shapes (the inner hole of an "O") under one type.
 *
 * Storage: command codes in a `Uint8Array`, parameters in a `Float32Array`.
 * Each command consumes a fixed number of coords (`PATH_CMD_LENGTHS`); walkers
 * step both arrays in lockstep, which keeps hot loops monomorphic and GC
 * pressure low under heavy edits.
 *
 * `RectPath` is split out at the type level so common-case machinery
 * (selection AABBs, area-select, rect hit-testing) can short-circuit without
 * the polygon kernel. Polymorphic kernels take the `Path` union and dispatch
 * on `kind`.
 */

/** Fill rule used by polygon path hit-testing and `ctx.fill()`. */
export type PathFillRule = 'nonzero' | 'evenodd';

/**
 * Polygon path with arbitrary contours and optional bezier segments.
 * Multi-contour: each `M` opens a new subpath; `Z` closes the current one.
 * Open subpaths (no `Z`) render as polylines and don't contribute to fills.
 */
export interface PolygonPath {
  kind: 'polygon';
  commands: Uint8Array;
  coords: Float32Array;
  fillRule: PathFillRule;
}

/**
 * Axis-aligned rectangle. Fast path for the (very common) case where the
 * shape is just a rect — preserves O(1) bounds and hit-test, avoids the
 * polygon kernel entirely. Promote to `PolygonPath` only when the shape
 * grows beyond what a rect can express.
 */
export interface RectPath {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Canonical path shape — either an axis-aligned rect (fast path) or a polygon command stream. */
export type Path = PolygonPath | RectPath;
