/**
 * Path data model: the vector-graphics primitive every weasel package uses as
 * its canonical shape. An SVG-style command stream covers lines, polygons,
 * beziers and multi-contour shapes (the inner hole of an "O") under one type.
 *
 * Storage: command codes in a `Uint8Array`, parameters in a `Float32Array`.
 * Each command consumes a fixed number of coords (`PATH_CMD_LENGTHS`); walkers
 * step both arrays in lockstep.
 */

import type { CornerSpec } from './paths/cornerSpec';

/** Fill rule used by polygon path hit-testing and `ctx.fill()`. */
export type PathFillRule = 'nonzero' | 'evenodd';

/** Whether a fill closes an open subpath with a straight edge back to its
 *  start, as SVG and canvas do (`'close'`), or leaves it unfilled (`'none'`). */
export type PathOpenFill = 'close' | 'none';

/**
 * Polygon path with arbitrary contours and optional bezier segments.
 * Multi-contour: each `M` opens a new subpath; `Z` closes the current one.
 * An open subpath (no `Z`) strokes as a polyline; `openFill` says whether it
 * fills.
 */
export interface PolygonPath {
  kind: 'polygon';
  commands: Uint8Array;
  coords: Float32Array;
  fillRule: PathFillRule;
  /** Absent, the engine default: see `setDefaultOpenFill`. */
  openFill?: PathOpenFill;
  /**
   * Corner shapes, indexed by flat anchor index (`enumerateAnchors` order):
   * the anchor at each non-null slot is cut in a `corner-shape`
   * (`cornerShape.ts`). The commands and coords hold the bare anchors; `resolveCorners`
   * expands the specs into the geometry everything draws, hits, and bounds.
   */
  corners?: readonly (CornerSpec | null)[];
  /**
   * The point `coords` are measured from, in doubles: a coordinate pair
   * `(x, y)` stands for `(origin.x + x, origin.y + y)`. Absent is `(0, 0)`.
   * A float32 coordinate at 262,144 is on a 1/32 grid; one measured from an
   * origin beside the shape keeps its fraction. `PathBuilder.setOrigin`
   * builds one; the renderer, the tessellators and their bounds honor it.
   */
  origin?: { readonly x: number; readonly y: number };
}

/**
 * Axis-aligned rectangle. Fast path for the (very common) case where the
 * shape is just a rect — preserves O(1) bounds and hit-test, avoids the
 * polygon kernel entirely.
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
