import { aabbCenter, rotatePoint } from './geometry';

/** Default world-space distance from the rect's top edge to the rotation
 *  handle's center. Matches the demo's visual default; consumers can
 *  override per-call. */
export const DEFAULT_ROTATION_HANDLE_DISTANCE = 24;

export interface RotationHandle {
  /** Handle center in world coords. */
  cx: number;
  cy: number;
}

/** Rotation handle for a rotated rect: top-center of the (rotated) bounding
 *  box, offset outward along the local up-vector by `distance` world pixels.
 *  When `pose.rotation` is missing it's treated as 0. */
export function rotationHandle(
  pose: { x: number; y: number; width: number; height: number; rotation?: number },
  distance: number = DEFAULT_ROTATION_HANDLE_DISTANCE,
): RotationHandle {
  const rotation = pose.rotation ?? 0;
  const c = aabbCenter(pose);
  const topCenterUnrotated = { x: pose.x + pose.width / 2, y: pose.y - distance };
  const p = rotatePoint(topCenterUnrotated.x, topCenterUnrotated.y, c.x, c.y, rotation);
  return { cx: p.x, cy: p.y };
}

/** Square hit-test: returns true if `(px, py)` is within `radius` of the
 *  handle's center on both axes. Mirrors `hitCornerHandle`. */
export function hitRotationHandle(
  handle: RotationHandle,
  px: number,
  py: number,
  radius: number,
): boolean {
  return Math.abs(px - handle.cx) <= radius && Math.abs(py - handle.cy) <= radius;
}
