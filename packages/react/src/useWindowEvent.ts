import { useEffect } from 'react';
import { useLatest } from './useLatest';

/** How {@link useWindowEvent} listens. */
export interface WindowEventOptions {
  /** Listen in the capture phase, ahead of every listener on the document. */
  capture?: boolean;
  passive?: boolean;
  /** Listen only while true. True by default. */
  enabled?: boolean;
}

/**
 * Call `handler` for each `type` event on the window while the caller is mounted. The handler is the one from the
 * last committed render, so a new closure each render never re-subscribes; only a change to `type`, `capture`,
 * `passive` or `enabled` does.
 */
export function useWindowEvent<K extends keyof WindowEventMap>(
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: WindowEventOptions,
): void {
  const latest = useLatest(handler);
  const capture = options?.capture ?? false;
  const passive = options?.passive;
  const enabled = options?.enabled ?? true;
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const listener = (event: WindowEventMap[K]) => latest.current(event);
    window.addEventListener(type, listener, { capture, passive });
    return () => window.removeEventListener(type, listener, { capture });
  }, [type, capture, passive, enabled, latest]);
}
