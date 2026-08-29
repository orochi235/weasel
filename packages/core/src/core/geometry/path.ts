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

// Opcodes live in @weasel-js/geom, which owns the command table every walker
// in every package derives coord counts from. Re-exported by name (never
// `export *`, which esbuild cannot enumerate across a package boundary).
export {
  PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z, PATH_CMD_LENGTHS, pathCommandCoordCount,
} from '@weasel-js/geom';

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
