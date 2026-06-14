export type EventListener = () => void;

export interface EventBus {
  on(event: string, listener: EventListener): () => void;
  emit(event: string): void;
  clear(): void;
}

export function createEventBus(): EventBus {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    on(event, listener) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener);
      return () => {
        set?.delete(listener);
      };
    },
    emit(event) {
      const set = listeners.get(event);
      if (!set) return;
      for (const fn of [...set]) fn();
    },
    clear() {
      listeners.clear();
    },
  };
}
