/**
 * Pose-flip helpers used by `flipAction` (via `defaults/flip.ts`).
 *
 * These were extracted from the legacy `useFlip` hook when it was removed —
 * they remain because the descriptor-style `flipAction` still needs to reflect
 * arbitrary `TPose` values through a `PoseProjection`.
 */
import type { PoseProjection } from '../resize/geometry';

/** Axis for flip. `'x'` mirrors horizontally (left↔right); `'y'` mirrors vertically (top↔bottom). */
export type FlipAxis = 'x' | 'y';

/** How a multi-selection flip chooses its pivot.
 *
 *  - `'each'` — every pose mirrors about its own AABB; spatial layout of the
 *    selection is unchanged, individual items are reflected in place.
 *  - `'union'` — every pose mirrors about the selection's union AABB; items
 *    swap sides as well as reflect, matching Illustrator/Figma defaults. */
export type FlipPivot = 'each' | 'union';

/** Reflect `pose` across the centerline of `pivotBounds` along `axis`, using
 *  `geometry` to read bounds and remap. The pose's own AABB is read once to
 *  compute the reflected destination rect; coords inside the pose are then
 *  remapped through the affine that takes its own bounds → reflected dst.
 *  A rotation the pose carries is negated: a mirror reverses the sense of the
 *  turn, and `remapBounds` carries the original angle through untouched. */
export function flipPoseAboutBounds<TPose>(
  pose: TPose,
  axis: FlipAxis,
  geometry: PoseProjection<TPose>,
  pivotBounds: { x: number; y: number; width: number; height: number },
): TPose {
  const src = geometry.getBounds(pose);
  const cxPivot = pivotBounds.x + pivotBounds.width / 2;
  const cyPivot = pivotBounds.y + pivotBounds.height / 2;
  const dst = axis === 'x'
    ? { x: 2 * cxPivot - src.x, y: src.y, width: -src.width, height: src.height }
    : { x: src.x, y: 2 * cyPivot - src.y, width: src.width, height: -src.height };
  const next = geometry.remapBounds(pose, src, dst);
  const rotation = geometry.getRotation?.(pose) ?? (src as { rotation?: number }).rotation ?? 0;
  return negateRotation(normalizeNegativeExtent(next), rotation);
}

/** Reflect `pose` across the centerline of its own AABB along `axis`. */
export function flipPoseViaDescriptor<TPose>(
  pose: TPose,
  axis: FlipAxis,
  geometry: PoseProjection<TPose>,
): TPose {
  return flipPoseAboutBounds(pose, axis, geometry, geometry.getBounds(pose));
}

/** `PoseProjection` reads rotation but has no writer, so the mirrored angle
 *  goes back onto `RectPose.rotation` — the kit's only writable rotation. A
 *  pose model without that field (Path) reports 0 and is left alone. */
function negateRotation<TPose>(pose: TPose, rotation: number): TPose {
  if (rotation === 0) return pose;
  const current = (pose as { rotation?: unknown }).rotation;
  if (typeof current !== 'number') return pose;
  return { ...(pose as object), rotation: -current } as TPose;
}

function normalizeNegativeExtent<TPose>(pose: TPose): TPose {
  const p = pose as unknown as { x?: number; y?: number; width?: number; height?: number };
  let mutated = false;
  let nx = p.x;
  let ny = p.y;
  let nw = p.width;
  let nh = p.height;
  if (typeof nw === 'number' && nw < 0 && typeof nx === 'number') {
    nx = nx + nw;
    nw = -nw;
    mutated = true;
  }
  if (typeof nh === 'number' && nh < 0 && typeof ny === 'number') {
    ny = ny + nh;
    nh = -nh;
    mutated = true;
  }
  if (!mutated) return pose;
  return { ...(pose as object), x: nx, y: ny, width: nw, height: nh } as TPose;
}
