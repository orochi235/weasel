import type { Dispatcher } from './dispatcherApi';

/** One subscription per live dispatcher. */
export interface DispatcherWatch {
  /** Subscribe to each of `live` not yet watched, and drop any no longer among them. */
  sync(live: readonly Dispatcher[]): void;
  stop(): void;
}

/** Calls `onChange` whenever a watched dispatcher notifies: an event or a
 *  cancel that found or left a gesture in flight. */
export function dispatcherWatch(onChange: () => void): DispatcherWatch {
  const subscriptions = new Map<Dispatcher, () => void>();
  return {
    sync(live) {
      for (const d of live) {
        if (!subscriptions.has(d)) subscriptions.set(d, d.subscribe(onChange));
      }
      if (subscriptions.size === live.length) return;
      const keep = new Set(live);
      for (const [d, unsubscribe] of subscriptions) {
        if (keep.has(d)) continue;
        unsubscribe();
        subscriptions.delete(d);
      }
    },
    stop() {
      for (const unsubscribe of subscriptions.values()) unsubscribe();
      subscriptions.clear();
    },
  };
}
