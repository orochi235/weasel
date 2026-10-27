import { definesFrame, documentPose } from 'core/scene/effectivePose';
import type { NodeId, Scene } from 'core/scene/types';
import type { PoseAdapter } from './composePose';
import { viewPoseAdapter } from './scrollOffsets';

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

/** `scenePoseAdapter` read as the view shows it: each scrolled container's
 *  children moved by its offset. For a gesture, which reads the world it
 *  writes back through the same fold, so what it stores is the content
 *  position; the layout pass and other document writers use
 *  `scenePoseAdapter`. */
export function sceneViewPoseAdapter(
  scene: Scene<unknown, string, unknown>,
): PoseAdapter<unknown> {
  return viewPoseAdapter(scene, scenePoseAdapter(scene));
}
