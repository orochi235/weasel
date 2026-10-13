/** Listeners attached one by one and removed together. */
export interface ListenerSet {
  /** A missing target attaches nothing. */
  on<E extends Event>(
    target: EventTarget | null | undefined,
    type: string,
    listener: (e: E) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeAll(): void;
}

export function listenerSet(): ListenerSet {
  const removers: (() => void)[] = [];
  return {
    on(target, type, listener, options) {
      if (!target) return;
      target.addEventListener(type, listener as EventListener, options);
      removers.push(() => { target.removeEventListener(type, listener as EventListener, options); });
    },
    removeAll() {
      for (const remove of removers.splice(0)) remove();
    },
  };
}
