import { localToWorld, normalToWorld, targetTransformOf } from 'core/geometry/targetFrame';
import { ROTATION_HANDLE_BASE_PX } from 'core/device/targets';
import { standoff, type PoseLinear, type Scale2 } from '@weasel-js/geom';

/** Default world-space distance from the rect's top edge to the rotation
 *  handle's center. Matches the demo's visual default; consumers can
 *  override per-call. Unscaled — kit-internal use sites multiply by
 *  `DeviceProfile.targetScale`. */
export const DEFAULT_ROTATION_HANDLE_DISTANCE = ROTATION_HANDLE_BASE_PX;

/** Rotation handle position in world coords. */
export interface RotationHandle {
  /** Handle center in world coords. */
  cx: number;
  cy: number;
  /** How far the handle is turned on screen, radians: the angle from screen
   *  up to the top edge's outward normal as it lands there. Equals the pose
   *  rotation under uniform zoom. */
  angle: number;
}

/** Rotation handle for a box as its frame draws it: `distance` pixels off the
 *  top edge's midpoint, along that edge's outward normal as it lands on a
 *  screen whose per-axis zoom is `scale`. With no `scale`, a pixel is a world
 *  unit. */
export function rotationHandle(
  pose: { x: number; y: number; width: number; height: number; rotation?: number; transform?: PoseLinear },
  distance: number = DEFAULT_ROTATION_HANDLE_DISTANCE,
  scale: Scale2 = UNIT_SCALE,
): RotationHandle {
  const xf = targetTransformOf(pose);
  const top = localToWorld(xf, pose.x + pose.width / 2, pose.y);
  const p = standoff(top, normalToWorld(xf, { x: 0, y: -1 }), distance, scale);
  return { cx: p.x, cy: p.y, angle: Math.atan2(p.nx, -p.ny) };
}

const UNIT_SCALE: Scale2 = { x: 1, y: 1 };

/** Square hit-test: returns true if `(px, py)` is within `radius` of the
 *  handle's center on both axes. Mirrors `hitCornerHandle`. */
export function hitRotationHandle(
  handle: Pick<RotationHandle, 'cx' | 'cy'>,
  px: number,
  py: number,
  radius: number,
): boolean {
  return Math.abs(px - handle.cx) <= radius && Math.abs(py - handle.cy) <= radius;
}
