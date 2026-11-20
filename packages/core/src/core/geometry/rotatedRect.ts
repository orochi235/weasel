import type { RotatedPose } from 'core/geometry/poseDescriptor';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { poseLinearOf } from '@weasel-js/geom';
import { targetCorners, targetTransformOf, worldToLocal } from './targetFrame';

/** AABB center of an unrotated rect — the canonical rotation pivot. */
export function aabbCenter(bounds: Bounds): { x: number; y: number } {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

/** Rotate `(px, py)` by `angle` (radians) around `(cx, cy)`. */
export function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angle: number,
): { x: number; y: number } {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}

/** Four corners of an unrotated rect, in TL/TR/BR/BL order. */
export function rectCorners(bounds: Bounds): { x: number; y: number }[] {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
}

/** Four corners of a rotated rect as it is drawn: turned about its AABB
 *  center, through its `transform` when it has one, in TL/TR/BR/BL order.
 *  Useful for selection-overlay rendering. */
export function rotatedRectCorners(pose: RotatedPose): { x: number; y: number }[] {
  if (poseLinearOf(pose)) return targetCorners(pose, targetTransformOf(pose));
  const c = aabbCenter(pose);
  return rectCorners(pose).map((p) => rotatePoint(p.x, p.y, c.x, c.y, pose.rotation));
}

/** Hit-test a world point against a rotated rect as it is drawn (rotation
 *  around AABB center, then its `transform`): undo the frame and test the
 *  point against the box, which may be flipped, in the rect's local frame. */
export function rotatedRectContainsPoint(
  pose: RotatedPose,
  worldX: number,
  worldY: number,
): boolean {
  let local: { x: number; y: number } | null;
  if (poseLinearOf(pose)) {
    local = worldToLocal(targetTransformOf(pose), worldX, worldY);
  } else {
    const c = aabbCenter(pose);
    local = rotatePoint(worldX, worldY, c.x, c.y, -pose.rotation);
  }
  if (!local) return false;
  const x0 = Math.min(pose.x, pose.x + pose.width), x1 = Math.max(pose.x, pose.x + pose.width);
  const y0 = Math.min(pose.y, pose.y + pose.height), y1 = Math.max(pose.y, pose.y + pose.height);
  return local.x >= x0 && local.x <= x1 && local.y >= y0 && local.y <= y1;
}
