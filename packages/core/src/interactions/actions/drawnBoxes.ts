import type { ActionDeps } from '@weasel-js/routing';
import { drawnBoundsOf, inkExtentsOf, type DrawnBoundsOptions, type DrawnBoundsScene } from 'canvas/drawnBounds';
import { drawnBoundsScene } from 'canvas/derivedPath';
import type { InkExtents } from 'core/geometry/inkExtents';
import { axisAlignedBounds } from 'core/geometry/unionBounds';
import type { NodeId } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { poseDescriptorOf } from './poseDescriptorDep';
import { scenePoseFrame, type PoseFrame } from './poseFrame';

const NO_SCENE: DrawnBoundsScene = { get: () => undefined };

/** `drawnBoundsOf` bound to an action's deps: the box each id is shown with
 *  at a world pose, stroke included unless the canvas opted out. */
export interface DrawnBoxes {
  /** In the frame the pose is drawn in. */
  framed(id: NodeId | string, pose: unknown): Bounds;
  /** The axis-aligned box a turned node covers. */
  aabb(id: NodeId | string, pose: unknown): Bounds;
  /** How far the ink reaches past the pose box, in the box's own frame. */
  extents(id: NodeId | string, pose: unknown): InkExtents;
}

/** The {@link DrawnBoxes} over `deps.scene`. Pass the action's own `frame`
 *  when it has one, so container members are read the way it reads them. */
export function drawnBoxes(
  deps: Pick<ActionDeps, 'scene' | 'poseDescriptor' | 'view' | 'boundsIncludeStroke'>,
  frame?: PoseFrame<unknown>,
): DrawnBoxes {
  const scene: DrawnBoundsScene = deps.scene ? drawnBoundsScene(deps.scene) : NO_SCENE;
  const descriptor = poseDescriptorOf(deps.poseDescriptor);
  const view = deps.view?.get();
  let worlds = frame;
  const opts: DrawnBoundsOptions = {
    descriptor,
    worldPoseOf: (id) => (worlds ??= scenePoseFrame(deps.scene!)).world(id),
    includeStroke: deps.boundsIncludeStroke ?? true,
    ...(view ? { scale: view.scale } : {}),
  };
  const framed = (id: NodeId | string, pose: unknown): Bounds =>
    drawnBoundsOf(scene, id as NodeId, pose, opts);
  return {
    framed,
    aabb: (id, pose) => axisAlignedBounds(framed(id, pose)),
    extents: (id, pose) => inkExtentsOf(scene, id as NodeId, pose, opts),
  };
}
