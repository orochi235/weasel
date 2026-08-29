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

import type { RectPose } from 'core/scene/types';
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
 * Axis-align a pose that carries a `rotation`: returns the AABB of the
 * rotated rectangle, with `rotation` dropped. Follows the kit's rotation
 * convention (`poseRotationOf`): rotate about the unrotated AABB center.
 *
 * Unrotated input is returned as-is.
 */
export function axisAlignedBounds<TPose extends RectPose>(b: TPose): RectPose {
  const rotation = b.rotation;
  if (!rotation) {
    // Strip an explicit `rotation: 0` so callers can rely on the absence of
    // the field meaning "axis-aligned".
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
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
    const dx = px - cx;
    const dy = py - cy;
    const rx = cx + dx * cos - dy * sin;
    const ry = cy + dx * sin + dy * cos;
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
