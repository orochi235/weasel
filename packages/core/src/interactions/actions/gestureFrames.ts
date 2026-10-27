import type { ActionDeps } from '@weasel-js/routing';
import type { NodeId, Scene } from 'core/scene/types';
import { drawnBoxes, type DrawnBoxes } from './drawnBoxes';
import type { GestureFrames } from '../gestures/types';
import { planeOf } from './planeInput';
import { scenePoseFrame, type PoseFrame } from './poseFrame';

/** A scene-backed gesture's {@link GestureFrames}, read through the action's deps. */
export function sceneGestureFrames(
  scene: Scene<unknown, string, unknown>,
  deps: Pick<ActionDeps, 'view' | 'poseDescriptor' | 'boundsIncludeStroke'>,
  frame: PoseFrame<unknown> = scenePoseFrame(scene),
): GestureFrames<unknown> {
  const view = deps.view;
  let boxes: DrawnBoxes | undefined;
  return {
    drawnBounds: (id, worldPose) => (boxes ??= drawnBoxes({ ...deps, scene }, frame)).aabb(id, worldPose),
    world: (id) => frame.world(id as NodeId),
    toWorld: (id, pose) => {
      const parent = frame.parentWorld(id as NodeId);
      return parent === null ? pose : frame.pc.compose(parent, pose);
    },
    toLocal: (id, worldPose) => frame.local(id as NodeId, worldPose),
    toLocalUnder: (parentId, worldPose) => frame.localUnder(parentId as NodeId | null, worldPose),
    planeOf: (layer) => planeOf(view, layer),
  };
}
