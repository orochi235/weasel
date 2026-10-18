import type { NodeId, Scene } from 'core/scene/types';
import type { DrawnBoxes } from 'interactions/actions/drawnBoxes';
import { scenePoseFrame } from 'interactions/actions/poseFrame';
import { AUTO_ORIGIN_PROJECTION } from 'interactions/gestures/shared/originProjection';
import type { ProbeReads } from './probes2d';

type Point = { x: number; y: number };

/** {@link ProbeReads} over a canvas's scene, read when a session begins.
 *  `boxes` is the canvas's `drawnBoxes`, which alignment measures with too. */
export function sceneProbeReads(args: {
  scene: Scene<unknown, string, unknown>;
  boxes: DrawnBoxes;
  geometryAt?: (press: Point, ids: readonly string[]) => Point | null;
}): ProbeReads {
  const { scene } = args;
  const frame = scenePoseFrame(scene);
  return {
    pose: (id) => (scene.get(id as NodeId) === undefined ? undefined : frame.world(id as NodeId)),
    drawnBox: (id, pose) => args.boxes.aabb(id, pose),
    origin: (pose) => AUTO_ORIGIN_PROJECTION.getOrigin(pose),
    ...(args.geometryAt ? { geometryAt: args.geometryAt } : {}),
  };
}
