/**
 * Union math over rect-shaped poses.
 *
 * Two answers, deliberately distinct. `unionBounds` folds the *unrotated*
 * boxes and is what commit-time actions want, because they go on to write
 * poses back in that same frame. `unionAABB` expands each rotated member to
 * the extent of its ink first, and is what anything a user looks at or clicks
 * wants — selection chrome, gesture bounds, an export viewBox. Folding the
 * unrotated box there under-reports the extent of a rotated member exactly
 * when the consumer is watching it move.
 */

import { applyToPoint } from '@weasel-js/geom';
import type { RectPose } from 'core/geometry/rectPose';
import { poseFrameOf } from '@weasel-js/geom';
export type { RectPose };

/** A box reaching a corner that is not finite has no extent to fold in: unions skip it as they skip a hole. */
function finiteCorners(x: number, y: number, x2: number, y2: number): boolean {
  const fin = Number.isFinite;
  return fin(x) && fin(y) && fin(x2) && fin(y2);
}

/** Compute the AABB envelope of a set of rect-shaped poses, ignoring any
 *  rotation they carry, and skipping one with a corner that is not finite. See the module docstring before reaching for this
 *  over {@link unionAABB}. */
export function unionBounds<TPose extends RectPose>(poses: Iterable<TPose>): RectPose | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const { x, y, width, height } of poses) {
    const x2 = x + width;
    const y2 = y + height;
    if (!finiteCorners(x, y, x2, y2)) continue;
    any = true;
    if (x < minX) minX = x;
    if (x2 < minX) minX = x2;
    if (x > maxX) maxX = x;
    if (x2 > maxX) maxX = x2;
    if (y < minY) minY = y;
    if (y2 < minY) minY = y2;
    if (y > maxY) maxY = y;
    if (y2 > maxY) maxY = y2;
  }
  if (!any) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** `b` with its extents made positive and its origin moved to match. A resize
 *  past the opposite edge leaves a bare box's width or height negative, the
 *  flip it carries, which every reader of a box assumes away. */
export function positiveBox<T extends RectPose>(b: T): T {
  if (b.width >= 0 && b.height >= 0) return b;
  return {
    ...b,
    x: b.width < 0 ? b.x + b.width : b.x,
    y: b.height < 0 ? b.y + b.height : b.y,
    width: Math.abs(b.width),
    height: Math.abs(b.height),
  };
}

/**
 * Axis-align a pose that carries a `rotation` or a `transform`: returns the
 * AABB of the box as drawn, its four corners through `poseFrameOf`, with both
 * fields dropped.
 *
 * A pose with neither comes back as its own box, made positive ({@link positiveBox}).
 */
export function axisAlignedBounds<TPose extends RectPose>(b: TPose): RectPose {
  const frame = poseFrameOf(b);
  if (!frame) {
    // Strip an explicit `rotation: 0` so callers can rely on the absence of
    // the field meaning "axis-aligned".
    const { x, y, width, height } = positiveBox(b);
    return { x, y, width, height };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const corners: ReadonlyArray<readonly [number, number]> = [
    [b.x, b.y],
    [b.x + b.width, b.y],
    [b.x + b.width, b.y + b.height],
    [b.x, b.y + b.height],
  ];
  for (const [px, py] of corners) {
    const [rx, ry] = applyToPoint(frame, px, py);
    if (rx < minX) minX = rx;
    if (rx > maxX) maxX = rx;
    if (ry < minY) minY = ry;
    if (ry > maxY) maxY = ry;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Fold every part into one world-space AABB, skipping `null` / `undefined`
 * entries and any whose drawn corners are not all finite. Rotated parts are expanded via {@link axisAlignedBounds} first;
 * the result never carries a `rotation` (a union of several oriented boxes
 * has no single orientation to report).
 *
 * Returns `null` when nothing was contributed.
 */
export function unionAABB<TPose extends RectPose>(
  parts: Iterable<TPose | null | undefined>,
): RectPose | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const part of parts) {
    if (!part) continue;
    const b = axisAlignedBounds(part);
    const right = b.x + b.width;
    const bottom = b.y + b.height;
    if (!finiteCorners(b.x, b.y, right, bottom)) continue;
    any = true;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }
  if (!any) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
