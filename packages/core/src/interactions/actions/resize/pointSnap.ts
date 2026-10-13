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
import { targetCorners, worldDeltaToLocal, type TargetTransform } from 'core/geometry/targetFrame';
import { boxFrame } from './boxFrame';
import type { ResizeBox } from './session';
import type { PoseDescriptor } from './geometry';
import { boundsForRules } from './ruleBounds';

function buildPointSnapContext<TPose extends Bounds>(
  pose: TPose,
  frame: TargetTransform,
  rotation: number,
  anchor: ResizeAnchor,
  modifiers: ModifierState,
): PointSnapContext<TPose> {
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;
  const [tl, tr, br, bl] = targetCorners(pose, frame);

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
  frame: TargetTransform,
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
  // The diagonal from the pinned corner, in the box's own axes.
  const diagonal = worldDeltaToLocal(frame, result.worldX - pin.worldX, result.worldY - pin.worldY);
  if (!diagonal) return pose;
  const newWidth = Math.abs(diagonal.x);
  const newHeight = Math.abs(diagonal.y);
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
  box: Pick<ResizeBox, 'rotation' | 'transform'>,
  anchor: ResizeAnchor,
  modifiers: ModifierState,
  plane: PlaneMap | null,
): unknown {
  if (rules.length === 0) return pose;
  const poseAsRect = boundsForRules(g, pose);
  const frame = boxFrame(box, poseAsRect);
  const psCtx = buildPointSnapContext(poseAsRect, frame, box.rotation, anchor, modifiers);
  // Point snaps are the surface's rules over the camera's world, so
  // on a plane their points cross at this boundary.
  for (const rule of rules) {
    const result = plane
      ? pointSnapFromPlane(rule.onMove(pointSnapToCamera(psCtx, plane)), plane)
      : rule.onMove(psCtx);
    if (!result) continue;
    const snapped = applyPointSnap(poseAsRect, frame, result, psCtx);
    return isRectPose(pose) ? snapped : g.remapBounds(pose, poseAsRect, snapped);
  }
  return pose;
}
