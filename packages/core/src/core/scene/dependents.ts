/**
 * Reverse index for derived geometry: which nodes must recompute when a given
 * node's pose changes.
 */
import type { NodeId } from './types';

const NONE: readonly NodeId[] = Object.freeze([]);

export interface DependentsIndex {
  add(id: NodeId, deps: readonly NodeId[]): void;
  /** Forget what `id` declared. Deliberately not symmetric: who depends on
   *  `id` is those nodes' declaration, not `id`'s, and outlives its removal. */
  remove(id: NodeId): void;
  /** Forget every registration. */
  clear(): void;
  /** True when nothing derives from anything. */
  isEmpty(): boolean;
  dependentsOf(id: NodeId): Iterable<NodeId>;
  /** Nodes that derive from `id` directly or through a chain. Excludes `id`
   *  itself unless a cycle leads back to it. */
  transitiveDependentsOf(id: NodeId): Iterable<NodeId>;
}

export function createDependentsIndex(): DependentsIndex {
  /** dependency -> nodes deriving from it */
  const forward = new Map<NodeId, Set<NodeId>>();
  /** dependent -> the dependencies it registered against */
  const reverse = new Map<NodeId, readonly NodeId[]>();

  /** Drop `id`'s registrations against its current dependencies. Shared by
   *  `add` (which re-registers after) and `remove` (which does not). */
  function detachOwnDeps(id: NodeId): void {
    const old = reverse.get(id);
    if (old === undefined) return;
    for (const dep of old) {
      const set = forward.get(dep);
      if (set === undefined) continue;
      set.delete(id);
      if (set.size === 0) forward.delete(dep);
    }
    reverse.delete(id);
  }

  return {
    add(id, deps) {
      detachOwnDeps(id);
      if (deps.length === 0) return;
      reverse.set(id, [...deps]);
      for (const dep of deps) {
        let set = forward.get(dep);
        if (set === undefined) { set = new Set(); forward.set(dep, set); }
        set.add(id);
      }
    },

    remove(id) {
      detachOwnDeps(id);
    },

    clear() {
      forward.clear();
      reverse.clear();
    },

    isEmpty() {
      return forward.size === 0;
    },

    dependentsOf(id) {
      const set = forward.get(id);
      return set === undefined ? NONE : [...set];
    },

    transitiveDependentsOf(id) {
      // Runs per node per frame; the miss must not allocate.
      const direct = forward.get(id);
      if (direct === undefined) return NONE;
      const out = new Set<NodeId>();
      const stack: NodeId[] = [...direct];
      while (stack.length > 0) {
        const next = stack.pop()!;
        if (out.has(next)) continue;   // also what stops a cycle
        out.add(next);
        for (const d of forward.get(next) ?? []) stack.push(d);
      }
      return out;
    },
  };
}
