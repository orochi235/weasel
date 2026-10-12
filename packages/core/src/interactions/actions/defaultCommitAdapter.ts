/**
 * Shared scene-backed commit adapter for default actions.
 *
 * Default actions route data/layer/pose/parent mutations through the
 * consumer's `applyOps` commit hook when one is present; when it isn't, they
 * fall back to applying the committed ops directly against the scene through
 * this adapter: the scene's mutators (`core/scene/sceneMutators.ts`), the
 * document's poses and nodes, and the selection. Known exclusions from the op
 * factory roster — surfaces the scene doesn't own: `setPath` and `setText`.
 */
import { documentReads, sceneMutators } from 'core/scene/sceneMutators';
import type { Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';

/** Build the adapter the default actions commit through when the consumer
 *  supplies no `applyOps` hook of its own — it applies ops straight to the
 *  scene. Path and text ops are not covered; those surfaces belong to their
 *  own owners.
 *
 *  Pass `selection` (a `SelectionApi`'s `adapterMethods`) and selection reads
 *  and writes go through it rather than the scene, so a canvas that gates its
 *  selection — `selectable={false}` — gates what these batches select too. */
export function defaultCommitAdapter<TPose>(
  scene: Scene<unknown, string, TPose>,
  selection?: SelectionApi['adapterMethods'],
) {
  return {
    ...sceneMutators(scene),
    ...documentReads(scene),
    getSelection: (): string[] => [...(selection ? selection.getSelection() : scene.getSelection())],
    setSelection: (ids: string[]) => {
      if (selection) selection.setSelection(ids.map(asNodeId));
      else scene.setSelection(ids.map(asNodeId));
    },
  };
}
