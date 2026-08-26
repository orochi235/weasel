/**
 * The one place weasel decides whether a frame may run, so that "a loop does no
 * work nobody can see" holds by construction rather than by every loop author
 * remembering. Nothing runs while the document is hidden; a loop that names an
 * element also stops while that element is outside the viewport.
 *
 * A request made while suspended is held, not dropped, and re-armed when the
 * surface comes back — so a loop never needs to poll visibility itself.
 */

import { type RefObject, useCallback, useLayoutEffect, useMemo, useRef } from 'react';

/** What a loop names as its element, resolved every time the gate is consulted
 *  so a ref filled in after mount still starts the observer. */
export type VisibleRafTarget = RefObject<Element | null> | (() => Element | null);

export interface VisibleRafOptions {
  /** Also gate on this element's intersection with the viewport. Omit it and
   *  the loop is gated on document visibility alone. */
  target?: VisibleRafTarget;
  /**
   * Run frames regardless of visibility. The escape hatch for a loop that is
   * not painting for a viewer — an offscreen recording, an export driving its
   * own frames. It is the wrong fix for a loop that stalls after a tab switch:
   * that is a missing `request()`, and setting this hides it.
   */
  dangerouslyRunWhenHidden?: boolean;
  /** Frame clock. Read live, so a test may inject one after mount. */
  requestFrame?: (cb: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
  /**
   * Runs once when the loop leaves suspension, before the frame that follows
   * it. Where a loop that measures elapsed time drops the interval it spent
   * suspended — without it, an hour hidden arrives as one hour-long frame.
   */
  onResume?: () => void;
}

export interface VisibleRaf {
  /** Ask for a frame. Idempotent while one is outstanding, and held rather than
   *  dropped while suspended. Identity is stable for the component's lifetime. */
  request(): void;
  /** Drop the outstanding request, held or scheduled. */
  cancel(): void;
  /** Whether a frame would run right now. */
  isVisible(): boolean;
}

const documentHidden = (): boolean => typeof document !== 'undefined' && document.hidden;

const resolveTarget = (target: VisibleRafTarget | undefined): Element | null =>
  typeof target === 'function' ? target() : (target?.current ?? null);

/**
 * @param frame Runs on the frame, with the timestamp the clock supplied.
 *   A continuous loop calls `request()` again from inside it; a one-shot loop
 *   does not.
 */
export function useVisibleRaf(
  frame: (time: number) => void,
  options: VisibleRafOptions = {},
): VisibleRaf {
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const optsRef = useRef(options);
  optsRef.current = options;

  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef(false);
  const suspendedRef = useRef(false);
  const aliveRef = useRef(true);
  const intersectingRef = useRef(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedRef = useRef<Element | null>(null);

  const isVisible = useCallback(
    (): boolean =>
      optsRef.current.dangerouslyRunWhenHidden === true ||
      (!documentHidden() && intersectingRef.current),
    [],
  );

  const cancelRaf = useCallback(() => {
    if (rafRef.current === null) return;
    (optsRef.current.cancelFrame ?? cancelAnimationFrame)(rafRef.current);
    rafRef.current = null;
  }, []);

  const scheduleRaf = useCallback(() => {
    if (rafRef.current !== null || !aliveRef.current) return;
    rafRef.current = (optsRef.current.requestFrame ?? requestAnimationFrame)((time) => {
      // Released before the frame runs, so a `request()` issued from inside it
      // schedules the next one instead of being swallowed.
      rafRef.current = null;
      if (!aliveRef.current || !pendingRef.current || !isVisible()) return;
      pendingRef.current = false;
      frameRef.current(time);
    });
  }, [isVisible]);

  /** Attaches the observer once the named element exists. Ref callbacks and
   *  lazily-mounted hosts fill their refs after this hook's effect has run. */
  const syncObserver = useCallback(() => {
    const io = observerRef.current;
    if (!io) return;
    const el = resolveTarget(optsRef.current.target);
    if (el === observedRef.current) return;
    if (observedRef.current) io.unobserve(observedRef.current);
    observedRef.current = el;
    // An element that has gone away stops gating rather than stopping the loop.
    intersectingRef.current = true;
    if (el) io.observe(el);
  }, []);

  /** Re-reads the gate after something that could have changed it. Suspending
   *  drops the outstanding frame but keeps the request; resuming hands the
   *  loop its rebase before re-arming. */
  const syncGate = useCallback(() => {
    if (!isVisible()) {
      if (suspendedRef.current) return;
      suspendedRef.current = true;
      cancelRaf();
      return;
    }
    if (!suspendedRef.current) return;
    suspendedRef.current = false;
    if (!aliveRef.current) return;
    optsRef.current.onResume?.();
    if (pendingRef.current) scheduleRaf();
  }, [cancelRaf, isVisible, scheduleRaf]);

  const request = useCallback(() => {
    if (!aliveRef.current) return;
    syncObserver();
    pendingRef.current = true;
    if (!isVisible()) {
      suspendedRef.current = true;
      return;
    }
    scheduleRaf();
  }, [isVisible, scheduleRaf, syncObserver]);

  const cancel = useCallback(() => {
    pendingRef.current = false;
    cancelRaf();
  }, [cancelRaf]);

  // Re-armed in setup because the refs survive StrictMode's simulated remount, and
  // a layout effect so the arming precedes the host's own layout effects — a loop
  // driven from one of those would otherwise be declined on the second mount.
  useLayoutEffect(() => {
    aliveRef.current = true;
    document.addEventListener('visibilitychange', syncGate);
    if (typeof IntersectionObserver !== 'undefined') {
      observerRef.current = new IntersectionObserver((entries) => {
        intersectingRef.current = entries.some((e) => e.isIntersecting);
        syncGate();
      });
      syncObserver();
    }
    return () => {
      aliveRef.current = false;
      document.removeEventListener('visibilitychange', syncGate);
      observerRef.current?.disconnect();
      observerRef.current = null;
      observedRef.current = null;
      intersectingRef.current = true;
      cancelRaf();
      pendingRef.current = false;
      suspendedRef.current = false;
    };
  }, [cancelRaf, syncGate, syncObserver]);

  // Stable identity: `requestRedraw` and friends outlive the render that made
  // them, and consumers capture the handle.
  return useMemo(() => ({ request, cancel, isVisible }), [request, cancel, isVisible]);
}
