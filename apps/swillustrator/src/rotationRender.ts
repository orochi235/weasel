import type { DrawCommand } from '@orochi235/weasel/renderer';
import type { Pose } from './poseUpdate';

/** Build a column-major Float32Array (Mat3) encoding "rotate by `theta`
 *  radians about (cx, cy)". The renderer's Mat3 layout is:
 *    [m00, m10, 0,
 *     m01, m11, 0,
 *     tx,  ty,  1]
 *  Compose as T(cx,cy) · R(theta) · T(-cx,-cy). */
export function rotateAround(cx: number, cy: number, theta: number): Float32Array {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  // Standard 2D rotation about a pivot:
  //   x' = c*(x - cx) - s*(y - cy) + cx
  //   y' = s*(x - cx) + c*(y - cy) + cy
  // Identify with x' = m00*x + m01*y + tx; y' = m10*x + m11*y + ty.
  const m00 = c, m10 = s;
  const m01 = -s, m11 = c;
  const tx = cx - c * cx + s * cy;
  const ty = cy - s * cx - c * cy;
  return new Float32Array([m00, m10, 0, m01, m11, 0, tx, ty, 1]);
}

/** Wrap a list of draw commands in a rotation transform group when
 *  `pose.rotation` is non-zero. Identity (or undefined) returns the
 *  input array unchanged so the caller can stay zero-cost in the common
 *  axis-aligned case. */
export function wrapWithRotation(inner: DrawCommand[], pose: Pose): DrawCommand[] {
  if (!pose.rotation) return inner;
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;
  return [{ kind: 'group', transform: rotateAround(cx, cy, pose.rotation), children: inner }];
}
