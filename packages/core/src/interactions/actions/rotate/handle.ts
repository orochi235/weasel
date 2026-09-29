import { aabbCenter, rotatePoint } from './geometry';
import { ROTATION_HANDLE_BASE_PX } from 'core/device/targets';
import { standoff, type Scale2 } from 'core/viewport/pxExtent';

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

/** Rotation handle for a rotated rect: `distance` pixels off the top edge's
 *  midpoint, along that edge's outward normal as it lands on a screen whose
 *  per-axis zoom is `scale`. With no `scale`, a pixel is a world unit. When
 *  `pose.rotation` is missing it's treated as 0. */
export function rotationHandle(
  pose: { x: number; y: number; width: number; height: number; rotation?: number },
  distance: number = DEFAULT_ROTATION_HANDLE_DISTANCE,
  scale: Scale2 = UNIT_SCALE,
): RotationHandle {
  const rotation = pose.rotation ?? 0;
  const c = aabbCenter(pose);
  const top = rotatePoint(pose.x + pose.width / 2, pose.y, c.x, c.y, rotation);
  const p = standoff(top, { x: Math.sin(rotation), y: -Math.cos(rotation) }, distance, scale);
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
