import type { Node, NodeId, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import { createDeleteOp } from 'core/ops/delete';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import type { Action } from '../registry';

/** Host-array index of `id`: its slot among the scene roots (parent `null`)
 *  or among its parent's children. `-1` when not found. Forwarded to
 *  `createDeleteOp` so the inverse re-insert restores paint order on undo. */
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
 * already mutated. Selecting a container and its members, or a node and an edge
 * drawn from it, is the ordinary way to hit this; Cmd+A does both.
 *
 * `scene.removalClosure` is what decides that, rather than a walk back up from
 * each candidate: the scene owns the cascade relations, so a third one added
 * there is honored here for free. Asking about the ops already emitted, rather
 * than about the whole selection, is what settles a cycle — two ids that reach
 * each other each cover the other, and filtering both deletes nothing, while
 * growing the covered set in input order keeps the first and drops the rest.
 *
 * Which ids survive the filter depends on their order, so the ops are a cover
 * of the selection rather than its minimal set of roots.
 *
 * Shared with `clipboardCutAction` — cut is copy plus exactly this.
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

/**
 * @experimental
 * Static descriptor for the `delete` Action. Removes every selected
 * node from the scene as a single batched op (one undo entry).
 *
 * Undo restores everything the removal cascaded — a container's children and
 * a deleted node's dependents come back with it, at their own slots. Each op
 * snapshots that set through the adapter's `getRemovalClosure` before removing.
 */
export const deleteAction: Action & { requires: string[] } = {
  id: 'delete',
  label: 'Delete',
  // Suppressed while any tool is mid-gesture — accidentally hitting
  // Delete during a drag shouldn't wipe the selection out from under
  // the in-flight handle.
  defaultBinding: {
    kind: 'key',
    key: ['Delete', 'Backspace'],
    phase: [{ channel: '*', phase: 'initial' }],
  },
  eligible: { capability: 'edits-page' },
  requires: ['scene', 'selection', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const selection = deps.selection as SelectionApi | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      // Optional consumer commit hook. When present, ops route through it
      // (consumer history) as one undo entry; otherwise they fall back to the
      // scene's own history via `scene.applyBatch`.
      const applyOps = deps.applyOps as ((ops: Op[], label: string) => void) | undefined;
      if (!selection || !scene) return;
      const ids = selection.get();
      if (ids.length === 0) return;

      const ops = buildDeleteOps(scene, ids, 'Delete');

      if (ops.length > 0) {
        if (applyOps) applyOps(ops, 'Delete');
        else scene.applyBatch(ops, 'Delete', defaultCommitAdapter(scene));
      }
      selection.set([]);
    },
  },
  enabled: () => true,
};
