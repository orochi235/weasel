import { isRectPose } from 'core/geometry/autoPoseDescriptor';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { fromPlane, toPlane, type PlaneMap } from 'core/viewport/parallax';
import type {
  ModifierState,
  PointSnapBehavior,
  PointSnapContext,
  PointSnapResult,
  ResizeAnchor,
} from '../../gestures/types';
import { rotatePoint } from '../rotate/geometry';
import type { PoseDescriptor } from './geometry';
import { boundsForRules } from './ruleBounds';

function buildPointSnapContext<TPose extends Bounds>(
  pose: TPose,
  rotation: number,
  anchor: ResizeAnchor,
  modifiers: ModifierState,
): PointSnapContext<TPose> {
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;

  const tl = rotatePoint(pose.x, pose.y, cx, cy, rotation);
  const tr = rotatePoint(pose.x + pose.width, pose.y, cx, cy, rotation);
  const br = rotatePoint(pose.x + pose.width, pose.y + pose.height, cx, cy, rotation);
  const bl = rotatePoint(pose.x, pose.y + pose.height, cx, cy, rotation);

  let draggedCorner: { worldX: number; worldY: number } | null = null;
  let fixedCorner: { worldX: number; worldY: number } | null = null;

  if (anchor.x !== 'free' && anchor.y !== 'free') {
    const fixedPt =
      anchor.x === 'min' && anchor.y === 'min' ? tl :
      anchor.x === 'max' && anchor.y === 'min' ? tr :
      anchor.x === 'max' && anchor.y === 'max' ? br : bl;
    const draggedPt =
      anchor.x === 'min' && anchor.y === 'min' ? br :
      anchor.x === 'max' && anchor.y === 'min' ? bl :
      anchor.x === 'max' && anchor.y === 'max' ? tl : tr;
    fixedCorner = { worldX: fixedPt.x, worldY: fixedPt.y };
    draggedCorner = { worldX: draggedPt.x, worldY: draggedPt.y };
  }

  return {
    draggedCorner,
    fixedCorner,
    center: { worldX: cx, worldY: cy },
    origin: { worldX: tl.x, worldY: tl.y },
    rotation,
    anchor,
    proposed: pose,
    modifiers,
  };
}

function applyPointSnap<TPose extends Bounds>(
  pose: TPose,
  rotation: number,
  result: PointSnapResult,
  ctx: PointSnapContext<TPose>,
): TPose {
  if (result.frame === 'center') {
    const dx = result.worldX - ctx.center.worldX;
    const dy = result.worldY - ctx.center.worldY;
    return { ...pose, x: pose.x + dx, y: pose.y + dy };
  }
  if (result.frame === 'origin') {
    const dx = result.worldX - ctx.origin.worldX;
    const dy = result.worldY - ctx.origin.worldY;
    return { ...pose, x: pose.x + dx, y: pose.y + dy };
  }
  const pin = result.frame === 'dragged-corner' ? ctx.fixedCorner : ctx.draggedCorner;
  if (!pin) return pose;
  const Dx = result.worldX - pin.worldX;
  const Dy = result.worldY - pin.worldY;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const localW = Dx * cos + Dy * sin;
  const localH = -Dx * sin + Dy * cos;
  const newWidth = Math.abs(localW);
  const newHeight = Math.abs(localH);
  const newCx = (pin.worldX + result.worldX) / 2;
  const newCy = (pin.worldY + result.worldY) / 2;
  return { ...pose, x: newCx - newWidth / 2, y: newCy - newHeight / 2, width: newWidth, height: newHeight };
}

/** `ctx`'s points in the camera's world, for a snap rule written against it. */
function pointSnapToCamera<TPose extends Bounds>(
  ctx: PointSnapContext<TPose>,
  m: PlaneMap,
): PointSnapContext<TPose> {
  const cam = (p: { worldX: number; worldY: number }) => {
    const w = fromPlane(m, { x: p.worldX, y: p.worldY });
    return { worldX: w.x, worldY: w.y };
  };
  return {
    ...ctx,
    draggedCorner: ctx.draggedCorner && cam(ctx.draggedCorner),
    fixedCorner: ctx.fixedCorner && cam(ctx.fixedCorner),
    center: cam(ctx.center),
    origin: cam(ctx.origin),
  };
}

/** A snap rule's answer, back in the plane the resize works in. */
function pointSnapFromPlane(
  r: PointSnapResult | null | undefined,
  m: PlaneMap,
): PointSnapResult | null | undefined {
  if (!r) return r;
  const p = toPlane(m, { x: r.worldX, y: r.worldY });
  return { ...r, worldX: p.x, worldY: p.y };
}

/** `pose` moved so the frame the first answering rule chose lands on its
 *  target; `pose` itself when no rule answers. `plane` is the plane the
 *  resize works in, null in the camera's own world. */
export function snapPose(
  rules: readonly PointSnapBehavior<Bounds>[],
  g: PoseDescriptor<unknown>,
  pose: unknown,
  rotation: number,
  anchor: ResizeAnchor,
  modifiers: ModifierState,
  plane: PlaneMap | null,
): unknown {
  if (rules.length === 0) return pose;
  const poseAsRect = boundsForRules(g, pose);
  const psCtx = buildPointSnapContext(poseAsRect, rotation, anchor, modifiers);
  // Point snaps are the surface's rules over the camera's world, so
  // on a plane their points cross at this boundary.
  for (const rule of rules) {
    const result = plane
      ? pointSnapFromPlane(rule.onMove(pointSnapToCamera(psCtx, plane)), plane)
      : rule.onMove(psCtx);
    if (!result) continue;
    const snapped = applyPointSnap(poseAsRect, rotation, result, psCtx);
    return isRectPose(pose) ? snapped : g.remapBounds(pose, poseAsRect, snapped);
  }
  return pose;
}
