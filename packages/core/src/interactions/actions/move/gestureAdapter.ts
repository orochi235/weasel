/**
 * The scene-backed adapter the move behavior pipeline reads and commits
 * through: the default actions' commit adapter, plus what a behavior needs
 * while the gesture runs and after it ends (`previewPoses`, `poseTarget`, and
 * an `applyOps` of its own).
 */
import type { Op } from 'core/ops/types';
import type { Node, PoseOverride, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { MoveAdapter } from 'core/adapters/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { scenePoseTarget } from '../../../animation/poseTarget';
import { defaultCommitAdapter } from '../defaultCommitAdapter';

export type MoveGestureAdapter<TPose> = MoveAdapter<Node<unknown, string, TPose>, TPose>
  & ReturnType<typeof defaultCommitAdapter<TPose>>
  & { previewPoses(poses: ReadonlyMap<string, TPose | null>): void };

/** `commit` is how a behavior's own `applyOps` batch lands; the returned
 *  adapter is passed back so the ops apply through it. Left out, the adapter
 *  has no `applyOps`. `selection` is as `defaultCommitAdapter` takes it. */
export function moveGestureAdapter<TPose>(
  scene: Scene<unknown, string, TPose>,
  commit?: (ops: Op[], label: string, adapter: MoveGestureAdapter<TPose>) => void,
  selection?: SelectionApi['adapterMethods'],
): MoveGestureAdapter<TPose> {
  const previews = new Map<string, PoseOverride<TPose>>();
  const adapter: MoveGestureAdapter<TPose> = {
    ...defaultCommitAdapter(scene, selection),
    ...(commit ? { applyOps: (ops: Op[], label: string) => commit(ops, label, adapter) } : {}),
    previewPoses: (poses) => {
      const { overrides } = scene;
      for (const [id, pose] of poses) {
        const nodeId = asNodeId(id);
        const mine = previews.get(id);
        if (pose === null) {
          previews.delete(id);
          if (mine !== undefined) overrides.clear(nodeId, mine);
          continue;
        }
        const entry = mine ?? { pose };
        entry.pose = pose;
        previews.set(id, entry);
        // Back where it stood if the table dropped it: the node went and came back.
        if (!overrides.has(nodeId, entry)) overrides.set(nodeId, entry);
      }
      overrides.commit();
    },
    poseTarget: (id, descriptor) => scenePoseTarget(scene, id, descriptor),
  };
  return adapter;
}
