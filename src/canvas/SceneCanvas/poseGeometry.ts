/**
 * Pose-shape helpers shared by `<SceneCanvas>` internals.
 *
 * Mirrors Canvas's `AUTO_POSE_DESCRIPTOR` resolution: dispatches between the
 * path descriptor (for `{kind:'polygon'|'rect'}` poses) and the rect descriptor
 * for everything else. Used by hit-test, marquee, and bounds extraction so the
 * SceneCanvas defaults work uniformly across rect-shaped and path-shaped poses.
 */
import type { Bounds } from '../../tools/builtin/useSelectTool';
import { RECT_POSE_DESCRIPTOR } from '../../interactions/gestures/resize/geometry';
import { pathPoseDescriptor } from '../../features/paths/poseDescriptor';
import type { Path } from '../../features/paths/types';

export function isPathLike(p: unknown): p is Path {
  if (!p || typeof p !== 'object') return false;
  const k = (p as { kind?: unknown }).kind;
  return k === 'polygon' || k === 'rect';
}

export function aabbOfPose<TPose>(pose: TPose): Bounds {
  if (isPathLike(pose)) return pathPoseDescriptor.getBounds(pose);
  return RECT_POSE_DESCRIPTOR.getBounds(
    pose as { x: number; y: number; width: number; height: number },
  );
}

export function poseContains<TPose>(pose: TPose, wx: number, wy: number): boolean {
  if (isPathLike(pose) && pathPoseDescriptor.intersectsRect) {
    return pathPoseDescriptor.intersectsRect(pose, { x: wx, y: wy, width: 0, height: 0 });
  }
  const b = aabbOfPose(pose);
  return wx >= b.x && wx <= b.x + b.width && wy >= b.y && wy <= b.y + b.height;
}
