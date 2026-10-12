import type { NodeId, Scene } from 'core/scene/types';
import type { GestureFrames } from '../gestures/types';
import { planeOf } from './planeInput';
import { scenePoseFrame, type PoseFrame } from './poseFrame';

/** A scene-backed gesture's {@link GestureFrames}. `view` is the `view` dep. */
export function sceneGestureFrames(
  scene: Scene<unknown, string, unknown>,
  view: unknown,
  frame: PoseFrame<unknown> = scenePoseFrame(scene),
): GestureFrames<unknown> {
  return {
    world: (id) => frame.world(id as NodeId),
    toWorld: (id, pose) => {
      const parent = frame.parentWorld(id as NodeId);
      return parent === null ? pose : frame.pc.compose(parent, pose);
    },
    toLocal: (id, worldPose) => frame.local(id as NodeId, worldPose),
    planeOf: (layer) => planeOf(view, layer),
  };
}
