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
import type { ActionDeps } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { createSetSelectionOp } from 'core/ops/select';
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

/** `selection`'s reads and writes as {@link defaultCommitAdapter} takes them: a
 *  batch's selection op lands on the selection the action read. */
export function selectionMethods(selection: Pick<SelectionApi, 'get' | 'set'> | undefined): SelectionApi['adapterMethods'] | undefined {
  return selection && {
    getSelection: () => [...selection.get()],
    setSelection: (ids) => selection.set(ids),
  };
}

/** Commit `ops` as one undo entry, through the consumer's `applyOps` when
 *  there is one, else straight to the `scene` dep. With `select`, the entry
 *  also replaces the selection with it, so undo restores the selection the
 *  action started from; with nothing to commit, the selection is still set. */
export function commitOps(deps: ActionDeps, ops: Op[], label: string, opts: { select?: readonly string[] } = {}): void {
  const { select } = opts;
  if (select !== undefined && deps.selection) {
    if (ops.length === 0) {
      deps.selection.set(select.map(asNodeId));
      return;
    }
    ops = [...ops, createSetSelectionOp({ from: deps.selection.get(), to: select.map(asNodeId), label })];
  }
  if (ops.length === 0) return;
  if (deps.applyOps) {
    deps.applyOps(ops, label);
    return;
  }
  const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
  if (!scene) return;
  scene.applyBatch(ops, label, defaultCommitAdapter(scene, selectionMethods(deps.selection)));
}

/** The selection change a commit that makes or edits one node puts in its own
 *  undo entry (an `insert` dep's `commit`, an `editAnchors` dep's
 *  `applyEdit`), so undoing it restores the selection from before it. */
export interface CommitSelection {
  /** What was selected before the change began. Undo restores it. */
  from: readonly NodeId[];
  /** Leave the node made or edited selected. Otherwise nothing is left selected. */
  selectNode: boolean;
}

/** The ops a commit of node `id` appends to its batch for `select`: none
 *  without one, else the selection change from `select.from`. */
export function commitSelectionOps(select: CommitSelection | undefined, id: string, label?: string): Op[] {
  if (!select) return [];
  return [createSetSelectionOp({ from: select.from, to: select.selectNode ? [asNodeId(id)] : [], ...(label !== undefined ? { label } : {}) })];
}

/** The {@link CommitSelection} that leaves the committed node selected, from
 *  `selection` as it stands; none without a selection. */
export function selectCommitted(selection: Pick<SelectionApi, 'get'> | undefined): CommitSelection | undefined {
  return selection ? { from: [...selection.get()], selectNode: true } : undefined;
}
