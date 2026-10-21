import type { Node, NodeId, Scene } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { createDeleteOp } from 'core/ops/delete';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import type { Action, ActionDeps } from '@weasel-js/routing';
import { requiresSelection } from './requiresSelection';
import { icon } from '../../../icons.gen';

/** `id`'s slot among the scene roots or its parent's children, or `-1`. */
function hostIndex(scene: Scene<unknown, string, unknown>, id: NodeId): number {
  const node = scene.get(id);
  const siblings = node?.parent == null ? scene.roots : scene.childrenOf(node.parent);
  return siblings.indexOf(id);
}

/**
 * Delete ops for `ids`, in the order given. Each op captures the node and its
 * host-array index BEFORE any removal, so `invert()` re-inserts at the right
 * slot and undo restores paint order. Ids with no live node are skipped.
 *
 * Ids an already-emitted op will take are skipped: `removeNode` cascades both
 * the subtree and the dependents, so a second op for a node the first has taken
 * would throw `unknown node id` mid-batch — escaping the batch with the scene
 * already mutated. Selecting a container and its members does this.
 *
 * The covered set grows from the ops already emitted, not from the whole
 * selection, which is what settles a cycle: two ids that reach each other each
 * cover the other, and filtering both would delete nothing. So which ids
 * survive depends on their order, and the ops are a cover of the selection
 * rather than its minimal set of roots.
 */
export function buildDeleteOps(
  scene: Scene<unknown, string, unknown>,
  ids: readonly string[],
  label: string,
): Op[] {
  const covered = new Set<string>();
  const ops: Op[] = [];
  for (const id of ids) {
    const node = scene.get(id as NodeId);
    if (!node) continue;
    if (covered.has(id)) continue;
    for (const taken of scene.removalClosure([id as NodeId])) covered.add(taken);
    ops.push(createDeleteOp<Node<unknown, string, unknown>>({
      node,
      index: hostIndex(scene, id as NodeId),
      label,
    }));
  }
  return ops;
}

/** Options for {@link createDeleteAction}. */
export interface DeleteActionOptions {
  /** Runs in place of the default, {@link commitDeleteToScene}. */
  commit?: (ids: readonly NodeId[], deps: ActionDeps) => void;
}

/** The default commit: removes `ids` and their dependents as one undo entry,
 *  then empties the selection. */
export function commitDeleteToScene(ids: readonly NodeId[], deps: ActionDeps): void {
  const { selection, scene, applyOps } = deps;
  if (!selection || !scene) return;
  const ops = buildDeleteOps(scene, ids, 'Delete');
  if (ops.length > 0) {
    if (applyOps) applyOps(ops, 'Delete');
    else scene.applyBatch(ops, 'Delete', defaultCommitAdapter(scene, selection.adapterMethods));
  }
  selection.set([]);
}

/** Delete on Delete and Backspace: hands the selected ids to `commit`. */
export function createDeleteAction(opts: DeleteActionOptions = {}): Action & { requires: string[] } {
  const commit = opts.commit ?? commitDeleteToScene;
  return {
    id: 'delete',
    label: 'Delete',
    icon: icon('delete'),
    group: 'edit',
    // Suppressed while any tool is mid-gesture — accidentally hitting
    // Delete during a drag shouldn't wipe the selection out from under
    // the in-flight handle.
    defaultBinding: [{
      spec: {
        kind: 'key',
        key: ['Delete', 'Backspace'],
        phase: [{ channel: '*', phase: 'initial' }],
      },
      opts: { id: 'delete.key' },
    }],
    eligible: { capability: 'edits-page' },
    requires: ['scene', 'selection', 'applyOps'],
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        if (!deps.selection || !deps.scene) return;
        const ids = deps.selection.get() as readonly NodeId[];
        if (ids.length === 0) return;
        commit(ids, deps);
      },
    },
    enabled: requiresSelection,
  };
}

/**
 * Removes every selected node from the scene as one undo entry. Undo restores
 * everything the removal cascaded — a container's children and a deleted
 * node's dependents come back with it, at their own slots.
 */
export const deleteAction = createDeleteAction();
