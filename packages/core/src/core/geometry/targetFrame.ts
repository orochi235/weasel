/**
 * The frame selection chrome reads a target in: `poseFrameOf` over the
 * target's bounds, with the helpers the outline, the handles, their hit
 * regions, and the resize and rotate actions all place themselves by.
 */
import { applyToPoint, invert, poseFrameOf, pxExtentInFrame, type Affine, type Scale2 } from '@weasel-js/geom';

/** Local↔world maps for a chrome target. Local is the target's unrotated box
 *  frame; world is where the node is drawn. */
export interface TargetTransform {
  /** No rotation and no `transform`: local is world. */
  identity: boolean;
  /** Target box frame → world. */
  toWorld: Affine;
  /** World → target box frame. `null` when the target's `transform` is
   *  singular: it draws nothing, and no world point maps back. */
  toLocal: Affine | null;
}

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

export const IDENTITY_TARGET: TargetTransform = { identity: true, toWorld: IDENTITY, toLocal: IDENTITY };

/** The frame `bounds` is drawn in: its `rotation`, its `transform`, or both. */
export function targetTransformOf(bounds: unknown): TargetTransform {
  const toWorld = poseFrameOf(bounds);
  if (!toWorld) return IDENTITY_TARGET;
  return { identity: false, toWorld, toLocal: invert(toWorld) };
}

/** How far the target's x axis is turned from world's, radians. */
export function angleOf(xf: TargetTransform): number {
  return xf.identity ? 0 : Math.atan2(xf.toWorld[1], xf.toWorld[0]);
}

/** Whether the frame only turns the target: no skew, no stretch, no flip. */
export function isRigid(xf: TargetTransform): boolean {
  if (xf.identity) return true;
  const [a, b, c, d] = xf.toWorld;
  return Math.abs(a - d) < 1e-9 && Math.abs(b + c) < 1e-9 && Math.abs(a * a + b * b - 1) < 1e-9;
}

/** local point → world point. */
export function localToWorld(xf: TargetTransform, lx: number, ly: number): { x: number; y: number } {
  if (xf.identity) return { x: lx, y: ly };
  const [x, y] = applyToPoint(xf.toWorld, lx, ly);
  return { x, y };
}

/** world point → local point; `null` where nothing maps back. */
export function worldToLocal(xf: TargetTransform, wx: number, wy: number): { x: number; y: number } | null {
  if (xf.identity) return { x: wx, y: wy };
  if (!xf.toLocal) return null;
  const [x, y] = applyToPoint(xf.toLocal, wx, wy);
  return { x, y };
}

/** A world delta in the target's own axes; `null` where nothing maps back. */
export function worldDeltaToLocal(xf: TargetTransform, dx: number, dy: number): { x: number; y: number } | null {
  if (xf.identity) return { x: dx, y: dy };
  const m = xf.toLocal;
  return m && { x: m[0] * dx + m[2] * dy, y: m[1] * dx + m[3] * dy };
}

/** A local edge's outward normal as a world direction, unnormalized. A normal
 *  goes through the inverse transpose, so it stays square to a skewed edge. */
export function normalToWorld(xf: TargetTransform, n: { x: number; y: number }): { x: number; y: number } {
  if (xf.identity) return n;
  const [a, b, c, d] = xf.toWorld;
  const k = Math.sign(a * d - b * c) || 1;
  return { x: (d * n.x - b * n.y) * k, y: (a * n.y - c * n.x) * k };
}

/** `pxExtent` along the target's own axes: how far along each an edge across
 *  it must move to move `px` on screen. */
export function pxExtentIn(px: number, scale: Scale2, xf: TargetTransform): { x: number; y: number } {
  return pxExtentInFrame(px, scale, xf.toWorld);
}

/** The target's box corners in world, TL/TR/BR/BL. */
export function targetCorners(
  b: { x: number; y: number; width: number; height: number },
  xf: TargetTransform,
): { x: number; y: number }[] {
  return [
    localToWorld(xf, b.x, b.y),
    localToWorld(xf, b.x + b.width, b.y),
    localToWorld(xf, b.x + b.width, b.y + b.height),
    localToWorld(xf, b.x, b.y + b.height),
  ];
}
