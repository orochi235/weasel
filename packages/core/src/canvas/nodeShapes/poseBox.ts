import type { Stroke } from '@weasel-js/paint';
import type { NodeInkCtx } from 'canvas/NodeShape';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { isRectPose } from 'core/geometry/autoPoseDescriptor';
import { strokeReachAt } from '../../renderer/cullDrawCommands';

/** Whether a built-in painter can read this pose. A node that declares none
 *  passes: the pose is then the caller's argument, not the node's. */
export function paintsPose(pose: unknown): boolean {
  return pose === undefined || isRectPose(pose);
}

/** The pose rect grown by how far `stroke` can paint outside it — the paint
 *  box of every built-in painter whose geometry the pose box contains. */
export function poseBoxBounds(pose: unknown, stroke: Stroke | null, ctx: NodeInkCtx | undefined): Bounds | null {
  if (!isRectPose(pose)) return null;
  const reach = stroke ? strokeReachAt(stroke, ctx?.scale ?? 1, ctx?.leastScale) : 0;
  const x = Math.min(pose.x, pose.x + pose.width);
  const y = Math.min(pose.y, pose.y + pose.height);
  return {
    x: x - reach,
    y: y - reach,
    width: Math.abs(pose.width) + 2 * reach,
    height: Math.abs(pose.height) + 2 * reach,
  };
}
