import { translatePoseViaDescriptor, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { PoseComposition } from 'core/scene/composePose';
import { strategyView, type StrategyView } from 'core/scene/strategyView';
import type { ContainerBounds, LayoutDragged } from '../../../../layout/types';

/** `pose`'s box as `g` measures it, and nothing else of it. */
export function boxOf(g: PoseDescriptor<unknown>, pose: unknown): ContainerBounds {
  const b = g.getBounds(pose);
  return { x: b.x, y: b.y, width: b.width, height: b.height };
}

/** A container at world `pose` as its strategy's drag hooks see it: upright,
 *  the way the layout pass shows it to `childPoses`, `arrive` and `depart`. */
export function containerView(
  pc: PoseComposition<unknown>, g: PoseDescriptor<unknown>, pose: unknown,
): StrategyView<unknown> {
  return strategyView(
    pose,
    pc,
    (p) => boxOf(g, p),
    (p, from, to) => translatePoseViaDescriptor(p, to.x - from.x, to.y - from.y, g),
  )!;
}

/** A dragged child's poses in `view`'s space. */
export function draggedInView(view: StrategyView<unknown>, arg: LayoutDragged<unknown>): LayoutDragged<unknown> {
  if (!view.turned) return arg;
  return { ...arg, originPose: view.toStrategy(arg.originPose), pose: view.toStrategy(arg.pose) };
}

/** World `point` in `view`'s space, carried there as the center of `pose`
 *  (measured by `g`) moved onto it. */
export function pointInView(
  view: StrategyView<unknown>, g: PoseDescriptor<unknown>, pose: unknown, point: { x: number; y: number },
): { x: number; y: number } {
  if (!view.turned) return point;
  const b = g.getBounds(pose);
  const moved = translatePoseViaDescriptor(pose, point.x - (b.x + b.width / 2), point.y - (b.y + b.height / 2), g);
  const s = g.getBounds(view.toStrategy(moved));
  return { x: s.x + s.width / 2, y: s.y + s.height / 2 };
}

/** A transform op a strategy answered in `view`'s space, in world. */
export function opInWorld(view: StrategyView<unknown>, op: Op): Op {
  if (!view.turned || op.name !== 'transform') return op;
  const a = op.args as { id: string; from: unknown; to: unknown; label?: string; coalesceKey?: string };
  return createTransformOp<unknown>({ ...a, from: view.toWorld(a.from), to: view.toWorld(a.to) });
}
