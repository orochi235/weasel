import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';

/**
 * Entry and exit states for an overlay drawn by ui itself rather than by a React Aria component, with the same
 * contract as React Aria's own (which it does not export): a `data-entering` or `data-exiting` style held until
 * every CSS animation or transition it started on the element has finished.
 */

/** True from mount until `ready` and the entry animation it starts are done. */
export function useEnterAnimation(ref: RefObject<HTMLElement | null>, ready = true): boolean {
  const [entering, setEntering] = useState(true);
  const active = entering && ready;
  // A transition started before `ready` (while the overlay was still unplaced) would run from the wrong place.
  useLayoutEffect(() => {
    const el = ref.current;
    if (active && el && 'getAnimations' in el) {
      for (const animation of el.getAnimations()) if (animation instanceof CSSTransition) animation.cancel();
    }
  }, [ref, active]);
  useAnimationEnd(ref, active, useCallback(() => setEntering(false), []));
  return active;
}

/** True from when `isOpen` turns false until the exit animation it starts is done; the overlay stays mounted while it is. */
export function useExitAnimation(ref: RefObject<HTMLElement | null>, isOpen: boolean): boolean {
  const [state, setState] = useState<'open' | 'exiting' | 'closed'>(isOpen ? 'open' : 'closed');
  if (state === 'open' && !isOpen) setState('exiting');
  else if (state !== 'open' && isOpen) setState('open');
  const exiting = state === 'exiting';
  useAnimationEnd(ref, exiting, useCallback(() => setState((s) => (s === 'exiting' ? 'closed' : s)), []));
  return exiting;
}

function useAnimationEnd(ref: RefObject<HTMLElement | null>, active: boolean, onEnd: () => void): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    // jsdom's elements have no `getAnimations`.
    const animations = 'getAnimations' in el ? el.getAnimations() : [];
    if (animations.length === 0) {
      onEnd();
      return;
    }
    let canceled = false;
    void Promise.allSettled(animations.map((a) => a.finished)).then(() => {
      if (!canceled) flushSync(onEnd);
    });
    return () => {
      canceled = true;
    };
  }, [ref, active, onEnd]);
}
