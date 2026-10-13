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
}

export function createNotifier(): Notifier {
  const changed = createEmitter();
  let version = 0;
  let held = 0;
  let pending = false;

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
      }
    },
  };
}
