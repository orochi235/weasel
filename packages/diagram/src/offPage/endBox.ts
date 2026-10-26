import { AUTO_POSE_DESCRIPTOR, composeWorldPose, scenePoseAdapter, type Bounds, type PoseDescriptor, type Scene } from '@weasel-js/core';

/** The box `node` has in document space, which is where pages are: its pose through every ancestor's transform. */
export function documentBoundsOf<TPose>(
  scene: Scene<unknown, string, TPose>,
  node: { id: string },
  geometry: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR as PoseDescriptor<unknown>,
): Bounds {
  return geometry.getBounds(composeWorldPose(scenePoseAdapter(scene as never), node.id, scene.composition.compose as never));
}
