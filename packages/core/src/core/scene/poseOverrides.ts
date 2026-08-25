import { dropPoseKeyedMemoSlots } from './nodeMemo';
import type { NodeId, PoseOverride, PoseOverrides } from './types';

/**
 * Build a {@link PoseOverrides} map.
 *
 * `getNode` resolves an id to the node object the painter memo is keyed on —
 * the only thing this module needs from the scene, and the reason it doesn't
 * import one.
 */
export function createPoseOverrides<TPose>(
  getNode: (id: NodeId) => { data?: unknown } | undefined,
): PoseOverrides<TPose> {
  const entries = new Map<NodeId, PoseOverride<TPose>>();
  const listeners = new Set<() => void>();
  let generation = 0;

  function invalidate(id: NodeId): void {
    const node = getNode(id);
    if (node) dropPoseKeyedMemoSlots(node);
  }

  function published(): void {
    generation++;
    for (const listener of listeners) listener();
  }

  return {
    set(id, entry) {
      entries.set(id, entry);
      invalidate(id);
      published();
    },
    get(id) {
      return entries.get(id);
    },
    has(id) {
      return entries.has(id);
    },
    ids() {
      return [...entries.keys()];
    },
    clear(id) {
      if (!entries.delete(id)) return;
      invalidate(id);
      published();
    },
    clearAll() {
      if (entries.size === 0) return;
      for (const id of entries.keys()) invalidate(id);
      entries.clear();
      published();
    },
    commit() {
      for (const id of entries.keys()) invalidate(id);
      published();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    getGeneration() {
      return generation;
    },
  };
}
