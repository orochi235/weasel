import { useEffect, useMemo, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { attract, usableStops } from '@weasel-js/headless';
import { useKitSetting } from '@weasel-js/react';
import { STOP_SNAP_PX } from '../Slider/stops';
import shared from '../range.module.css';

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
  const px = (v: string) => Number.parseFloat(v) || 0;
  const thumb = px(css.getPropertyValue('--wzl-slider-thumb-size'));
  return el.getBoundingClientRect().width - px(css.paddingLeft) - px(css.paddingRight) - thumb;
}

/** Each stop as a 1px mark in the range box's background, centered where the
 *  thumb's center sits at it: `t/2 + f·(W − t)` of the content box. */
function marksStyle(at: readonly number[], min: number, max: number): CSSProperties {
  const span = max - min || 1;
  const mark = 'linear-gradient(var(--wzl-border-strong), var(--wzl-border-strong))';
  const place = (v: number) => {
    const f = (v - min) / span;
    // A background position's percentage runs over (W − 1px), the mark's own width taken off.
    return `calc(${f * 100}% + ${0.5 - f} * (var(--wzl-slider-thumb-size) - 1px)) 50%`;
  };
  return {
    '--wzl-range-stop-marks': at.map(() => mark).join(', '),
    '--wzl-range-stop-at': at.map(place).join(', '),
  } as CSSProperties;
}

/** What a native range track needs to catch on `stops`. */
export interface TrackStops {
  /** The track value a move from `from` to `to` lands on: under a pointer, the
   *  stop near `to` unless alt is held; otherwise, a key step, the first stop it crossed. */
  settle: (el: HTMLInputElement, from: number, to: number) => number;
  onPointerDown: (e: ReactPointerEvent<HTMLInputElement>) => void;
  className: string | undefined;
  style: CSSProperties | undefined;
}

/**
 * `stops` on a native range track running `min`..`max`. The pull is the one
 * `Slider` uses, `attract` over the `targets.sliderStopSnapPx` kit setting, and
 * only a pointer gets it: a key step pulled back onto the stop it left would
 * never leave it.
 */
export function useTrackStops(stops: readonly number[] | undefined, min: number, max: number): TrackStops {
  const at = useMemo(() => usableStops(stops, min, max).map((s) => s.value), [stops, min, max]);
  const snapPx = useKitSetting('targets.sliderStopSnapPx') ?? STOP_SNAP_PX;
  // Held while a pointer is down on the track: whether alt frees it from the stops.
  const gesture = useRef<{ free: boolean } | null>(null);
  const release = useRef<(() => void) | null>(null);
  useEffect(() => () => release.current?.(), []);
  const style = useMemo(() => (at.length > 0 ? marksStyle(at, min, max) : undefined), [at, min, max]);
  if (at.length === 0) return { settle: (_el, _from, to) => to, onPointerDown: () => {}, className: undefined, style };
  return {
    settle: (el, from, to) => {
      if (!gesture.current) return catchStop(from, to, at);
      if (gesture.current.free) return to;
      const run = runPx(el);
      if (run <= 0 || max === min) return to;
      return attract(to, at, snapPx / run, (v) => (v - min) / (max - min));
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
    className: shared.stops,
    style,
  };
}
