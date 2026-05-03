/**
 * Path data model. Vector-graphics primitive used kit-wide as the canonical
 * shape (replacing per-shape ad-hoc poses). SVG-style command stream so we
 * cover lines, polygons, beziers, and multi-contour shapes (think the inner
 * hole of an "O") under one type.
 *
 * Storage: command codes in a `Uint8Array`, parameters in a `Float32Array`.
 * Each command consumes a fixed number of float coords from the parameter
 * array; the parser walks both arrays in lockstep. This keeps interaction
 * hot loops monomorphic and keeps GC pressure low under heavy edits.
 *
 * Two path subtypes are distinguished at the type level so common-case
 * machinery (selection AABBs, area-select intersection, hit-testing rect
 * silhouettes) can short-circuit on `RectPath` without paying the polygon
 * kernel cost. Polymorphic kernels accept either via the `Path` union and
 * dispatch on `kind`.
 */

/** Command codes. Numeric for fast Uint8Array dispatch. */
export const PATH_M = 0;
export const PATH_L = 1;
export const PATH_C = 2;
export const PATH_Q = 3;
export const PATH_Z = 4;

/** Float coords consumed by each command, indexed by command code. */
export const PATH_CMD_LENGTHS: readonly number[] = [2, 2, 6, 4, 0];

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

export type Path = PolygonPath | RectPath;
