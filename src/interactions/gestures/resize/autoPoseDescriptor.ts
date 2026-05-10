import type { Path } from 'features/paths/types';
import { pathPoseDescriptor } from 'features/paths/poseDescriptor';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from './geometry';

/** True for Path-shaped poses (`{kind: 'polygon' | 'rect'}`). Useful for
 *  callers that need to fork between `pathPoseDescriptor` and
 *  `RECT_POSE_DESCRIPTOR` without forcing the consumer to wire `geometry`
 *  explicitly. */
export function isPathLike(p: unknown): p is Path {
  return !!p && typeof p === 'object' && 'kind' in p
    && ((p as { kind: unknown }).kind === 'polygon' || (p as { kind: unknown }).kind === 'rect');
}

/** Per-call dispatch: if the pose looks like a Path, route to
 *  `pathPoseDescriptor`; otherwise treat as a plain rect pose. Avoids forcing
 *  demos with Path TPose to wire `geometry={pathPoseDescriptor}` explicitly. */
export const AUTO_POSE_DESCRIPTOR: PoseDescriptor<unknown> = {
  getBounds: (p) => isPathLike(p)
    ? pathPoseDescriptor.getBounds(p)
    : RECT_POSE_DESCRIPTOR.getBounds(p as { x: number; y: number; width: number; height: number }),
  remapBounds: (p, src, dst) => isPathLike(p)
    ? pathPoseDescriptor.remapBounds(p, src, dst)
    : RECT_POSE_DESCRIPTOR.remapBounds(p as { x: number; y: number; width: number; height: number }, src, dst),
  translate: (p, dx, dy) => isPathLike(p)
    ? pathPoseDescriptor.translate!(p, dx, dy)
    : RECT_POSE_DESCRIPTOR.translate!(p as { x: number; y: number; width: number; height: number }, dx, dy),
  intersectsRect: (p, rect) => isPathLike(p)
    ? pathPoseDescriptor.intersectsRect!(p, rect)
    : RECT_POSE_DESCRIPTOR.intersectsRect!(p as { x: number; y: number; width: number; height: number }, rect),
};
