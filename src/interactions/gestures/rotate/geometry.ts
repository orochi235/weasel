import type { ResizePose, RotatedPose } from '../types';

/** AABB center of an unrotated rect — the canonical rotation pivot. */
export function aabbCenter(bounds: ResizePose): { x: number; y: number } {
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
export function rectCorners(bounds: ResizePose): { x: number; y: number }[] {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
}

/** Four corners of a rotated rect (rotation around AABB center), in
 *  TL/TR/BR/BL order. Useful for selection-overlay rendering. */
export function rotatedRectCorners(pose: RotatedPose): { x: number; y: number }[] {
  const c = aabbCenter(pose);
  return rectCorners(pose).map((p) => rotatePoint(p.x, p.y, c.x, c.y, pose.rotation));
}

/** Hit-test a world point against a rotated rect (rotation around AABB
 *  center). Standard pattern: invert the rotation and AABB-test in the
 *  rect's local frame. */
export function pointInRotatedRect(
  pose: RotatedPose,
  worldX: number,
  worldY: number,
): boolean {
  const c = aabbCenter(pose);
  const local = rotatePoint(worldX, worldY, c.x, c.y, -pose.rotation);
  return (
    local.x >= pose.x &&
    local.x <= pose.x + pose.width &&
    local.y >= pose.y &&
    local.y <= pose.y + pose.height
  );
}
