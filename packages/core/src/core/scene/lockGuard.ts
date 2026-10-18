/**
 * The scene's lock guard: what a lock refuses, what the selection may hold,
 * and how a caller that is restoring an already-legal state gets past it.
 */
import { nodeGates } from './nodeGates';
import type { Node, NodeId } from './types';

/** What the guard reads of a scene's state. */
export interface LockGuardState<TData, TLayer extends string, TPose> {
  nodes: Map<NodeId, Node<TData, TLayer, TPose>>;
  layers: { id: string; visible: boolean; locked: boolean }[];
  layerIndex: Map<TLayer, number>;
}

export interface LockGuard<TLayer extends string> {
  /** See `Scene.isLocked`. */
  isLocked(id: NodeId): boolean;
  /** See `Scene.isHidden`. */
  isHidden(id: NodeId): boolean;
  /** Throw when `id` is locked and the guard is not lifted. */
  refuse(id: NodeId, verb: string): void;
  /** Throw when `layer` is locked and the guard is not lifted. */
  refuseLayer(layer: TLayer, verb: string): void;
  /** `ids` less the locked and hidden ones: the scene's selection never
   *  holds either, whoever writes it. */
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

  const source = { get layers() { return state.layers; }, get: (id: NodeId) => state.nodes.get(id) };
  const isLocked = (id: NodeId): boolean => nodeGates(source).locked(id);

  return {
    isLocked,
    isHidden: (id) => nodeGates(source).hidden(id),
    refuse(id, verb) {
      if (bypass > 0 || !isLocked(id)) return;
      throw new Error(`Scene: cannot ${verb} "${id}" — it is locked`);
    },
    refuseLayer(layer, verb) {
      if (bypass > 0 || !state.layers[state.layerIndex.get(layer) ?? -1]?.locked) return;
      throw new Error(`Scene: cannot ${verb} layer "${layer}" — it is locked`);
    },
    reachable(ids) {
      const gates = nodeGates(source);
      return ids.some((id) => gates.locked(id) || gates.hidden(id))
        ? ids.filter((id) => !gates.locked(id) && !gates.hidden(id))
        : ids;
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
