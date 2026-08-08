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

/** True when any ancestor of `id` is itself in `set`. */
function hasSelectedAncestor(
  scene: Scene<unknown, string, unknown>,
  id: NodeId,
  set: ReadonlySet<string>,
): boolean {
  let parent = scene.get(id)?.parent ?? null;
  while (parent != null) {
    if (set.has(parent)) return true;
    parent = scene.get(parent)?.parent ?? null;
  }
  return false;
}

/**
 * Delete ops for `ids`, in the order given. Each op captures the node and its
 * host-array index BEFORE any removal, so `invert()` re-inserts at the right
 * slot and undo restores paint order. Ids with no live node are skipped.
 *
 * Descendants of another id in the set are skipped too: `removeNode` cascades
 * the subtree, so a container's op already takes its children with it and a
 * second op for a child would throw `unknown node id` mid-batch. Selecting a
 * group and its members at once (Cmd+A does exactly that) is the ordinary way
 * to hit this.
 *
 * Shared with `clipboardCutAction` — cut is copy plus exactly this.
 */
export function buildDeleteOps(
  scene: Scene<unknown, string, unknown>,
  ids: readonly string[],
  label: string,
): Op[] {
  const set = new Set<string>(ids);
  const ops: Op[] = [];
  for (const id of ids) {
    const node = scene.get(id as NodeId);
    if (!node) continue;
    if (hasSelectedAncestor(scene, id as NodeId, set)) continue;
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
