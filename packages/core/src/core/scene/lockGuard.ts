/**
 * The scene's lock guard: what a locked layer refuses, and how a caller that
 * is restoring an already-legal state gets past it.
 */
import type { Node, NodeId } from './types';

/** What the guard reads of a scene's state. */
export interface LockGuardState<TData, TLayer extends string, TPose> {
  nodes: Map<NodeId, Node<TData, TLayer, TPose>>;
  layers: { locked: boolean }[];
  layerIndex: Map<TLayer, number>;
}

export interface LockGuard<TLayer extends string> {
  /** Whether `id` sits on a locked layer, or inside a node that does. */
  isLocked(id: NodeId): boolean;
  /** Throw when `id` is locked and the guard is not lifted. */
  refuse(id: NodeId, verb: string): void;
  /** Throw when `layer` is locked and the guard is not lifted. */
  refuseLayer(layer: TLayer, verb: string): void;
  /** `ids` less the locked ones: the scene's selection never holds a locked
   *  node, whoever writes it. */
  reachable(ids: readonly NodeId[]): readonly NodeId[];
  /** Run `fn` with the guard lifted: `unlocked()`, `removeLayer`, and every
   *  replay — undo, redo, a journal stepping, a rollback — which restores a
   *  state that was legal when it was recorded. */
  lifted<T>(fn: () => T): T;
}

export function createLockGuard<TData, TLayer extends string, TPose>(
  state: LockGuardState<TData, TLayer, TPose>,
): LockGuard<TLayer> {
  let bypass = 0;

  function isLocked(id: NodeId): boolean {
    if (!state.layers.some((l) => l.locked)) return false;
    let cur = state.nodes.get(id);
    while (cur !== undefined) {
      if (state.layers[state.layerIndex.get(cur.layer) ?? -1]?.locked) return true;
      cur = cur.parent === null ? undefined : state.nodes.get(cur.parent);
    }
    return false;
  }

  return {
    isLocked,
    refuse(id, verb) {
      if (bypass > 0 || !isLocked(id)) return;
      throw new Error(`Scene: cannot ${verb} "${id}" — it is on a locked layer`);
    },
    refuseLayer(layer, verb) {
      if (bypass > 0 || !state.layers[state.layerIndex.get(layer) ?? -1]?.locked) return;
      throw new Error(`Scene: cannot ${verb} layer "${layer}" — it is locked`);
    },
    reachable(ids) {
      if (!state.layers.some((l) => l.locked)) return ids;
      return ids.filter((id) => !isLocked(id));
    },
    lifted(fn) {
      bypass++;
      try {
        return fn();
      } finally {
        bypass--;
      }
    },
  };
}
