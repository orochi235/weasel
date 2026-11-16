import type { NodeId } from '@weasel-js/core';
import { createKeyedEmitter, type KeyedEmitter } from '@weasel-js/registry';

/** Per scene, the nodes a `.remove()` transition will delete when it ends,
 *  each with the cancels that keep it. Keyed weakly so a dropped scene takes
 *  its entries with it. */
const PENDING_REMOVALS = new WeakMap<object, KeyedEmitter<NodeId>>();

/** Hold `cancel` as one of the removals pending for `id`. Returns the release. */
export function registerRemoval(scene: object, id: NodeId, cancel: () => void): () => void {
  let removals = PENDING_REMOVALS.get(scene);
  if (!removals) {
    removals = createKeyedEmitter<NodeId>();
    PENDING_REMOVALS.set(scene, removals);
  }
  return removals.subscribe(id, cancel);
}

/**
 * @internal Stop every transition chain that would remove `id` when it ends,
 * for that node only, so the node stays in the scene.
 */
export function cancelPendingRemoval(scene: object, id: NodeId): void {
  PENDING_REMOVALS.get(scene)?.emit(id);
}
