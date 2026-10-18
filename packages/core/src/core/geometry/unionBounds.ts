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

/** Compute the AABB envelope of a set of rect-shaped poses, ignoring any
 *  rotation they carry. See the module docstring before reaching for this
 *  over {@link unionAABB}. */
export function unionBounds<TPose extends RectPose>(poses: Iterable<TPose>): RectPose | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const p of poses) {
    any = true;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    const right = p.x + p.width;
    const bottom = p.y + p.height;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }
  if (!any) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Axis-align a pose that carries a `rotation` or a `transform`: returns the
 * AABB of the box as drawn, its four corners through `poseFrameOf`, with both
 * fields dropped.
 *
 * A pose with neither is returned as-is.
 */
export function axisAlignedBounds<TPose extends RectPose>(b: TPose): RectPose {
  const frame = poseFrameOf(b);
  if (!frame) {
    // Strip an explicit `rotation: 0` so callers can rely on the absence of
    // the field meaning "axis-aligned".
    return { x: b.x, y: b.y, width: b.width, height: b.height };
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
 * entries. Rotated parts are expanded via {@link axisAlignedBounds} first;
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
    any = true;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    const right = b.x + b.width;
    const bottom = b.y + b.height;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }
  if (!any) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
