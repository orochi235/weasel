import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { useLatest } from '@weasel-js/react';
import { after } from '@weasel-js/registry';
import { getStylusData, type StylusData } from './stylus';

/** State exposed by `usePointerStylus` — the most recent stylus snapshot
 *  plus a `hovering` flag. */
export interface PointerStylusState extends StylusData {
  /** True between `pointerenter` and `pointerleave` events on the target
   *  element, or on the page's root element when there is no target. iPad
   *  Safari fires these for Apple Pencil hover, so this is true while the
   *  pen is near the glass without contact. */
  hovering: boolean;
}

const IDLE: PointerStylusState = {
  pressure: 0,
  tiltX: 0,
  tiltY: 0,
  altitudeAngle: undefined,
  azimuthAngle: undefined,
  twist: 0,
  pointerType: '',
  isStylus: false,
  hovering: false,
};

/** Options for `usePointerStylus`. */
export interface UsePointerStylusOptions {
  /** Throttle re-renders to ≈this many state updates per second. The latest
   *  sample is always kept; intermediates are dropped. Default 60. Set to
   *  `Infinity` (or 0) to emit every move. */
  maxFps?: number;
  /** When true, only emit updates while `pointerType === 'pen'`. Default
   *  false. */
  stylusOnly?: boolean;
}

/**
 * Subscribe to pointer events on a target element (defaults to `window`)
 * and expose the most recent stylus snapshot. A ref target is read after
 * every commit: the hook listens to nothing while the ref is empty, and
 * moves to whatever element the ref holds next.
 *
 * The hook does NOT consume pointerdown / pointerup — leave gesture handling
 * to the dispatcher. Re-renders are throttled by default (`maxFps`); pass
 * `maxFps: Infinity` to get every sample.
 */
export function usePointerStylus(
  target?: RefObject<Element | null> | Element | null,
  options: UsePointerStylusOptions = {},
): PointerStylusState {
  const { maxFps = 60, stylusOnly = false } = options;
  const [state, setState] = useState<PointerStylusState>(IDLE);
  // Track the last commit time to throttle. A ref avoids re-creating the
  // listener every render and avoids stale-closure read of an outer `let`.
  const lastCommit = useRef(-Infinity);
  const optsRef = useLatest({ maxFps, stylusOnly });

  // Bound after every commit rather than in an effect keyed on `target`: a ref's element is
  // not a dependency React can see change.
  const bound = useRef<{ el: EventTarget; off: () => void } | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- binds listeners, sets no state itself; runs per commit by design
  useEffect(() => {
    // A ref by its shape: `instanceof` misses an element from another window, such as a popout's.
    const el: EventTarget | null = target == null ? window : 'current' in target ? target.current : target;
    if (bound.current?.el === el) return;
    bound.current?.off();
    bound.current = el ? { el, off: listen(el, setState, lastCommit, optsRef) } : null;
  });
  useEffect(() => () => {
    bound.current?.off();
    bound.current = null;
  }, []);

  return state;
}

/** Listens for `el`'s pointer moves and hovers, writing what they report to `setState`; returns the way to stop. */
function listen(
  el: EventTarget,
  setState: Dispatch<SetStateAction<PointerStylusState>>,
  lastCommit: { current: number },
  opts: { readonly current: Required<UsePointerStylusOptions> },
): () => void {
  // `pointerenter`/`pointerleave` go to elements and never bubble, so `window` hears neither.
  const hoverEl: EventTarget = el === window ? document.documentElement : el;

  let cancelTrailing = (): void => {};
  const commit = (sample: StylusData, now: number) => {
    cancelTrailing();
    lastCommit.current = now;
    setState((prev) => ({ ...sample, hovering: prev.hovering }));
  };
  const onMove = (raw: Event) => {
    const e = raw as PointerEvent;
    const { maxFps, stylusOnly } = opts.current;
    if (stylusOnly && e.pointerType !== 'pen') return;
    const now = performance.now();
    const minGap = maxFps > 0 && Number.isFinite(maxFps) ? 1000 / maxFps : 0;
    const sample = getStylusData(e);
    const wait = minGap - (now - lastCommit.current);
    if (minGap > 0 && wait > 0) {
      cancelTrailing();
      cancelTrailing = after(wait, () => commit(sample, performance.now()));
      return;
    }
    commit(sample, now);
  };
  const onEnter = (raw: Event) => {
    const e = raw as PointerEvent;
    if (opts.current.stylusOnly && e.pointerType !== 'pen') return;
    setState((prev) => ({ ...prev, hovering: true }));
  };
  const onLeave = (raw: Event) => {
    const e = raw as PointerEvent;
    if (opts.current.stylusOnly && e.pointerType !== 'pen') return;
    setState((prev) => ({ ...prev, hovering: false }));
  };

  el.addEventListener('pointermove', onMove);
  hoverEl.addEventListener('pointerenter', onEnter);
  hoverEl.addEventListener('pointerleave', onLeave);
  return () => {
    el.removeEventListener('pointermove', onMove);
    hoverEl.removeEventListener('pointerenter', onEnter);
    hoverEl.removeEventListener('pointerleave', onLeave);
    cancelTrailing();
  };
}
