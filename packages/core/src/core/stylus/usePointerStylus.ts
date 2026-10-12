import { useEffect, useRef, useState, type RefObject } from 'react';
import { useLatest } from '@weasel-js/react';
import { getStylusData, type StylusData } from './stylus';

/** State exposed by `usePointerStylus` — the most recent stylus snapshot
 *  plus a `hovering` flag. */
export interface PointerStylusState extends StylusData {
  /** True between `pointerenter` and `pointerleave` events on the target
   *  element. iPad Safari fires these for Apple Pencil hover, so this is
   *  true while the pen is near the glass without contact. */
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
 * and expose the most recent stylus snapshot.
 *
 * The hook does NOT consume pointerdown / pointerup — leave gesture handling
 * to the dispatcher. Re-renders are throttled by default (`maxFps`); pass
 * `maxFps: Infinity` to get every sample.
 */
export function usePointerStylus(
  target?: RefObject<HTMLElement | null> | HTMLElement | null,
  options: UsePointerStylusOptions = {},
): PointerStylusState {
  const { maxFps = 60, stylusOnly = false } = options;
  const [state, setState] = useState<PointerStylusState>(IDLE);
  // Track the last commit time to throttle. A ref avoids re-creating the
  // listener every render and avoids stale-closure read of an outer `let`.
  const lastCommit = useRef(-Infinity);
  const optsRef = useLatest({ maxFps, stylusOnly });

  useEffect(() => {
    const el: EventTarget =
      target == null
        ? window
        : target instanceof HTMLElement
          ? target
          : target.current ?? window;

    const onMove = (raw: Event) => {
      const e = raw as PointerEvent;
      const { maxFps, stylusOnly } = optsRef.current;
      if (stylusOnly && e.pointerType !== 'pen') return;
      const now = performance.now();
      const minGap = maxFps > 0 && Number.isFinite(maxFps) ? 1000 / maxFps : 0;
      if (minGap > 0 && now - lastCommit.current < minGap) return;
      lastCommit.current = now;
      setState((prev) => ({ ...getStylusData(e), hovering: prev.hovering }));
    };
    const onEnter = (raw: Event) => {
      const e = raw as PointerEvent;
      if (optsRef.current.stylusOnly && e.pointerType !== 'pen') return;
      setState((prev) => ({ ...prev, hovering: true }));
    };
    const onLeave = (raw: Event) => {
      const e = raw as PointerEvent;
      if (optsRef.current.stylusOnly && e.pointerType !== 'pen') return;
      setState((prev) => ({ ...prev, hovering: false }));
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [target, optsRef]);

  return state;
}
