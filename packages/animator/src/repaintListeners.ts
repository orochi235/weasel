/** Who to tell when an override store changes outside an animation frame, which `onTick` does
 *  not cover: a bare `set` or `clear` with nothing running. */
export interface RepaintListeners {
  subscribe(listener: () => void): () => void;
  notify(): void;
}

export function createRepaintListeners(): RepaintListeners {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    notify() {
      for (const listener of [...listeners]) listener();
    },
  };
}
