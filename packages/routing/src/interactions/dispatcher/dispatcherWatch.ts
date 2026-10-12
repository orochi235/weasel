import type { Dispatcher } from './dispatcherApi';

/** One subscription per dispatcher, taken as each comes into use. */
export interface DispatcherWatch {
  watch(dispatcher: Dispatcher): void;
  stop(): void;
}

/** Calls `onChange` whenever a watched dispatcher notifies: an event or a
 *  cancel that found or left a gesture in flight. */
export function dispatcherWatch(onChange: () => void): DispatcherWatch {
  const subscriptions = new Map<Dispatcher, () => void>();
  return {
    watch(dispatcher) {
      if (!subscriptions.has(dispatcher)) subscriptions.set(dispatcher, dispatcher.subscribe(onChange));
    },
    stop() {
      for (const unsubscribe of subscriptions.values()) unsubscribe();
      subscriptions.clear();
    },
  };
}
