import type { View } from '@weasel-js/geom';
import { drawnBoundsOf } from 'canvas/drawnBounds';
import { axisAlignedBounds } from 'core/geometry/unionBounds';
import type { NodeId, Scene } from 'core/scene/types';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { scenePoseFrame } from 'interactions/actions/poseFrame';
import { AUTO_ORIGIN_PROJECTION } from 'interactions/gestures/shared/originProjection';
import type { ProbeReads } from './probes2d';

type Point = { x: number; y: number };

/** {@link ProbeReads} over a canvas's scene, read when a session begins. */
export function sceneProbeReads(args: {
  scene: Scene<unknown, string, unknown>;
  descriptor: PoseDescriptor<unknown>;
  includeStroke: boolean;
  view: View | null;
  geometryAt?: (press: Point, ids: readonly string[]) => Point | null;
}): ProbeReads {
  const { scene } = args;
  const frame = scenePoseFrame(scene);
  const opts = {
    descriptor: args.descriptor,
    worldPoseOf: (id: NodeId) => frame.world(id),
    includeStroke: args.includeStroke,
    ...(args.view ? { scale: args.view.scale } : {}),
  };
  return {
    pose: (id) => (scene.get(id as NodeId) === undefined ? undefined : frame.world(id as NodeId)),
    drawnBox: (id, pose) => axisAlignedBounds(drawnBoundsOf(scene, id as NodeId, pose, opts)),
    origin: (pose) => AUTO_ORIGIN_PROJECTION.getOrigin(pose),
    ...(args.geometryAt ? { geometryAt: args.geometryAt } : {}),
  };
}
