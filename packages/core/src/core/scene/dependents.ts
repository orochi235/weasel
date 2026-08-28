/**
 * Reverse index for derived geometry: which nodes must recompute when a given
 * node's pose changes. Maintained by the scene on add and remove.
 */
import type { NodeId } from './types';

export interface DependentsIndex {
  /** Record that `id` derives from each of `deps`. */
  add(id: NodeId, deps: readonly NodeId[]): void;
  /** Forget `id` entirely — both as a dependent and as a dependency. */
  remove(id: NodeId): void;
  /** Nodes that derive directly from `id`. */
  dependentsOf(id: NodeId): Iterable<NodeId>;
  /** Nodes that derive from `id` directly or through a chain. Excludes `id`
   *  itself unless a cycle leads back to it. */
  transitiveDependentsOf(id: NodeId): Iterable<NodeId>;
}

const EMPTY: readonly NodeId[] = [];

export function createDependentsIndex(): DependentsIndex {
  /** dependency -> nodes deriving from it */
  const forward = new Map<NodeId, Set<NodeId>>();
  /** dependent -> the dependencies it registered against */
  const reverse = new Map<NodeId, readonly NodeId[]>();

  return {
    add(id, deps) {
      if (deps.length === 0) return;
      reverse.set(id, [...deps]);
      for (const dep of deps) {
        let set = forward.get(dep);
        if (set === undefined) { set = new Set(); forward.set(dep, set); }
        set.add(id);
      }
    },

    remove(id) {
      const deps = reverse.get(id);
      if (deps !== undefined) {
        for (const dep of deps) {
          const set = forward.get(dep);
          if (set === undefined) continue;
          set.delete(id);
          if (set.size === 0) forward.delete(dep);
        }
        reverse.delete(id);
      }
      forward.delete(id);
    },

    dependentsOf(id) {
      return forward.get(id) ?? EMPTY;
    },

    transitiveDependentsOf(id) {
      const out = new Set<NodeId>();
      const queue: NodeId[] = [...(forward.get(id) ?? EMPTY)];
      while (queue.length > 0) {
        const next = queue.pop()!;
        if (out.has(next)) continue;   // also what stops a cycle
        out.add(next);
        for (const d of forward.get(next) ?? EMPTY) queue.push(d);
      }
      return out;
    },
  };
}
