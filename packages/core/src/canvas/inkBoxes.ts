import { drawnBoundsOf, inkExtentsOf, type DrawnBoundsOptions, type DrawnBoundsScene } from 'canvas/drawnBounds';
import { drawnBoundsScene } from 'canvas/derivedPath';
import { axisAlignedBounds } from 'core/geometry/unionBounds';
import { documentOf } from 'core/scene/documentOf';
import type { NodeId } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { DrawnBoxesSource } from 'interactions/actions/drawnBoxes';
import { poseDescriptorOf } from 'interactions/actions/poseDescriptorDep';
import { scenePoseFrame } from 'interactions/actions/poseFrame';

const NO_SCENE: DrawnBoundsScene = { get: () => undefined };

/** The `drawnBoxes` dep `<SceneCanvas>` sources: `drawnBoundsOf` over the
 *  deps' scene, each shape's ink included unless the canvas opted out. */
export const inkBoxes: DrawnBoxesSource = (deps, frame) => {
  // A command measures what the document holds, not what an open gesture or edit is showing.
  const doc = deps.scene ? documentOf(deps.scene) : undefined;
  const scene: DrawnBoundsScene = doc ? drawnBoundsScene(doc) : NO_SCENE;
  const descriptor = poseDescriptorOf(deps.poseDescriptor);
  const view = deps.view?.get();
  let worlds = frame;
  const opts: DrawnBoundsOptions = {
    descriptor,
    worldPoseOf: (id) => (worlds ??= scenePoseFrame(doc!)).world(id),
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
};
