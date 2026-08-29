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
 * True when an op already emitted for one of `emitted` will take `id` with it.
 *
 * `scene.remove` cascades down two relations — a node's subtree, and everything
 * declaring it in `dependsOn` — so this walks both of them back up from `id`
 * and asks whether either reaches an id already spoken for. They have to be
 * walked together, not one after the other: a child of an edge is reached only
 * by stepping to its parent and then along that parent's `dependsOn`.
 *
 * Asking about ops already emitted, rather than about the whole selection, is
 * what settles a cycle. Two ids that reach each other are each "covered by the
 * other" and filtering both deletes nothing; growing `emitted` in input order
 * keeps the first and drops the rest. The cycle need not be one of `dependsOn`
 * alone — a node deriving from its own descendant closes the loop through the
 * combined graph this walks.
 *
 * Upward rather than downward (which is how `Scene` computes the same closure
 * internally) because no public surface exposes the reverse `dependsOn` index;
 * walking down would mean rebuilding it from every node in the scene per call.
 */
function coveredByEmitted(
  scene: Scene<unknown, string, unknown>,
  id: NodeId,
  emitted: ReadonlySet<string>,
): boolean {
  const seen = new Set<string>([id]);
  const stack: NodeId[] = [id];
  while (stack.length > 0) {
    const node = scene.get(stack.pop()!);
    if (!node) continue;
    const up = node.parent == null ? node.dependsOn ?? [] : [node.parent, ...node.dependsOn ?? []];
    for (const next of up) {
      if (seen.has(next)) continue;
      if (emitted.has(next)) return true;
      seen.add(next);
      stack.push(next);
    }
  }
  return false;
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
 * Which ids survive the filter depends on their order, so the ops are a cover
 * of the selection rather than its minimal set of roots. Each op re-inserts
 * only its own node on undo; cascaded nodes are restored only on the scene's
 * own `kit:remove` path — see `deleteAction` below.
 *
 * Shared with `clipboardCutAction` — cut is copy plus exactly this.
 */
export function buildDeleteOps(
  scene: Scene<unknown, string, unknown>,
  ids: readonly string[],
  label: string,
): Op[] {
  const emitted = new Set<string>();
  const ops: Op[] = [];
  for (const id of ids) {
    const node = scene.get(id as NodeId);
    if (!node) continue;
    if (emitted.has(id)) continue;
    if (coveredByEmitted(scene, id as NodeId, emitted)) continue;
    emitted.add(id);
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
 * **Undo does not restore what the removal cascaded.** Each op captures one
 * node and re-inserts only that node, so a container's children and a deleted
 * node's dependents are gone after the undo that brings the node back. Tracked
 * in `docs/TODO.md` under "Derived geometry follow-ups".
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
