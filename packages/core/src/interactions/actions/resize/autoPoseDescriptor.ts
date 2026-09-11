import type { Path } from 'features/paths/types';
import { pathPoseDescriptor } from 'features/paths/poseDescriptor';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from './geometry';
import type { Bounds } from 'core/viewport/fitViewToBounds';

/** True for Path-shaped poses (`{kind: 'polygon' | 'rect'}`). Useful for
 *  callers that need to fork between `pathPoseDescriptor` and
 *  `RECT_POSE_DESCRIPTOR` without forcing the consumer to wire `geometry`
 *  explicitly. */
export function isPathLike(p: unknown): p is Path {
  return !!p && typeof p === 'object' && 'kind' in p
    && ((p as { kind: unknown }).kind === 'polygon' || (p as { kind: unknown }).kind === 'rect');
}

/** True for a pose with numeric top-level `x`/`y`/`width`/`height` — the only
 *  shape the rect descriptor and the kit's built-in painters can read. */
export function isRectPose(p: unknown): p is { x: number; y: number; width: number; height: number; rotation?: number } {
  if (!p || typeof p !== 'object') return false;
  const r = p as Record<string, unknown>;
  return typeof r.x === 'number' && typeof r.y === 'number'
    && typeof r.width === 'number' && typeof r.height === 'number';
}

/** Per-call dispatch: if the pose looks like a Path, route to
 *  `pathPoseDescriptor`; otherwise treat as a plain rect pose. Avoids forcing
 *  demos with Path TPose to wire `geometry={pathPoseDescriptor}` explicitly.
 *  `getRotation` surfaces a `pose.rotation` field on non-Path poses so demos
 *  using rect-with-rotation shapes (e.g. `RotatedPose`) don't have to wire
 *  `geometry={ROTATED_POSE_DESCRIPTOR}` just to get rotated selection chrome
 *  and rotation-aware corner hit-tests. */
export const AUTO_POSE_DESCRIPTOR: PoseDescriptor<unknown> = {
  getBounds: (p) => isPathLike(p)
    ? pathPoseDescriptor.getBounds(p)
    : RECT_POSE_DESCRIPTOR.getBounds(p as { x: number; y: number; width: number; height: number }),
  remapBounds: (p, src, dst) => isPathLike(p)
    ? pathPoseDescriptor.remapBounds(p, src, dst)
    : RECT_POSE_DESCRIPTOR.remapBounds(p as { x: number; y: number; width: number; height: number }, src, dst),
  fromBounds: (b, template) => isPathLike(template)
    ? pathPoseDescriptor.fromBounds(b, template)
    : RECT_POSE_DESCRIPTOR.fromBounds(b, template as Bounds),
  translate: (p, dx, dy) => isPathLike(p)
    ? pathPoseDescriptor.translate!(p, dx, dy)
    : RECT_POSE_DESCRIPTOR.translate!(p as { x: number; y: number; width: number; height: number }, dx, dy),
  intersectsRect: (p, rect) => isPathLike(p)
    ? pathPoseDescriptor.intersectsRect!(p, rect)
    : RECT_POSE_DESCRIPTOR.intersectsRect!(p as { x: number; y: number; width: number; height: number }, rect),
  getRotation: (p) => {
    if (isPathLike(p)) return 0;
    const r = (p as { rotation?: unknown }).rotation;
    return typeof r === 'number' ? r : 0;
  },
  // Path-shaped poses can't carry rotation (see `pathPoseDescriptor`).
  // Everything else flows through `wrapWithPoseRotation`'s x/y/w/h gate at
  // paint time, so report `true` and let the wrapper no-op for poses
  // missing AABB fields.
  supportsRotation: (p) => !isPathLike(p),
  withRotation: (p, rotation) => isPathLike(p) ? p : { ...(p as object), rotation },
};
