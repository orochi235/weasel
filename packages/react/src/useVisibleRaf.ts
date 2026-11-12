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
import { useLatest } from './useLatest';
import { useScheduledFrame } from './scheduledFrame';

/** What a loop names as its element, resolved every time the gate is consulted
 *  so a ref filled in after mount still starts the observer. */
export type VisibleRafTarget = RefObject<Element | null> | (() => Element | null);

/** Options for {@link useVisibleRaf}. */
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
  /** Runs once as the loop goes into suspension, the counterpart of `onResume`: where a loop
   *  whose clock runs between frames stops counting. */
  onSuspend?: () => void;
  /**
   * `'update'` for a loop that produces what others paint — poses, a camera, a
   * simulation step. Its frame runs ahead of every `'paint'` loop's on the same
   * clock in that animation frame, so what it writes is painted the frame it is
   * written rather than the next. Default `'paint'`.
   */
  phase?: 'update' | 'paint';
}

/** The handle {@link useVisibleRaf} returns. Nothing runs until `request()` is called. */
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

/** Whether a frame may run, given the loop's options and its element's last intersection report. */
const gateOpen = (opts: VisibleRafOptions, intersecting: boolean): boolean =>
  opts.dangerouslyRunWhenHidden === true || (!documentHidden() && intersecting);

/** The newest of `entries` about `el`: they arrive oldest first, and one already queued for an
 *  element since unobserved still arrives. */
const latestFor = (entries: readonly IntersectionObserverEntry[], el: Element | null): IntersectionObserverEntry | undefined =>
  entries.filter((e) => e.target === el).at(-1);

const resolveTarget =(target: VisibleRafTarget | undefined): Element | null =>
  typeof target === 'function' ? target() : (target?.current ?? null);

/**
 * A `requestAnimationFrame` loop that runs only while someone can see it: never while the document is hidden,
 * and, given a `target`, never while that element is outside the viewport. Nothing runs until `request()`.
 *
 * @param frame Runs on the frame, with the timestamp the clock supplied and the
 *   loop's own handle. A continuous loop calls `loop.request()` from inside it;
 *   a one-shot loop does not.
 */
export function useVisibleRaf(
  frame: (time: number, loop: VisibleRaf) => void,
  options: VisibleRafOptions = {},
): VisibleRaf {
  const frameRef = useLatest(frame);
  const optsRef = useLatest(options);

  const pendingRef = useRef(false);
  const suspendedRef = useRef(false);
  const aliveRef = useRef(true);
  const intersectingRef = useRef(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedRef = useRef<Element | null>(null);
  const handleRef = useRef<VisibleRaf | null>(null);
  const syncGateRef = useRef<() => void>(() => {});

  const isVisible = useCallback(() => gateOpen(optsRef.current, intersectingRef.current), [optsRef]);

  const { scheduleRaf, cancelRaf } = useScheduledFrame({
    frameRef, optsRef, handleRef, aliveRef, pendingRef, isVisible, suspendRef: syncGateRef,
  });

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
  }, [optsRef]);

  /** Re-reads the gate after something that could have changed it. Suspending
   *  drops the outstanding frame but keeps the request; resuming hands the
   *  loop its rebase before re-arming. */
  const syncGate = useCallback(() => {
    if (!isVisible()) {
      if (suspendedRef.current) return;
      suspendedRef.current = true;
      cancelRaf();
      optsRef.current.onSuspend?.();
      return;
    }
    if (!suspendedRef.current) return;
    suspendedRef.current = false;
    if (!aliveRef.current) return;
    optsRef.current.onResume?.();
    if (pendingRef.current) scheduleRaf();
  }, [cancelRaf, isVisible, optsRef, scheduleRaf]);

  const request = useCallback(() => {
    if (!aliveRef.current) return;
    syncObserver();
    pendingRef.current = true;
    // Still suspended though visible: a swapped target cleared the gate, and the resume is owed.
    if (!isVisible() || suspendedRef.current) { syncGate(); return; }
    scheduleRaf();
  }, [isVisible, scheduleRaf, syncGate, syncObserver]);

  const cancel = useCallback(() => { pendingRef.current = false; cancelRaf(); }, [cancelRaf]);

  // Re-armed in setup because the refs survive StrictMode's simulated remount, and
  // a layout effect so the arming precedes the host's own layout effects — a loop
  // driven from one of those would otherwise be declined on the second mount.
  useLayoutEffect(() => {
    aliveRef.current = true;
    syncGateRef.current = syncGate;
    document.addEventListener('visibilitychange', syncGate);
    if (typeof IntersectionObserver !== 'undefined') {
      observerRef.current = new IntersectionObserver((entries) => {
        const last = latestFor(entries, observedRef.current);
        if (last) { intersectingRef.current = last.isIntersecting; syncGate(); }
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

  // The escape hatch changes the gate with no event to say so.
  const runWhenHidden = options.dangerouslyRunWhenHidden === true;
  useLayoutEffect(() => { syncGate(); }, [runWhenHidden, syncGate]);

  // Stable identity: `requestRedraw` and friends outlive the render that made
  // them, and consumers capture the handle.
  const handle = useMemo(() => ({ request, cancel, isVisible }), [request, cancel, isVisible]);
  useLayoutEffect(() => { handleRef.current = handle; }, [handle]);
  return handle;
}
