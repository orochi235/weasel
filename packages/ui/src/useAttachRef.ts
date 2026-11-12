import { useCallback, useRef } from 'react';

/**
 * A ref callback that runs `attach` on each element it is handed and the cleanup `attach` returned when the element
 * goes. The callback itself returns nothing, so React 18, which ignores a ref's returned cleanup and calls it with
 * `null` instead, tears down as React 19 does. `attach` is read at mount; hand a stable function.
 */
export function useAttachRef<E extends Element>(attach: (el: E) => (() => void) | undefined): (el: E | null) => void {
  const cleanup = useRef<(() => void) | undefined>(undefined);
  return useCallback((el: E | null) => {
    cleanup.current?.();
    cleanup.current = el === null ? undefined : attach(el);
  }, [attach]);
}
