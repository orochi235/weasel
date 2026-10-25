/**
 * The shapes a built body can wear, as paths in the node's bounds.
 *
 * A name resolves through the outline table (`outlines/table.ts`), which
 * holds the built-ins and whatever `registerOutline` adds. A `Path` is the
 * escape hatch for a one-off shape: drawn in a unit square and stretched over
 * the bounds, as a mark is. Paths are built in world coordinates from the
 * bounds, the same way the kit's own `clipFromPose` factories are.
 */
import { rectPath, type Path } from '@weasel-js/core/math';
import { transformPath } from '@weasel-js/geom';
import { resolveOutline, type BuiltinOutline } from './outlines/table';
import type { Bounds, Size } from './outlines/types';

export type { Bounds, OutlineDef } from './outlines/types';
export type { BuiltinOutline } from './outlines/table';
export { outlineFromD, registerOutline } from './outlines/table';

/** A registered outline's name, or a path a consumer built themselves in a
 *  unit square — `(0, 0)` the box's top-left, `(1, 1)` its bottom-right — so
 *  it follows its node wherever layout or a drag puts it. */
export type Outline = BuiltinOutline | (string & {}) | Path;

/** The path `outline` describes inside `bounds`. A zero-area box gives a
 *  zero-area rect rather than a degenerate polygon. */
export function outlinePath(outline: Outline, bounds: Bounds): Path {
  const { x, y, width: w, height: h } = bounds;
  if (w <= 0 || h <= 0) return rectPath(x, y, Math.max(w, 0), Math.max(h, 0));
  if (typeof outline !== 'string') return transformPath(outline, [w, 0, 0, h, x, y]);
  return resolveOutline(outline).path(bounds);
}

/** The strokes `outline` draws over its fill — a cylinder's rim, a note's
 *  fold — or null when it has none. */
export function outlineDetail(outline: Outline, bounds: Bounds): Path | null {
  if (typeof outline !== 'string' || bounds.width <= 0 || bounds.height <= 0) return null;
  return resolveOutline(outline).detail?.(bounds) ?? null;
}

/**
 * The largest axis-aligned box a shape's content can occupy without leaving
 * the shape. Rows lay out in here, not in the bounds — a diamond's corners and
 * a parallelogram's lean are outside its own box, and a label placed against
 * the bounding box lands there and gets clipped away by the silhouette.
 */
export function contentBox(outline: Outline, bounds: Bounds): Bounds {
  if (typeof outline !== 'string') return bounds;
  return resolveOutline(outline).content?.(bounds) ?? bounds;
}

/** The box whose {@link contentBox} is at least `content` — the inverse, for
 *  sizing a node to what its rows measured. */
export function boxForContent(outline: Outline, content: Size): Size {
  if (typeof outline !== 'string') return content;
  return resolveOutline(outline).boxForContent?.(content) ?? content;
}
