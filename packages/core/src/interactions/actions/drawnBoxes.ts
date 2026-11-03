import type { ActionDeps } from '@weasel-js/routing';
import { NO_INK_EXTENTS, type InkExtents } from 'core/geometry/inkExtents';
import { framedBounds, poseDescriptorForNode } from 'core/geometry/poseDescriptor';
import { axisAlignedBounds } from 'core/geometry/unionBounds';
import type { NodeId } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { poseDescriptorOf } from './poseDescriptorDep';
import type { PoseFrame } from './poseFrame';

/** The box each id is shown with at a world pose, as the actions that align,
 *  rotate, resize and snap to it measure it. */
export interface DrawnBoxes {
  /** In the frame the pose is drawn in. */
  framed(id: NodeId | string, pose: unknown): Bounds;
  /** The axis-aligned box a turned node covers. */
  aabb(id: NodeId | string, pose: unknown): Bounds;
  /** How far the ink reaches past the pose box, in the box's own frame. */
  extents(id: NodeId | string, pose: unknown): InkExtents;
}

/** What a {@link DrawnBoxesSource} reads off an action's deps. */
export type DrawnBoxesDeps = Pick<ActionDeps, 'scene' | 'poseDescriptor' | 'view' | 'boundsIncludeStroke'>;

/** Builds the {@link DrawnBoxes} for an action's deps: the `drawnBoxes` dep.
 *  `frame` is the action's own, when it has one, so container members are
 *  read the way it reads them. */
export type DrawnBoxesSource = (deps: DrawnBoxesDeps, frame?: PoseFrame<unknown>) => DrawnBoxes;

/** Each node's pose box under its pose descriptor, with no ink past it: what
 *  {@link drawnBoxes} answers when no `drawnBoxes` dep is sourced. */
export const poseBoxes: DrawnBoxesSource = (deps) => {
  const descriptor = poseDescriptorOf(deps.poseDescriptor);
  const framed = (id: NodeId | string, pose: unknown): Bounds => {
    const node = deps.scene?.get(id as NodeId);
    return framedBounds(pose, node ? poseDescriptorForNode(descriptor, node) : descriptor);
  };
  return { framed, aabb: (id, pose) => axisAlignedBounds(framed(id, pose)), extents: () => NO_INK_EXTENTS };
};

/** The {@link DrawnBoxes} over `deps.scene`: the `drawnBoxes` dep's, which
 *  `<SceneCanvas>` sources with each shape's ink, or {@link poseBoxes}. */
export function drawnBoxes(
  deps: DrawnBoxesDeps & Pick<ActionDeps, 'drawnBoxes'>,
  frame?: PoseFrame<unknown>,
): DrawnBoxes {
  return (deps.drawnBoxes ?? poseBoxes)(deps, frame);
}
