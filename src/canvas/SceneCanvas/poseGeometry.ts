/**
 * Pose-shape helpers shared by `<SceneCanvas>` internals.
 *
 * Mirrors Canvas's `AUTO_POSE_DESCRIPTOR` resolution: dispatches between the
 * path descriptor (for `{kind:'polygon'|'rect'}` poses) and the rect descriptor
 * for everything else. Used by hit-test, marquee, and bounds extraction so the
 * SceneCanvas defaults work uniformly across rect-shaped and path-shaped poses.
 */
import type { Bounds } from 'tools/builtin/useSelectTool';
import { RECT_POSE_DESCRIPTOR } from 'interactions/actions/resize/geometry';
import { pointInRotatedRect } from 'interactions/actions/rotate/geometry';
import { pathPoseDescriptor } from 'features/paths/poseDescriptor';
import type { Path } from 'features/paths/types';

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

/**
 * Containment for `<SceneCanvas>`'s default `pickEvery`. Delegates to
 * `poseContains` for path-shaped poses and unrotated rects. When the resize
 * geometry exposes a non-zero rotation for the pose, projects the click into
 * the pose's local frame and AABB-tests there. Path poses are intentionally
 * unaffected — their `kind` already encodes their geometry.
 */
export function poseContainsRotated<TPose>(
  pose: TPose,
  wx: number,
  wy: number,
  getRotation: ((pose: TPose) => number) | undefined,
): boolean {
  if (getRotation && !isPathLike(pose)) {
    const rot = getRotation(pose);
    if (rot) {
      const b = aabbOfPose(pose);
      return pointInRotatedRect({ ...b, rotation: rot }, wx, wy);
    }
  }
  return poseContains(pose, wx, wy);
}
