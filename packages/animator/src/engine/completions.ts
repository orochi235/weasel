import type { WatchCompletion } from '../supervisor';

/** One-shot listeners for an animation leaving the animator's table, finished or canceled. A
 *  stagger watches its children through them, to retire itself when the last one goes. */
export interface Completions {
  /** Tells `id`'s listeners it has left, and forgets them. */
  fire(id: number): void;
  watch: WatchCompletion;
}

/** `has` answers whether an id is still on the table; a watch on one that is not fires at once. */
export function createCompletions(has: (id: number) => boolean): Completions {
  const listeners = new Map<number, (() => void)[]>();
  return {
    fire(id) {
      const ls = listeners.get(id);
      if (!ls) return;
      listeners.delete(id);
      for (const cb of ls) cb();
    },
    watch(id, cb) {
      if (!has(id)) {
        cb();
        return () => {};
      }
      const ls = listeners.get(id) ?? [];
      ls.push(cb);
      listeners.set(id, ls);
      return () => {
        const cur = listeners.get(id);
        if (!cur) return;
        const idx = cur.indexOf(cb);
        if (idx >= 0) cur.splice(idx, 1);
        if (cur.length === 0) listeners.delete(id);
      };
    },
  };
}
