import { createKeyedEmitter } from '@weasel-js/registry';
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
  const listeners = createKeyedEmitter<number>();
  return {
    fire(id) {
      listeners.emit(id);
      listeners.clear(id);
    },
    watch(id, cb) {
      if (!has(id)) {
        cb();
        return () => {};
      }
      return listeners.subscribe(id, cb);
    },
  };
}
