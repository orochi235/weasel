import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { attract, usableStops } from '@weasel-js/ui-input';
import { useKitSetting } from '@weasel-js/react';
import { STOP_SNAP_PX } from '../Slider/stops';
import { cssPx } from '../../cssPx';
import type {} from '../../kitSettings';

/** The first stop a move from `from` to `to` crosses, or `to` where it crosses none. */
export function catchStop(from: number, to: number, stops: readonly number[]): number {
  let caught = to;
  for (const stop of stops) {
    if (from < to ? stop > from && stop < caught : stop < from && stop > caught) caught = stop;
  }
  return caught;
}

/** How far the thumb's center travels across `el`, in px. */
function runPx(el: HTMLInputElement): number {
  const css = getComputedStyle(el);
  const thumb = cssPx(css.getPropertyValue('--wzl-slider-thumb-size'));
  return el.getBoundingClientRect().width - cssPx(css.paddingLeft) - cssPx(css.paddingRight) - thumb;
}

/** What a native range track needs to catch on `stops`. */
export interface TrackStops {
  /** The track value a move from `from` to `to` lands on: under a pointer, the
   *  stop near `to` unless alt is held; otherwise, a key step, the first stop it crossed. */
  settle: (el: HTMLInputElement, from: number, to: number) => number;
  onPointerDown: (e: ReactPointerEvent<HTMLInputElement>) => void;
  /** Each stop's fraction of the track, for `InlineRange`'s `marks`. */
  marks: readonly number[];
}

/**
 * `stops` on a native range track running `min`..`max`, each at its
 * `fraction` of the track, which a scaled track places by its scale. The pull is the one
 * `Slider` uses, `attract` over the `targets.sliderStopSnapPx` kit setting, and
 * only a pointer gets it: a key step pulled back onto the stop it left would
 * never leave it.
 */
export function useTrackStops(
  stops: readonly number[] | undefined,
  min: number,
  max: number,
  fraction: (v: number) => number,
): TrackStops {
  const at = useMemo(() => usableStops(stops, min, max).map((s) => s.value), [stops, min, max]);
  const snapPx = useKitSetting('targets.sliderStopSnapPx') ?? STOP_SNAP_PX;
  // Held while a pointer is down on the track: whether alt frees it from the stops.
  const gesture = useRef<{ free: boolean } | null>(null);
  const release = useRef<(() => void) | null>(null);
  useEffect(() => () => release.current?.(), []);
  const marks = useMemo(() => at.map(fraction), [at, fraction]);
  if (at.length === 0) return { settle: (_el, _from, to) => to, onPointerDown: () => {}, marks };
  return {
    settle: (el, from, to) => {
      if (!gesture.current) return catchStop(from, to, at);
      if (gesture.current.free) return to;
      const run = runPx(el);
      if (run <= 0 || max === min) return to;
      return attract(to, at, snapPx / run, fraction);
    },
    onPointerDown: (e) => {
      release.current?.();
      const held = { free: e.altKey };
      gesture.current = held;
      const move = (ev: PointerEvent) => {
        held.free = ev.altKey;
      };
      const end = () => {
        window.removeEventListener('pointermove', move, true);
        window.removeEventListener('pointerup', end, true);
        window.removeEventListener('pointercancel', end, true);
        if (gesture.current === held) gesture.current = null;
        release.current = null;
      };
      window.addEventListener('pointermove', move, true);
      window.addEventListener('pointerup', end, true);
      window.addEventListener('pointercancel', end, true);
      release.current = end;
    },
    marks,
  };
}
