import { useLayoutEffect, useRef } from 'react';
import { useLatest } from '@weasel-js/react';

/** What a surface does with the input its element receives. */
export interface SurfaceInputHandlers {
  /** Focus the element on a press, so keys reach it without a click first. */
  focusOnPress: boolean;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  /** The pointer moved over the element with no button held. */
  onHover(element: HTMLElement, event: PointerEvent): void;
  /** The pointer left the element. */
  onLeave(): void;
}

/**
 * Listen on whichever element `elementRef` holds, moving the listeners when
 * it holds another. Handlers are read at event time, so a new set never
 * re-attaches.
 *
 * Tracks one fact about the pointer, whether a button is down, because hover
 * stands down for as long as one is. Everything else about a press is the
 * gesture dispatcher's, which listens on this same element.
 *
 * Suppresses the browser's context menu: right-click is a gesture surface
 * tools may consume.
 */
export function useSurfaceInput(
  elementRef: { readonly current: HTMLElement | null },
  handlers: SurfaceInputHandlers,
): void {
  const live = useLatest(handlers);
  const attached = useRef<{ element: HTMLElement; detach: () => void } | null>(null);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (attached.current?.element === element) return;
    attached.current?.detach();
    attached.current = element ? { element, detach: listen(element, live) } : null;
  });
  useLayoutEffect(() => () => {
    attached.current?.detach();
    attached.current = null;
  }, []);
}

function listen(element: HTMLElement, live: { readonly current: SurfaceInputHandlers }): () => void {
  let pressed = false;
  const listeners: Record<string, (event: Event) => void> = {
    pointerdown: () => {
      if (live.current.focusOnPress) element.focus();
      pressed = true;
    },
    pointermove: (event) => {
      if (!pressed) live.current.onHover(element, event as PointerEvent);
    },
    pointerup: () => { pressed = false; },
    pointerleave: () => {
      pressed = false;
      live.current.onLeave();
    },
    contextmenu: (event) => event.preventDefault(),
    focus: (event) => live.current.onFocus?.(event as FocusEvent),
    blur: (event) => live.current.onBlur?.(event as FocusEvent),
  };
  for (const [type, fn] of Object.entries(listeners)) element.addEventListener(type, fn);
  return () => {
    for (const [type, fn] of Object.entries(listeners)) element.removeEventListener(type, fn);
  };
}
