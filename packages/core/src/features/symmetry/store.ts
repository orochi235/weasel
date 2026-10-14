import type { Symmetry, SymmetryStore } from './types';

/** A symmetry setting held in memory, off unless `initial` is given. */
export function createSymmetryStore(initial: Symmetry | null = null): SymmetryStore {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(next) {
      if (next === current) return;
      current = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
