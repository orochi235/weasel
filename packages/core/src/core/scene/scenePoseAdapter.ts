import { definesFrame, documentPose } from 'core/scene/effectivePose';
import type { NodeId, Scene } from 'core/scene/types';
import type { PoseAdapter } from './composePose';

/** Build a `PoseAdapter` over a `Scene` for `composePose` helpers.
 *  `getParent` returns the live parent at call time so mid-batch
 *  parent updates compose correctly. */
export function scenePoseAdapter(
  scene: Scene<unknown, string, unknown>,
): PoseAdapter<unknown> {
  return {
    getPose: (id) => documentPose(scene, scene.get(id as NodeId)!),
    getParent: (id) => scene.get(id as NodeId)?.parent ?? null,
    definesFrame: (id) => {
      const node = scene.get(id as NodeId);
      return node === undefined || definesFrame(node);
    },
  };
}
