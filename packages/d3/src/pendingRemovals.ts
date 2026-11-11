import type { NodeId } from '@weasel-js/core';

/** Per scene, the nodes a `.remove()` transition will delete when it ends,
 *  each with the cancel that keeps it. Keyed weakly so a dropped scene takes
 *  its entries with it. */
const PENDING_REMOVALS = new WeakMap<object, Map<NodeId, Set<() => void>>>();

export function pendingFor(scene: object): Map<NodeId, Set<() => void>> {
  let map = PENDING_REMOVALS.get(scene);
  if (!map) {
    map = new Map();
    PENDING_REMOVALS.set(scene, map);
  }
  return map;
}

export function unregisterRemoval(scene: object, id: NodeId, cancel: () => void): void {
  const map = PENDING_REMOVALS.get(scene);
  const set = map?.get(id);
  if (!map || !set) return;
  set.delete(cancel);
  if (set.size === 0) map.delete(id);
}

/**
 * @internal Stop every transition chain that would remove `id` when it ends,
 * for that node only, so the node stays in the scene.
 */
export function cancelPendingRemoval(scene: object, id: NodeId): void {
  const set = PENDING_REMOVALS.get(scene)?.get(id);
  if (!set) return;
  for (const cancel of [...set]) cancel();
}
