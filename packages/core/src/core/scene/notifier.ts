import { createEmitter } from '@weasel-js/registry';

/**
 * The scene's change notice: its version, its subscribers, and when a change
 * reaches them.
 */
export interface Notifier {
  /** Count a change, and call the subscribers unless the call is held. */
  notify(): void;
  version(): number;
  subscribe(listener: () => void): () => void;
  /** Run `fn` with the calls it causes held, then make one for all of them
   *  once the outermost holder is done. `settle` runs between the two: after
   *  this holder has let go, before any subscriber is called. */
  deferred<T>(fn: () => T, settle?: () => void): T;
  /** Run `fn` with the calls it causes held and then dropped: its caller
   *  notifies once itself. The version still counts each one. */
  muted<T>(fn: () => T): T;
  /** Run `fn` now, or, while a call is held, once the outermost holder is done
   *  and after the subscribers it notifies: for a change notice of another
   *  kind that an edit can cause, so it never reports the edit half applied.
   *  A function queued twice in one hold runs once. */
  whenSettled(fn: () => void): void;
}

export function createNotifier(): Notifier {
  const changed = createEmitter();
  let version = 0;
  let held = 0;
  let pending = false;
  const settled = new Set<() => void>();
  const flush = (): void => {
    if (held > 0) return;
    for (const fn of settled) {
      settled.delete(fn);
      fn();
    }
  };

  return {
    notify() {
      version++;
      if (held > 0) {
        pending = true;
        return;
      }
      changed.emit();
    },
    version: () => version,
    subscribe: changed.subscribe,
    deferred(fn, settle) {
      held++;
      try {
        return fn();
      } finally {
        held--;
        settle?.();
        if (held === 0 && pending) {
          pending = false;
          changed.emit();
        }
        flush();
      }
    },
    muted(fn) {
      const was = pending;
      held++;
      try {
        return fn();
      } finally {
        held--;
        pending = was;
        flush();
      }
    },
    whenSettled(fn) {
      if (held === 0) fn();
      else settled.add(fn);
    },
  };
}
