import { AUTO_POSE_DESCRIPTOR, documentPose, type Bounds, type PoseDescriptor, type Scene } from '@weasel-js/core';

/** The box `node` has in document space, which is where pages are: its pose through every ancestor's transform. */
export function documentBoundsOf<TPose>(
  scene: Scene<unknown, string, TPose>,
  node: { id: string },
  geometry: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR as PoseDescriptor<unknown>,
): Bounds {
  return geometry.getBounds(documentPose(scene as never, node as never));
}
